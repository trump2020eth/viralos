/**
 * ViralOS Video Render Service
 * Abstract provider layer — swap implementation here only.
 * Current provider: Remotion OSS (server-side, ffmpeg, real MP4s)
 * Upgrade path: Remotion OSS → Remotion Lambda (zero architecture change, Step 5+)
 * Future: Kling / Veo / Runway for AI-generated scene video (swap generateSceneVideo)
 */

import type { GenerateResponse } from '@/app/api/generate/route'

export interface RenderParams {
  script: GenerateResponse
  captionStyle: 'tiktok-v2' | 'reels-bold' | 'none'
  voice: string
  imageEngine: string
}

export interface RenderResult {
  jobId: string
  status: 'queued' | 'rendering' | 'complete' | 'error'
  outputUrl?: string
  provider: string
}

export interface SceneVideoParams {
  imageUrl: string
  audioBase64: string
  durationSeconds: number
  cameraMove: string
  transition: string
  captionText: string
  captionStyle: string
}

/**
 * generateSceneVideo() — abstract per-scene video generation.
 * Currently: Remotion composites image + audio + Ken Burns + captions.
 * Future swap: Kling/Veo/Runway for AI-generated video per scene.
 */
export async function generateSceneVideo(
  params: SceneVideoParams
): Promise<{ videoUrl: string; provider: string }> {
  // In the current architecture, scene video is composited during the full render.
  // This function exists as the abstraction point for future AI video providers.
  // When Kling/Veo is available, this becomes: return generateSceneVideoKling(params)
  throw new Error('generateSceneVideo: direct per-scene video not yet implemented. Use renderFinalVideo() with Remotion.')
}

/**
 * renderFinalVideo() — render the complete video from a script.
 * Calls /api/render which orchestrates Remotion server-side.
 * Never call Remotion directly from UI components.
 */
export async function renderFinalVideo(
  params: RenderParams
): Promise<RenderResult> {
  return renderFinalVideoRemotion(params)
}

// ─── Remotion implementation ──────────────────────────────────────────────────

async function renderFinalVideoRemotion(
  params: RenderParams
): Promise<RenderResult> {
  const response = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Render failed: ${err.error || response.status}`)
  }

  const result = await response.json()
  return {
    jobId: result.jobId,
    status: result.status,
    outputUrl: result.outputUrl,
    provider: 'remotion',
  }
}
