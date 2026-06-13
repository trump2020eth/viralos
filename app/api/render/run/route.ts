/**
 * POST /api/render/run
 *
 * Internal render execution endpoint.
 * Called by:
 *   - Cloudflare Worker (render-worker.ts) — async path
 *   - /api/render/queue — sync fallback when CF Queue not configured
 *
 * Authentication: x-render-worker-secret header (not Clerk — Worker has no session).
 * Set RENDER_WORKER_SECRET in both Next.js env and Cloudflare Worker vars.
 *
 * This route is the ONLY place Remotion runs. /api/render now delegates here.
 * The render pipeline is identical to the original /api/render route (Step 3/4),
 * with no behaviour changes — only the invocation path changes.
 *
 * Graceful degradation:
 *   - No R2 → returns base64 data URL (Step 3 fallback preserved)
 *   - No Supabase → render still completes, no DB persistence
 *   - RENDER_WORKER_SECRET not set → accepts any caller (dev convenience)
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import os from 'os'
import type { GenerateResponse } from '@/app/api/generate/route'
import type { CaptionStyle } from '@/remotion/captions'
import type { SceneAsset } from '@/remotion/compositions/ViralOSComposition'
import { uploadVideo } from '@/lib/services/storage'
import { generateImage, type ImageEngine } from '@/lib/services/image'
import { generateVoice } from '@/lib/services/voice'

interface RenderRunRequest {
  jobId:        string
  projectId:    string | null
  userId:       string
  script:       GenerateResponse
  captionStyle: CaptionStyle
  voice:        string
  imageEngine:  string
  format:       '9:16' | '16:9' | '1:1'
  // Tier 3 BYOK voice
  byokProvider?: 'elevenlabs' | 'playht'
  byokApiKey?:   string
  byokUserId?:   string
}

interface RenderRunResponse {
  jobId:            string
  status:           'complete' | 'error'
  outputUrl?:       string
  r2Key?:           string
  durationSeconds?: number
  sceneCount?:      number
  error?:           string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await handlePost(req)
  } catch (e: any) {
    console.error('[run] Unhandled error:', e)
    return NextResponse.json(
      { jobId: 'unknown', status: 'error', error: e?.message || 'Unexpected server error' },
      { status: 500 }
    )
  }
}

async function handlePost(req: NextRequest): Promise<NextResponse> {
  // ── Auth: shared secret ────────────────────────────────────────────────────
  const expectedSecret = process.env.RENDER_WORKER_SECRET
  if (expectedSecret) {
    const provided = req.headers.get('x-render-worker-secret')
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let body: RenderRunRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { jobId, projectId, userId, script, captionStyle, voice, format, byokProvider, byokApiKey, byokUserId } = body

  if (!script?.scenes?.length || !jobId || !userId) {
    return NextResponse.json({ error: 'jobId, userId, script.scenes required' }, { status: 400 })
  }

  const db = await tryGetDb()

  // Mark job as 'rendering' (it was 'queued' if dispatched via CF Queue)
  if (db && projectId) {
    await db.from('render_jobs')
      .update({ status: 'rendering', started_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .then(({ error }) => { if (error) console.warn('[run] status update warning:', error.message) })
  }

  try {
    const { width, height } = getVideoDimensions(format)

    // ── Step 1: Scene images ─────────────────────────────────────────────────
    const imageEngine = (body.imageEngine ?? 'pollinations') as ImageEngine
    const imageResults = await Promise.all(
      script.scenes.map(async (scene, i) => {
        const result = await generateImage({
          prompt: scene.image_prompt,
          width,
          height,
          seed: i + 1,
          engine: imageEngine,
        })
        return { sceneNumber: scene.scene_number, url: result.url }
      })
    )

    // ── Step 2: TTS per scene ────────────────────────────────────────────────
    // Calls the voice service in-process (no internal HTTP hop). Previously
    // this fetched `${appUrl}/api/tts`, which routes through Clerk's auth
    // middleware — server-to-server calls have no session cookie, so Clerk
    // returned a 404 here, which surfaced as "Render returned an invalid
    // response (HTTP 404)" one level up in /api/render.
    const ttsResults = await Promise.all(
      script.scenes.map(async (scene) => {
        try {
          const ttsData = await generateVoice({
            text: scene.narration,
            voice,
            speed: 1.0,
            ...(byokApiKey && byokProvider ? { byokProvider, byokApiKey, byokUserId } : {}),
          })
          return {
            sceneNumber:      scene.scene_number,
            audioBase64:      ttsData.audioBase64,
            durationSeconds:  ttsData.durationSeconds,
          }
        } catch (e: any) {
          throw new Error(`TTS failed for scene ${scene.scene_number}: ${e?.message || e}`)
        }
      })
    )
    
    // ── Step 3: Build scene assets ───────────────────────────────────────────
    const sceneAssets: SceneAsset[] = script.scenes.map((scene) => {
      const img = imageResults.find((r) => r.sceneNumber === scene.scene_number)!
      const tts = ttsResults.find((r) => r.sceneNumber === scene.scene_number)!
      return {
        sceneNumber:          scene.scene_number,
        narration:            scene.narration,
        cameraMove:           scene.camera_movement,
        emotion:              scene.emotion,
        imageUrl:             img.url,
        audioBase64:          tts.audioBase64,
        audioDurationSeconds: tts.durationSeconds,
        captionStyle,
      }
    })

    // ── Step 4: Remotion render ──────────────────────────────────────────────
    const outputPath = await renderWithRemotion(sceneAssets, format, script.title, jobId)
    const totalDuration = sceneAssets.reduce((s, a) => s + a.audioDurationSeconds, 0)
    const durationSeconds = Math.round(totalDuration)

    // ── Step 5: R2 upload ────────────────────────────────────────────────────
    let outputUrl: string
    let r2Key: string | undefined

    const r2Result = await uploadVideo({ filePath: outputPath, jobId, userId, format })
    if (r2Result) {
      outputUrl = r2Result.url
      r2Key     = r2Result.key
      console.log(`[run] Uploaded to R2: ${r2Key}`)
    } else {
      const mp4Buffer = fs.readFileSync(outputPath)
      outputUrl = `data:video/mp4;base64,${mp4Buffer.toString('base64')}`
      console.log('[run] R2 not configured — base64 fallback')
    }

    try { fs.unlinkSync(outputPath) } catch {}

    // ── Step 6: Supabase update ──────────────────────────────────────────────
    if (db) {
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

      if (projectId) {
        await db.from('projects')
          .update({ status: 'done', updated_at: new Date().toISOString() })
          .eq('id', projectId)
      }
    }

    const response: RenderRunResponse = {
      jobId,
      status: 'complete',
      outputUrl,
      r2Key,
      durationSeconds,
      sceneCount: sceneAssets.length,
    }
    return NextResponse.json(response)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[run] Render failed for ${jobId}:`, message)

    if (db) {
      await db.from('render_jobs')
        .update({ status: 'error', error_message: message, completed_at: new Date().toISOString() })
        .eq('job_id', jobId)
        .then(() => {})

      if (projectId) {
        await db.from('projects')
          .update({ status: 'error', updated_at: new Date().toISOString() })
          .eq('id', projectId)
          .then(() => {})
      }
    }

    return NextResponse.json(
      { jobId, status: 'error', error: message } satisfies RenderRunResponse,
      { status: 500 }
    )
  }
}

// ─── Remotion renderer ────────────────────────────────────────────────────────

async function renderWithRemotion(
  sceneAssets: SceneAsset[],
  format: '9:16' | '16:9' | '1:1',
  title: string,
  jobId: string
): Promise<string> {
  const { bundle }                     = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')

  const { width, height } = getVideoDimensions(format)
  const compositionId     = `ViralOS-${format.replace('/', '-')}`
  const fps               = 30
  const totalFrames       = sceneAssets.reduce(
    (sum, s) => sum + Math.round(s.audioDurationSeconds * fps),
    0
  )

  const entryPoint = path.resolve(process.cwd(), 'remotion', 'Root.tsx')
  // enableCaching defaults to true, which makes @remotion/bundler write a
  // persistent webpack cache to `node_modules/.remotion`. On Vercel,
  // process.cwd() (`/var/task`) is read-only at runtime, so that mkdir
  // fails with ENOENT. Each invocation is a fresh container anyway, so the
  // cache provides no benefit here — disable it.
  const bundled    = await bundle({ entryPoint, webpackOverride: (c) => c, enableCaching: false })

  const composition = await selectComposition({
    serveUrl:    bundled,
    id:          compositionId,
    inputProps:  { scenes: sceneAssets, format, title },
  })

  const outputPath = path.join(os.tmpdir(), `${jobId}.mp4`)

  await renderMedia({
    composition:      { ...composition, durationInFrames: totalFrames, width, height },
    serveUrl:         bundled,
    codec:            'h264',
    outputLocation:   outputPath,
    inputProps:       { scenes: sceneAssets, format, title },
    timeoutInMilliseconds: 120_000,
    onProgress: ({ progress }) => {
      console.log(`[${jobId}] render: ${Math.round(progress * 100)}%`)
    },
  })

  return outputPath
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function tryGetDb() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    return getSupabaseAdmin()
  } catch { return null }
}

function getVideoDimensions(format: '9:16' | '16:9' | '1:1') {
  switch (format) {
    case '9:16': return { width: 1080, height: 1920 }
    case '16:9': return { width: 1920, height: 1080 }
    case '1:1':  return { width: 1080, height: 1080 }
  }
}
