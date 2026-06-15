import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import ws from 'ws'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    global: { fetch },
    realtime: { transport: ws },
  }
)

const jobId = process.env.JOB_ID
const userId = process.env.USER_ID
const projectId = process.env.PROJECT_ID
const format = process.env.FORMAT || '9:16'
const voice = process.env.VOICE || 'kokoro-en-f'
const imageEngine = process.env.IMAGE_ENGINE || 'pollinations'
const captionStyle = process.env.CAPTION_STYLE || 'tiktok-v2'

const outDir = '/tmp/viralos-render'
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

console.log(`\n🎬 Starting render for job ${jobId}\n`)

// ── 1. Fetch script payload from Supabase ──────────────────────────────────
console.log('📦 Fetching script payload...')
const { data: payload, error: fetchError } = await supabase
  .from('render_payloads')
  .select('script')
  .eq('job_id', jobId)
  .single()

if (fetchError || !payload) {
  console.error('Failed to fetch payload:', fetchError?.message)
  process.exit(1)
}

const script = payload.script
console.log(`✓ Got script: ${script.scenes?.length ?? 0} scenes`)

// ── 2. Write script to disk for Remotion ──────────────────────────────────
const scriptPath = join(outDir, 'script.json')
writeFileSync(scriptPath, JSON.stringify(script, null, 2))

// ── 3. Render with Remotion ───────────────────────────────────────────────
console.log('\n🎞  Rendering with Remotion...')

const [w, h] = format === '16:9' ? [1920, 1080]
             : format === '1:1'  ? [1080, 1080]
             :                     [1080, 1920]  // 9:16 default

const outputPath = join(outDir, `${jobId}.mp4`)

const cmd = [
  'npx remotion render',
  'remotion/index.ts',
  'VideoComposition',
  outputPath,
  `--width=${w}`,
  `--height=${h}`,
  `--props='${JSON.stringify({ scriptPath, captionStyle, voice, imageEngine })}'`,
  '--log=verbose',
  process.env.CHROME_EXECUTABLE_PATH
    ? `--browser-executable=${process.env.CHROME_EXECUTABLE_PATH}`
    : '',
].filter(Boolean).join(' ')

execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
console.log(`✓ Rendered → ${outputPath}`)

// ── 4. Upload to R2 ───────────────────────────────────────────────────────
console.log('\n☁️  Uploading to R2...')

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const key = `renders/${userId}/${jobId}.mp4`
const fileBuffer = readFileSync(outputPath)

await s3.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET_NAME,
  Key: key,
  Body: fileBuffer,
  ContentType: 'video/mp4',
}))

const videoUrl = `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${key}`
console.log(`✓ Uploaded → ${videoUrl}`)

// ── 5. Mark job done in Supabase ──────────────────────────────────────────
console.log('\n✅ Marking job complete...')

const { error: updateError } = await supabase
  .from('render_jobs')
  .update({
    status: 'done',
    video_url: videoUrl,
    completed_at: new Date().toISOString(),
  })
  .eq('job_id', jobId)

if (updateError) {
  console.error('Failed to update job:', updateError.message)
  process.exit(1)
}

console.log(`\n🎉 Job ${jobId} complete!\n`)
