/**
 * lib/services/storage.ts
 * Cloudflare R2 storage abstraction.
 *
 * All R2 operations go through this module.
 * Upgrade path: swap this file only (e.g. to S3, GCS, Supabase Storage).
 *
 * Current provider: Cloudflare R2 via AWS S3-compatible SDK.
 * Install: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 *
 * Graceful degradation: if R2 env vars are not set, uploadVideo()
 * returns null and the caller falls back to base64 data URL.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import fs from 'fs'

// ─── Config ───────────────────────────────────────────────────────────────────

function getR2Config() {
  const accountId   = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretKey   = process.env.R2_SECRET_ACCESS_KEY
  const bucket      = process.env.R2_BUCKET_NAME || 'viralos-media'

  if (!accountId || !accessKeyId || !secretKey) return null

  return { accountId, accessKeyId, secretKey, bucket }
}

function getR2Client(config: NonNullable<ReturnType<typeof getR2Config>>) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretKey,
    },
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * uploadVideo()
 * Uploads a rendered MP4 to R2. Returns the R2 object key and a
 * 7-day presigned URL for immediate playback/download.
 *
 * Returns null if R2 is not configured — caller should fall back to
 * base64 data URL (existing behaviour preserved from Step 3).
 */
export async function uploadVideo(params: {
  filePath: string
  jobId: string
  userId: string
  format: '9:16' | '16:9' | '1:1'
}): Promise<{ key: string; url: string } | null> {
  const config = getR2Config()
  if (!config) {
    console.warn('[R2] Not configured — video will be returned as base64 data URL')
    return null
  }

  const { filePath, jobId, userId, format } = params
  const key = `videos/${userId}/${jobId}.mp4`

  const client = getR2Client(config)
  const fileBuffer = fs.readFileSync(filePath)

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: 'video/mp4',
    Metadata: {
      jobId,
      userId,
      format,
    },
  }))

  // Generate a 7-day presigned URL for immediate access
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: 60 * 60 * 24 * 7 } // 7 days
  )

  console.log(`[R2] Uploaded ${key} (${Math.round(fileBuffer.length / 1024)}KB)`)
  return { key, url }
}

/**
 * getVideoUrl()
 * Returns a fresh presigned URL for an existing R2 object.
 * Use to refresh expired URLs in the library.
 */
export async function getVideoUrl(key: string): Promise<string | null> {
  const config = getR2Config()
  if (!config) return null

  const client = getR2Client(config)

  try {
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      { expiresIn: 60 * 60 * 24 * 7 }
    )
    return url
  } catch (err) {
    console.error('[R2] getVideoUrl error:', err)
    return null
  }
}
