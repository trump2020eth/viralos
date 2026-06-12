/**
 * POST /api/render
 *
 * Thin delegator — auth guard + validation, then hands off to /api/render/run.
 *
 * Previously this file duplicated the full render pipeline (images, TTS, Remotion,
 * R2, Supabase). That caused two bugs:
 *   1. Image engine selection was ignored — hardcoded Pollinations URL builder.
 *   2. TTS used cookie-forwarding which Vercel strips on internal fetches.
 *
 * Fix: delegate to /api/render/run, which is the single correct implementation.
 * /api/render/queue already does this for the async path; now /api/render does too.
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import type { GenerateResponse } from '@/app/api/generate/route'
import type { CaptionStyle } from '@/remotion/captions'

interface RenderRequest {
  script:        GenerateResponse
  captionStyle:  CaptionStyle
  voice:         string
  imageEngine:   string
  projectId?:    string
  byokProvider?: 'elevenlabs' | 'playht'
  byokApiKey?:   string
  byokUserId?:   string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await handlePost(req)
  } catch (e: any) {
    console.error('[render] Unhandled error:', e)
    return NextResponse.json(
      { jobId: 'unknown', status: 'error', error: e?.message || 'Unexpected server error' },
      { status: 500 }
    )
  }
}

async function handlePost(req: NextRequest): Promise<NextResponse> {
  // ── Auth guard ────────────────────────────────────────────────────────────
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

  const { script, captionStyle = 'tiktok-v2', voice = 'piper-en-f', imageEngine = 'pollinations', projectId, byokProvider, byokApiKey, byokUserId } = body

  if (!script?.scenes?.length) {
    return NextResponse.json(
      { error: 'script.scenes is required and must not be empty' },
      { status: 400 }
    )
  }

  // Generate jobId here so the caller always gets one back
  const jobId  = `render_${userId}_${Date.now()}`
  const format = (script.format as '9:16' | '16:9' | '1:1') || '9:16'

  // ── Delegate to /api/render/run ───────────────────────────────────────────
  // /api/render/run is the single source of truth for the render pipeline.
  // It handles: image generation (via lib/services/image.ts), TTS, Remotion,
  // R2 upload, and Supabase persistence — all with correct fallback chains.
  // appUrl resolution order: explicit NEXT_APP_URL -> Vercel's auto-injected
  // deployment URL -> localhost (dev only). Falling through to localhost in
  // production means this fetch can never succeed, so VERCEL_URL is a much
  // safer default than the previous code had.
  const appUrl =
    process.env.NEXT_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT || 3000}`)

  let runRes: Response
  try {
    runRes = await fetch(`${appUrl}/api/render/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-render-worker-secret': process.env.RENDER_WORKER_SECRET || '',
      },
      body: JSON.stringify({
        jobId,
        projectId:   projectId || null,
        userId,
        script,
        captionStyle,
        voice,
        imageEngine,
        format,
        ...(byokApiKey && byokProvider ? { byokProvider, byokApiKey, byokUserId } : {}),
      }),
    })
  } catch (err) {
    console.error('[render] Failed to reach /api/render/run:', err)
    return NextResponse.json(
      { jobId, status: 'error', error: `Internal render service unreachable at ${appUrl}/api/render/run. Check NEXT_APP_URL.` },
      { status: 502 }
    )
  }

  const rawText = await runRes.text()
  let runData: any = {}
  try {
    runData = rawText ? JSON.parse(rawText) : {}
  } catch {
    const snippet = rawText.replace(/\s+/g, ' ').trim().slice(0, 300)
    runData = {
      jobId,
      status: 'error',
      error:
        `Render returned an invalid response (HTTP ${runRes.status}) from ${appUrl}/api/render/run. ` +
        `It may have exceeded the platform's execution time limit, or middleware/auth is intercepting ` +
        `the internal request. Response body: ${snippet || '(empty)'}`,
    }
  }
  return NextResponse.json(runData, { status: runRes.ok ? 200 : (runRes.status || 500) })
}
