/**
 * GET /api/render/status/[jobId]
 * Step 5: Render job status polling endpoint.
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

interface StatusResponse {
  jobId:            string
  status:           'queued' | 'rendering' | 'done' | 'error' | 'unknown'
  outputUrl?:       string
  r2Key?:           string
  durationSeconds?: number
  sceneCount?:      number
  error?:           string
  elapsedSeconds:   number
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = await params

  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({
      jobId,
      status: 'unknown',
      elapsedSeconds: 0,
    } satisfies StatusResponse)
  }

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    const db = getSupabaseAdmin()

    const { data: job, error } = await db
      .from('render_jobs')
      .select('*')
      .eq('job_id', jobId)
      .eq('clerk_user_id', userId)
      .single()

    if (error || !job) {
      return NextResponse.json({
        jobId,
        status: 'unknown',
        elapsedSeconds: 0,
      } satisfies StatusResponse)
    }

    const startedAt      = job.started_at ? new Date(job.started_at).getTime() : Date.now()
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)

    const response: StatusResponse = {
      jobId,
      status:          job.status,
      outputUrl:       job.r2_url      || undefined,
      r2Key:           job.r2_key      || undefined,
      durationSeconds: job.duration_seconds || undefined,
      sceneCount:      job.scene_count      || undefined,
      error:           job.error_message    || undefined,
      elapsedSeconds,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[status] Error fetching job status:', err)
    return NextResponse.json({ jobId, status: 'unknown', elapsedSeconds: 0 })
  }
}
