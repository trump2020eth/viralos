/**
 * POST /api/render/queue
 *
 * Step 5: Async render dispatch via Cloudflare Queue.
 *
 * Accepts the same body as /api/render (script, captionStyle, voice, etc.)
 * but instead of running the render synchronously (which can hit 2-min HTTP timeout),
 * it:
 *   1. Creates a render_job row in Supabase (status: 'queued')
 *   2. Publishes the job to the Cloudflare Queue (viralos-render)
 *   3. Returns immediately with { jobId, status: 'queued' }
 *
 * The Cloudflare Worker (worker/render-worker.ts) picks up the job and calls
 * /api/render/run (internal, auth'd by RENDER_WORKER_SECRET).
 *
 * The client polls /api/render/status/[jobId] for progress.
 *
 * Graceful degradation:
 *   - If Cloudflare Queue is not configured (no CF_ACCOUNT_ID etc.),
 *     falls back to calling /api/render/run inline (synchronous — Step 3/4 behaviour).
 *   - If Supabase is not configured, still enqueues (or runs sync) without DB persistence.
 *
 * Environment variables required for async mode:
 *   CF_ACCOUNT_ID            — Cloudflare account ID
 *   CF_API_TOKEN             — Cloudflare API token (Queues write permission)
 *   RENDER_QUEUE_NAME        — Queue name (default: viralos-render)
 *   RENDER_WORKER_SECRET     — Shared secret for Worker → /api/render/run auth
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import type { GenerateResponse } from '@/app/api/generate/route'
import type { CaptionStyle } from '@/remotion/captions'
import type { RenderQueueMessage } from '@/worker/render-worker'

interface QueueRenderRequest {
  script:       GenerateResponse
  captionStyle: CaptionStyle
  voice:        string
  imageEngine:  string
  projectId?:   string
  byokProvider?: 'elevenlabs' | 'playht'
  byokApiKey?:   string
  byokUserId?:   string
}

export interface QueueRenderResponse {
  jobId:   string
  status:  'queued' | 'running_sync' | 'error'
  message: string
  async:   boolean   // true = queued, false = running synchronously (fallback)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: QueueRenderRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { script, captionStyle = 'tiktok-v2', voice = 'kokoro-en-f', imageEngine = 'pollinations', projectId, byokProvider, byokApiKey, byokUserId } = body

  if (!script?.scenes?.length) {
    return NextResponse.json({ error: 'script.scenes required' }, { status: 400 })
  }

  const jobId    = `render_${userId}_${Date.now()}`
  const format   = (script.format as '9:16' | '16:9' | '1:1') || '9:16'
  const now      = new Date().toISOString()

  // ── Persist render_job row to Supabase (non-fatal) ───────────────────────────
  const db = await tryGetDb()
  if (db && projectId) {
    await db.from('render_jobs').insert({
      job_id:        jobId,
      project_id:    projectId,
      clerk_user_id: userId,
      status:        'queued',
      format,
      started_at:    now,
    }).then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn('[queue] render_job insert warning:', error.message)
    })

    await db.from('projects')
      .update({ status: 'rendering', updated_at: now })
      .eq('id', projectId)
  }

  // ── Build queue message ──────────────────────────────────────────────────────
  const queueMessage: RenderQueueMessage = {
    jobId,
    projectId:   projectId || null,
    userId,
    script,
    captionStyle,
    voice,
    imageEngine,
    format,
    enqueuedAt:  now,
    ...(byokApiKey && byokProvider ? { byokProvider, byokApiKey, byokUserId } : {}),
  }

  // ── Try Cloudflare Queue dispatch ────────────────────────────────────────────
  const cfAccountId    = process.env.CF_ACCOUNT_ID
  const cfApiToken     = process.env.CF_API_TOKEN
  const queueName      = process.env.RENDER_QUEUE_NAME || 'viralos-render'

  if (cfAccountId && cfApiToken) {
    const enqueued = await dispatchToCloudflareQueue(
      cfAccountId,
      cfApiToken,
      queueName,
      queueMessage
    )

    if (enqueued) {
      const response: QueueRenderResponse = {
        jobId,
        status:  'queued',
        message: `Job ${jobId} queued in ${queueName}. Poll /api/render/status/${jobId} for progress.`,
        async:   true,
      }
      return NextResponse.json(response)
    }
    console.warn('[queue] Cloudflare Queue dispatch failed — falling back to sync render')
  }

  // ── Fallback: synchronous render (Step 3/4 behaviour preserved) ──────────────
  console.log('[queue] CF Queue not configured — running render synchronously')

  const runRes = await fetch(new URL('/api/render/run', req.url).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-render-worker-secret': process.env.RENDER_WORKER_SECRET || '',
      cookie: req.headers.get('cookie') ?? '',
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

  const runData = await runRes.json()

  const response: QueueRenderResponse = {
    jobId,
    status:  runRes.ok && runData.status !== 'error' ? 'running_sync' : 'error',
    message: runRes.ok ? `Sync render complete — job ${jobId}` : (runData.error || 'Render failed'),
    async:   false,
  }

  return NextResponse.json({
    ...response,
    // Forward the full render result when running synchronously
    outputUrl:       runData.outputUrl,
    r2Key:           runData.r2Key,
    durationSeconds: runData.durationSeconds,
    sceneCount:      runData.sceneCount,
  }, { status: runRes.ok ? 200 : 500 })
}

// ─── Cloudflare Queue dispatch ─────────────────────────────────────────────────

/**
 * dispatchToCloudflareQueue()
 * Sends one message to a Cloudflare Queue via the REST API.
 * Returns true on success, false on failure (caller handles fallback).
 *
 * Docs: https://developers.cloudflare.com/queues/platform/api/
 */
async function dispatchToCloudflareQueue(
  accountId: string,
  apiToken:  string,
  queueName: string,
  message:   RenderQueueMessage
): Promise<boolean> {
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/${queueName}/messages`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            body:            message,
            content_type:    'json',
            delay_seconds:   0,
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[queue] CF Queue API error ${res.status}: ${err.slice(0, 200)}`)
      return false
    }

    const data = await res.json() as { success: boolean }
    return data.success === true
  } catch (e) {
    console.error('[queue] CF Queue dispatch exception:', e)
    return false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
