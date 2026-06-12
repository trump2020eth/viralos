/**
 * ViralOS TTS API Route — Step 7
 * 3-tier voice architecture. All provider keys stay server-side.
 *
 * Tier 1 — Piper TTS (self-hosted OR fallback silent WAV)
 * Tier 2 — ElevenLabs (ELEVENLABS_API_KEY) primary, PlayHT (PLAYHT_API_KEY + PLAYHT_USER_ID) secondary
 * Tier 3 — User BYOK key passed per-request (never persisted)
 *
 * Routing:
 *   voice starts with 'el-'      → ElevenLabs (Tier 3 BYOK > Tier 2 platform key > Tier 1 fallback)
 *   voice starts with 'playht-'  → PlayHT     (Tier 3 BYOK > Tier 2 platform key > Tier 1 fallback)
 *   anything else                → Piper TTS  (Tier 1)
 *   Tier 2/3 fails               → graceful fallback to Piper → silent WAV
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getVoiceMeta } from '@/lib/services/voice'
import type { VoiceGenerationResult } from '@/lib/services/voice'

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

  const meta = getVoiceMeta(voice)

  // ── Tier 3: BYOK key supplied in request ──────────────────────────────────
  if (byokApiKey && byokProvider) {
    try {
      if (byokProvider === 'elevenlabs') {
        return await callElevenLabs(text, meta.providerVoiceId, speed, byokApiKey, 3)
      }
      if (byokProvider === 'playht') {
        return await callPlayHT(text, meta.providerVoiceId, speed, byokApiKey, byokUserId ?? '', 3)
      }
    } catch (e) {
      console.warn('[tts] Tier 3 BYOK failed, falling back to Tier 1:', e)
    }
  }

  // ── Tier 2: ElevenLabs ────────────────────────────────────────────────────
  if (meta.provider === 'elevenlabs') {
    const elKey = process.env.ELEVENLABS_API_KEY
    if (elKey) {
      try {
        return await callElevenLabs(text, meta.providerVoiceId, speed, elKey, 2)
      } catch (e) {
        console.warn('[tts] ElevenLabs failed, trying PlayHT fallback:', e)
        // Try PlayHT as Tier 2 fallback (quota swap)
        const phKey = process.env.PLAYHT_API_KEY
        const phUser = process.env.PLAYHT_USER_ID
        if (phKey && phUser) {
          try {
            const playhtVoice = 'en-US-JennyNeural' // closest neutral voice
            return await callPlayHT(text, playhtVoice, speed, phKey, phUser, 2)
          } catch (e2) {
            console.warn('[tts] PlayHT fallback also failed:', e2)
          }
        }
      }
    } else {
      console.log('[tts] ELEVENLABS_API_KEY not set — falling through to Tier 1')
    }
  }

  // ── Tier 2: PlayHT (requested directly) ───────────────────────────────────
  if (meta.provider === 'playht') {
    const phKey = process.env.PLAYHT_API_KEY
    const phUser = process.env.PLAYHT_USER_ID
    if (phKey && phUser) {
      try {
        return await callPlayHT(text, meta.providerVoiceId, speed, phKey, phUser, 2)
      } catch (e) {
        console.warn('[tts] PlayHT failed, falling back to Tier 1:', e)
      }
    } else {
      console.log('[tts] PLAYHT_API_KEY/PLAYHT_USER_ID not set — falling through to Tier 1')
    }
  }

  // ── Tier 1: Piper TTS ─────────────────────────────────────────────────────
  const piperUrl = process.env.PIPER_API_URL || process.env.KOKORO_API_URL
  if (piperUrl) {
    try {
      return await callPiper(text, meta.providerVoiceId, speed, piperUrl)
    } catch (e) {
      console.warn('[tts] Piper failed, generating silent fallback:', e)
    }
  }

  // ── Silent WAV fallback (always works) ────────────────────────────────────
  return generateSilentFallback(text)
}

// ─── ElevenLabs ───────────────────────────────────────────────────────────────

async function callElevenLabs(
  text: string,
  voiceId: string,
  speed: number,
  apiKey: string,
  tier: 1 | 2 | 3
): Promise<NextResponse> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',  // fastest + highest quality on free tier
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
        speed,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`ElevenLabs ${res.status}: ${errText.slice(0, 200)}`)
  }

  const audioBuffer = await res.arrayBuffer()
  const audioBase64 = Buffer.from(audioBuffer).toString('base64')
  const durationSeconds = estimateDurationFromText(text)

  const result: VoiceGenerationResult = {
    audioBase64,
    mimeType: 'audio/mpeg',
    durationSeconds,
    provider: 'elevenlabs',
    tier,
  }
  return NextResponse.json(result)
}

// ─── PlayHT ───────────────────────────────────────────────────────────────────

async function callPlayHT(
  text: string,
  voiceId: string,
  speed: number,
  apiKey: string,
  userId: string,
  tier: 1 | 2 | 3
): Promise<NextResponse> {
  // PlayHT v2 API
  const res = await fetch('https://api.play.ht/api/v2/tts/stream', {
    method: 'POST',
    headers: {
      'AUTHORIZATION': apiKey,
      'X-USER-ID': userId,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      voice: voiceId,
      output_format: 'mp3',
      speed,
      quality: 'medium',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`PlayHT ${res.status}: ${errText.slice(0, 200)}`)
  }

  const audioBuffer = await res.arrayBuffer()
  const audioBase64 = Buffer.from(audioBuffer).toString('base64')
  const durationSeconds = estimateDurationFromText(text)

  const result: VoiceGenerationResult = {
    audioBase64,
    mimeType: 'audio/mpeg',
    durationSeconds,
    provider: 'playht',
    tier,
  }
  return NextResponse.json(result)
}

// ─── Piper TTS ────────────────────────────────────────────────────────────────
// Compatible with Kokoro's OpenAI-style /v1/audio/speech endpoint.
// Self-host: docker run -p 5000:5000 rhasspy/piper (or keep using Kokoro docker image)

async function callPiper(
  text: string,
  voiceId: string,
  speed: number,
  baseUrl: string
): Promise<NextResponse> {
  const res = await fetch(`${baseUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'piper',
      input: text,
      voice: voiceId,
      speed,
      response_format: 'wav',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Piper TTS ${res.status}: ${errText.slice(0, 200)}`)
  }

  const audioBuffer = await res.arrayBuffer()
  const audioBase64 = Buffer.from(audioBuffer).toString('base64')

  const pcmBytes = audioBuffer.byteLength - 44
  const durationSeconds = Math.max(
    pcmBytes / (24000 * 1 * 2),
    estimateDurationFromText(text)
  )

  const result: VoiceGenerationResult = {
    audioBase64,
    mimeType: 'audio/wav',
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    provider: 'piper',
    tier: 1,
  }
  return NextResponse.json(result)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateDurationFromText(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length
  return Math.max(wordCount / 2.8, 1.0) // ~2.8 words/sec natural narration
}

function generateSilentFallback(text: string): NextResponse {
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const durationSeconds = Math.max(wordCount / 2.5, 1.0)

  const sampleRate = 24000
  const numSamples = Math.round(sampleRate * durationSeconds)
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize, 0)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  const result: VoiceGenerationResult = {
    audioBase64: buffer.toString('base64'),
    mimeType: 'audio/wav',
    durationSeconds,
    provider: 'silent-fallback',
    tier: 1,
  }
  return NextResponse.json(result)
}
