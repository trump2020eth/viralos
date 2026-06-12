/**
 * ViralOS TTS API Route — Step 7
 *
 * Thin wrapper: auth guard + validation, then delegates to
 * lib/services/voice.ts#generateVoice(), which implements the full
 * 3-tier provider routing in-process (Piper → ElevenLabs/PlayHT → BYOK
 * → silent fallback). Used for client-side voice previews.
 *
 * The render pipeline (/api/render/run) calls generateVoice() directly —
 * it does NOT call this route, to avoid an internal HTTP hop back through
 * Clerk's auth middleware (which has no session for server-to-server calls
 * and would 404 it).
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateVoice } from '@/lib/services/voice'

interface TTSRequest {
  text: string
  voice: string
  speed?: number
  // Tier 3 BYOK
  byokProvider?: 'elevenlabs' | 'playht'
  byokApiKey?: string
  byokUserId?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: TTSRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { text, voice = 'piper-en-f', speed = 1.0, byokProvider, byokApiKey, byokUserId } = body

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  try {
    const result = await generateVoice({ text, voice, speed, byokProvider, byokApiKey, byokUserId })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[tts] generateVoice failed:', e)
    return NextResponse.json({ error: e?.message || 'TTS generation failed' }, { status: 500 })
  }
}
