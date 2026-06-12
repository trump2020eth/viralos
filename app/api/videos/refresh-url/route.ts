/**
 * POST /api/videos/refresh-url
 *
 * Refreshes an expired R2 presigned URL for a stored video.
 * R2 presigned URLs expire after 7 days. Call this when a library
 * video link is broken to get a fresh 7-day URL.
 *
 * Body: { r2Key: string }
 * Returns: { url: string } | { error: string }
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getVideoUrl } from '@/lib/services/storage'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { r2Key?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { r2Key } = body
  if (!r2Key) {
    return NextResponse.json({ error: 'r2Key is required' }, { status: 400 })
  }

  // Security: ensure the key belongs to this user
  // R2 keys are structured as: videos/{userId}/{jobId}.mp4
  if (!r2Key.startsWith(`videos/${userId}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = await getVideoUrl(r2Key)
  if (!url) {
    return NextResponse.json(
      { error: 'R2 not configured or key not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ url })
}
