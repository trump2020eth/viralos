/**
 * ViralOS Render Worker — Cloudflare Worker
 *
 * Consumes jobs from the `viralos-render` Cloudflare Queue.
 * Each message is a RenderQueueMessage dispatched by /api/render/queue.
 *
 * Pipeline (identical to /api/render/route.ts but runs async in Worker):
 *   1. Fetch scene images (Pollinations)
 *   2. Generate TTS per scene (Kokoro)
 *   3. Render MP4 via Remotion Lambda OR Next.js render endpoint
 *   4. Upload to R2
 *   5. Update Supabase render_job + project rows
 *
 * Architecture notes:
 *   - Cloudflare Workers cannot run Remotion (Node.js runtime required).
 *   - The Worker delegates heavy render work back to the Next.js /api/render/run
 *     endpoint (a dedicated internal route — NOT the queue route).
 *   - This separation keeps the Worker lightweight and stateless.
 *   - The Worker's job is: dequeue → call render endpoint → update DB on result.
 *   - Timeout budget: Cloudflare Queue consumers have up to 15 min per message.
 *
 * Upgrade path:
 *   - Swap internal render call to Remotion Lambda → zero other changes.
 *   - Swap Kokoro → ElevenLabs → change env var only.
 *
 * Wrangler bindings required (wrangler.toml):
 *   [[queues.consumers]]
 *   queue = "viralos-render"
 *   max_batch_size = 1          # one render at a time per invocation
 *   max_retries = 2
 *
 *   [vars]
 *   NEXT_APP_URL = "https://your-viralos.pages.dev"  # or localhost in dev
 */

export interface RenderQueueMessage {
  jobId: string
  projectId: string | null
  userId: string
  script: unknown          // GenerateResponse — typed in Next.js land
  captionStyle: string
  voice: string
  imageEngine: string
  format: '9:16' | '16:9' | '1:1'
  enqueuedAt: string
  // Tier 3 BYOK voice (optional — forwarded to /api/render/run)
  byokProvider?: 'elevenlabs' | 'playht'
  byokApiKey?: string
  byokUserId?: string
}

interface Env {
  /** URL of the deployed Next.js app (used to call /api/render/run) */
  NEXT_APP_URL: string
  /** Internal API secret — must match RENDER_WORKER_SECRET in Next.js env */
  RENDER_WORKER_SECRET: string
  /** Supabase URL for direct DB updates from Worker */
  SUPABASE_URL: string
  /** Supabase service role key */
  SUPABASE_SERVICE_ROLE_KEY: string
}

export default {
  /**
   * queue handler — called by Cloudflare for each batch of messages.
   * max_batch_size = 1 → we always get exactly one render job per invocation.
   */
  async queue(batch: MessageBatch<RenderQueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body
      console.log(`[Worker] Processing render job: ${job.jobId}`)

      try {
        await processRenderJob(job, env)
        message.ack()
        console.log(`[Worker] Job ${job.jobId} complete — acked`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Worker] Job ${job.jobId} failed: ${msg}`)

        // Update Supabase status to error before requeue/DLQ
        await updateJobStatus(env, job.jobId, job.projectId, 'error', msg)

        // Let Cloudflare handle retry (up to max_retries)
        message.retry()
      }
    }
  },
} satisfies ExportedHandler<Env>

// ─── Core render orchestration ─────────────────────────────────────────────────

/**
 * processRenderJob()
 * Calls the Next.js /api/render/run endpoint (Node.js runtime) which performs
 * the actual Remotion render. The Worker cannot run ffmpeg/Node APIs directly.
 *
 * The run endpoint authenticates via RENDER_WORKER_SECRET to prevent abuse.
 */
async function processRenderJob(job: RenderQueueMessage, env: Env): Promise<void> {
  const runUrl = `${env.NEXT_APP_URL}/api/render/run`

  const res = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-render-worker-secret': env.RENDER_WORKER_SECRET,
    },
    body: JSON.stringify({
      jobId:        job.jobId,
      projectId:    job.projectId,
      userId:       job.userId,
      script:       job.script,
      captionStyle: job.captionStyle,
      voice:        job.voice,
      imageEngine:  job.imageEngine,
      format:       job.format,
      ...(job.byokApiKey && job.byokProvider ? {
        byokProvider: job.byokProvider,
        byokApiKey:   job.byokApiKey,
        byokUserId:   job.byokUserId,
      } : {}),
    }),
    // Workers have up to 900s wall-clock time for subrequests
    signal: AbortSignal.timeout(890_000),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`/api/render/run responded ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json() as { status: 'complete' | 'error'; error?: string }
  if (data.status === 'error') {
    throw new Error(data.error || 'Render run reported error')
  }

  console.log(`[Worker] Render run succeeded for ${job.jobId}`)
}

// ─── Supabase helpers ──────────────────────────────────────────────────────────

/**
 * updateJobStatus()
 * Direct Supabase REST call from Worker (no SDK — keeps Worker bundle small).
 * Non-fatal: if Supabase is unreachable, we log and continue.
 */
async function updateJobStatus(
  env: Env,
  jobId: string,
  projectId: string | null,
  status: 'error',
  errorMessage: string
): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return

  try {
    const base = env.SUPABASE_URL.replace(/\/$/, '')

    // Update render_job
    await fetch(`${base}/rest/v1/render_jobs?job_id=eq.${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        status,
        error_message:  errorMessage,
        completed_at:   new Date().toISOString(),
      }),
    })

    // Update project if linked
    if (projectId) {
      await fetch(`${base}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status: 'error', updated_at: new Date().toISOString() }),
      })
    }
  } catch (e) {
    console.warn('[Worker] Supabase status update failed (non-fatal):', e)
  }
}
