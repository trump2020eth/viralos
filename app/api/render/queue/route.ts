/**
 * POST /api/render/queue
 *
 * Queues a render job by:
 *   1. Creating a render_jobs row in Supabase (status: 'queued')
 *   2. Storing the full script payload in Supabase (render_payloads table)
 *   3. Triggering the GitHub Actions render workflow via workflow_dispatch
 *   4. Returning { jobId, status: 'queued' } immediately
 *
 * The GitHub Actions runner does all the heavy work:
 *   images → TTS → Remotion render → R2 upload → Supabase update
 *
 * Required env vars (set in Vercel):
 *   GITHUB_PAT          — Personal access token with Actions: Read+Write
 *   GITHUB_REPO_OWNER   — Your GitHub username
 *   GITHUB_REPO_NAME    — Your repo name
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import type { GenerateResponse } from '@/app/api/generate/route'
import type { CaptionStyle } from '@/remotion/captions'

interface QueueRenderRequest {
  script:        GenerateResponse
  captionStyle?: CaptionStyle
  voice?:        string
  imageEngine?:  string
  projectId?:    string
}

export interface QueueRenderResponse {
  jobId:   string
  status:  'queued' | 'error'
  message: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await handlePost(req)
  } catch (e: any) {
    console.error('[queue] Unhandled error:', e)
    return NextResponse.json(
      { jobId: '', status: 'error', message: e?.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}

async function handlePost(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
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

  const {
    script,
    captionStyle = 'tiktok-v2',
    voice        = 'kokoro-en-f',
    imageEngine  = 'pollinations',
    projectId,
  } = body

  if (!script?.scenes?.length) {
    return NextResponse.json({ error: 'script.scenes required' }, { status: 400 })
  }

  const jobId  = `render_${userId}_${Date.now()}`
  const format = (script.format as '9:16' | '16:9' | '1:1') || '9:16'
  const now    = new Date().toISOString()

  // ── 1. Persist render_job row ───────────────────────────────────────────────
  const db = await tryGetDb()

  if (db) {
    const { error: jobError } = await db.from('render_jobs').insert({
      job_id:        jobId,
      project_id:    projectId || null,
      clerk_user_id: userId,
      status:        'queued',
      format,
      started_at:    now,
    })
    if (jobError) {
      console.warn('[queue] render_job insert warning:', jobError.message)
    }

    if (projectId) {
      await db.from('projects')
        .update({ status: 'rendering', updated_at: now })
        .eq('id', projectId)
    }

    // ── 2. Store the full script payload so the GH Actions runner can fetch it
    // We can't pass it as a workflow_dispatch input (1KB limit + logs are public).
    // Instead we store it here and the runner fetches it by job_id.
    const { error: payloadError } = await db.from('render_payloads').insert({
      job_id:       jobId,
      user_id:      userId,
      script:       script,
      caption_style: captionStyle,
      voice,
      image_engine: imageEngine,
      format,
      created_at:   now,
    })
    if (payloadError) {
      console.error('[queue] Failed to store render payload:', payloadError.message)
      return NextResponse.json(
        { jobId, status: 'error', message: 'Failed to store render payload' },
        { status: 500 }
      )
    }
  } else {
    console.error('[queue] Supabase not configured — cannot store payload for GitHub Actions')
    return NextResponse.json(
      { jobId, status: 'error', message: 'Database not configured' },
      { status: 500 }
    )
  }

  // ── 3. Trigger GitHub Actions workflow ──────────────────────────────────────
  const triggered = await triggerGitHubWorkflow({
    jobId,
    projectId: projectId || '',
    userId,
    format,
    captionStyle: captionStyle as string,
    voice,
    imageEngine,
  })

  if (!triggered) {
    // Mark job as error so the UI doesn't hang polling forever
    await db.from('render_jobs')
      .update({ status: 'error', error_message: 'Failed to trigger GitHub Actions workflow' })
      .eq('job_id', jobId)

    return NextResponse.json(
      { jobId, status: 'error', message: 'Failed to trigger render workflow' },
      { status: 500 }
    )
  }

  // ── 4. Return immediately ───────────────────────────────────────────────────
  const response: QueueRenderResponse = {
    jobId,
    status:  'queued',
    message: `Job ${jobId} queued. Poll /api/render/status/${jobId} for progress.`,
  }
  return NextResponse.json(response)
}

// ─── GitHub Actions trigger ────────────────────────────────────────────────────

async function triggerGitHubWorkflow(params: {
  jobId:        string
  projectId:    string
  userId:       string
  format:       string
  captionStyle: string
  voice:        string
  imageEngine:  string
}): Promise<boolean> {
  const token     = process.env.GITHUB_PAT
  const owner     = process.env.GITHUB_REPO_OWNER
  const repo      = process.env.GITHUB_REPO_NAME

  if (!token || !owner || !repo) {
    console.error('[queue] Missing GITHUB_PAT, GITHUB_REPO_OWNER, or GITHUB_REPO_NAME')
    return false
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/render.yml/dispatches`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.github+json',
        'Content-Type':  'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref: 'main',   // branch to run the workflow on
        inputs: {
          job_id:       params.jobId,
          project_id:   params.projectId,
          user_id:      params.userId,
          format:       params.format,
          caption_style: params.captionStyle,
          voice:        params.voice,
          image_engine: params.imageEngine,
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[queue] GitHub API error ${res.status}: ${body.slice(0, 300)}`)
      return false
    }

    // 204 No Content = success
    console.log(`[queue] GitHub Actions triggered for job ${params.jobId}`)
    return true
  } catch (e) {
    console.error('[queue] GitHub API fetch failed:', e)
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
