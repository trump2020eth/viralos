/**
 * ViralOS Render API Route
 * Orchestrates the full video render pipeline:
 *   1. Fetch scene images via generateImage() (Pollinations)
 *   2. Generate voice for each scene via generateVoice() (Kokoro TTS)
 *   3. Bundle Remotion composition
 *   4. Render to MP4 via Remotion renderMedia()
 *   5. Upload to Cloudflare R2 (if configured) OR return base64 data URL
 *   6. Persist render_job row in Supabase (if configured)
 *
 * All provider calls go through lib/services/ — never directly.
 * This route is the sole orchestrator. UI never calls providers.
 *
 * Step 4 additions:
 *   - R2 upload via uploadVideo() (graceful fallback to base64 if not configured)
 *   - Supabase render_job persistence (non-fatal if DB not configured)
 *   - projectId param — links render to an existing project row
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import os from 'os'
import type { GenerateResponse } from '@/app/api/generate/route'
import type { CaptionStyle } from '@/remotion/captions'
import type { SceneAsset } from '@/remotion/compositions/ViralOSComposition'
import { uploadVideo } from '@/lib/services/storage'

interface RenderRequest {
  script: GenerateResponse
  captionStyle: CaptionStyle
  voice: string
  imageEngine: string
  projectId?: string   // Supabase project UUID — links render job to project
}

interface RenderJobResponse {
  jobId: string
  status: 'complete' | 'error'
  outputUrl?: string     // R2 presigned URL (preferred) or base64 data URL
  r2Key?: string         // R2 object key — stored in Supabase
  durationSeconds?: number
  sceneCount?: number
  error?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth guard
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RenderRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { script, captionStyle = 'tiktok-v2', voice = 'kokoro-en-f', projectId } = body

  if (!script?.scenes?.length) {
    return NextResponse.json(
      { error: 'script.scenes is required and must not be empty' },
      { status: 400 }
    )
  }

  const jobId = `render_${userId}_${Date.now()}`
  const format = (script.format as '9:16' | '16:9' | '1:1') || '9:16'

  // ── Supabase: create render_job row (non-fatal) ─────────────────────────────
  let dbProjectId = projectId || null
  const db = await tryGetDb()
  if (db && dbProjectId) {
    await db.from('render_jobs').insert({
      job_id:        jobId,
      project_id:    dbProjectId,
      clerk_user_id: userId,
      status:        'rendering',
      format,
      started_at:    new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.warn('[render] render_job insert warning:', error.message)
    })

    // Mark project as rendering
    await db.from('projects')
      .update({ status: 'rendering', updated_at: new Date().toISOString() })
      .eq('id', dbProjectId)
  }

  try {
    // ── Step 1: Fetch all scene images in parallel ───────────────────────────
    const { width, height } = getVideoDimensions(format)

    const imageResults = await Promise.all(
      script.scenes.map(async (scene, i) => {
        const url = buildPollinationsUrl(scene.image_prompt, width, height, i + 1)
        return { sceneNumber: scene.scene_number, url }
      })
    )

    // ── Step 2: Generate TTS for all scenes in parallel ──────────────────────
    const ttsResults = await Promise.all(
      script.scenes.map(async (scene) => {
        const ttsRes = await fetch(new URL('/api/tts', req.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Forward auth cookie for server-to-server call
            cookie: req.headers.get('cookie') ?? '',
          },
          body: JSON.stringify({
            text: scene.narration,
            voice,
            speed: 1.0,
          }),
        })

        if (!ttsRes.ok) {
          throw new Error(`TTS failed for scene ${scene.scene_number}: ${ttsRes.status}`)
        }

        const ttsData = await ttsRes.json()
        return {
          sceneNumber: scene.scene_number,
          audioBase64: ttsData.audioBase64 as string,
          durationSeconds: ttsData.durationSeconds as number,
        }
      })
    )

    // ── Step 3: Build scene assets array ─────────────────────────────────────
    const sceneAssets: SceneAsset[] = script.scenes.map((scene) => {
      const img = imageResults.find((r) => r.sceneNumber === scene.scene_number)!
      const tts = ttsResults.find((r) => r.sceneNumber === scene.scene_number)!

      return {
        sceneNumber: scene.scene_number,
        narration: scene.narration,
        cameraMove: scene.camera_movement,
        emotion: scene.emotion,
        imageUrl: img.url,
        audioBase64: tts.audioBase64,
        audioDurationSeconds: tts.durationSeconds,
        captionStyle,
      }
    })

    // ── Step 4: Render via Remotion ───────────────────────────────────────────
    const outputPath = await renderWithRemotion(sceneAssets, format, script.title, jobId)

    const totalDuration = sceneAssets.reduce((s, a) => s + a.audioDurationSeconds, 0)
    const durationSeconds = Math.round(totalDuration)

    // ── Step 5: Upload to R2 (or fall back to base64) ─────────────────────────
    let outputUrl: string
    let r2Key: string | undefined

    const r2Result = await uploadVideo({
      filePath: outputPath,
      jobId,
      userId,
      format,
    })

    if (r2Result) {
      // R2 upload succeeded — use presigned URL
      outputUrl = r2Result.url
      r2Key = r2Result.key
      console.log(`[render] Video uploaded to R2: ${r2Key}`)
    } else {
      // R2 not configured — return base64 data URL (Step 3 behaviour preserved)
      const mp4Buffer = fs.readFileSync(outputPath)
      outputUrl = `data:video/mp4;base64,${mp4Buffer.toString('base64')}`
      console.log('[render] R2 not configured — returning base64 data URL')
    }

    // Cleanup temp file
    try { fs.unlinkSync(outputPath) } catch {}

    // ── Step 6: Update Supabase render_job + project ──────────────────────────
    if (db && dbProjectId) {
      await db.from('render_jobs')
        .update({
          status:           'done',
          duration_seconds: durationSeconds,
          scene_count:      sceneAssets.length,
          r2_key:           r2Key || null,
          r2_url:           r2Result?.url || null,
          completed_at:     new Date().toISOString(),
        })
        .eq('job_id', jobId)

      await db.from('projects')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', dbProjectId)
    }

    const response: RenderJobResponse = {
      jobId,
      status: 'complete',
      outputUrl,
      r2Key,
      durationSeconds,
      sceneCount: sceneAssets.length,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Render error:', err)
    const message = err instanceof Error ? err.message : String(err)

    // Update DB on failure
    if (db && dbProjectId) {
      await db.from('render_jobs')
        .update({ status: 'error', error_message: message, completed_at: new Date().toISOString() })
        .eq('job_id', jobId)
        .then(() => {})
      await db.from('projects')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', dbProjectId)
        .then(() => {})
    }

    return NextResponse.json(
      { jobId, status: 'error', error: message } satisfies RenderJobResponse,
      { status: 500 }
    )
  }
}

// ─── Remotion render orchestrator ────────────────────────────────────────────

async function renderWithRemotion(
  sceneAssets: SceneAsset[],
  format: '9:16' | '16:9' | '1:1',
  title: string,
  jobId: string
): Promise<string> {
  // Dynamic import — Remotion is a server-side peer dependency
  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')

  const { width, height } = getVideoDimensions(format)
  const compositionId = `ViralOS-${format.replace('/', '-')}`

  // Calculate total duration in frames (30fps)
  const fps = 30
  const totalFrames = sceneAssets.reduce(
    (sum, s) => sum + Math.round(s.audioDurationSeconds * fps),
    0
  )

  // Bundle the Remotion entry point
  const entryPoint = path.resolve(process.cwd(), 'remotion', 'Root.tsx')
  const bundled = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  })

  // Select and configure the composition
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: {
      scenes: sceneAssets,
      format,
      title,
    },
  })

  // Output to OS temp dir
  const outputPath = path.join(os.tmpdir(), `${jobId}.mp4`)

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: totalFrames,
      width,
      height,
    },
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: {
      scenes: sceneAssets,
      format,
      title,
    },
    timeoutInMilliseconds: 120000, // 2 min max
    onProgress: ({ progress }) => {
      console.log(`[${jobId}] render progress: ${Math.round(progress * 100)}%`)
    },
  })

  return outputPath
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * tryGetDb()
 * Returns Supabase admin client if configured, null otherwise.
 * Render pipeline degrades gracefully without DB.
 */
async function tryGetDb() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return null
  }
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    return getSupabaseAdmin()
  } catch {
    return null
  }
}

function getVideoDimensions(format: '9:16' | '16:9' | '1:1'): {
  width: number
  height: number
} {
  switch (format) {
    case '9:16': return { width: 1080, height: 1920 }
    case '16:9': return { width: 1920, height: 1080 }
    case '1:1':  return { width: 1080, height: 1080 }
  }
}

/**
 * buildPollinationsUrl()
 * Constructs a deterministic Pollinations image URL.
 * Uses scene index as seed for consistent results on re-render.
 */
function buildPollinationsUrl(
  prompt: string,
  width: number,
  height: number,
  seed: number
): string {
  const encoded = encodeURIComponent(
    `${prompt} cinematic, photorealistic, 8k, dramatic lighting, film grain`
  )
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&model=flux&seed=${seed * 42}`
}
