/**
 * ViralOS Voice Generation Service — Step 7
 * 3-tier voice architecture. Zero cost by default.
 *
 * Tier 1 — Piper TTS (free, instant, always available, fallback)
 * Tier 2 — ElevenLabs free (10k chars/mo) → PlayHT free (12k chars/mo)
 * Tier 3 — User BYOK (ElevenLabs or PlayHT key stored server-side per-request)
 *
 * Routing logic (called in /api/tts):
 *   voice starts with 'el-'     → ElevenLabs (Tier 2 platform key OR Tier 3 BYOK)
 *   voice starts with 'playht-' → PlayHT (Tier 2 platform key OR Tier 3 BYOK)
 *   anything else               → Piper TTS (Tier 1, always free)
 *
 * To swap a provider: edit this file only.
 * No changes needed in API routes, components, or render pipeline.
 */

export interface VoiceGenerationParams {
  text: string
  voice: string   // see VOICE_CATALOG for valid IDs
  speed?: number
  // Tier 3: user-supplied API key (never stored server-side beyond the request)
  byokProvider?: 'elevenlabs' | 'playht'
  byokApiKey?: string
  byokUserId?: string   // PlayHT requires user_id in addition to api_key
}

export interface VoiceGenerationResult {
  audioBase64: string
  mimeType: string
  durationSeconds: number
  provider: string
  tier: 1 | 2 | 3
}

// ─── Voice Catalog ────────────────────────────────────────────────────────────
// Single source of truth for all voice IDs across the app.

export interface VoiceMeta {
  id: string
  label: string
  gender: 'F' | 'M'
  accent: string
  tier: 1 | 2 | 3
  provider: 'piper' | 'elevenlabs' | 'playht'
  providerVoiceId: string   // the ID the provider API actually expects
  previewDescription: string
}

export const VOICE_CATALOG: VoiceMeta[] = [
  // ── Tier 1: Piper TTS ──────────────────────────────────────────────────────
  {
    id: 'piper-en-f',
    label: 'Aria',
    gender: 'F',
    accent: 'American English',
    tier: 1,
    provider: 'piper',
    providerVoiceId: 'en_US-libritts_r-medium',
    previewDescription: 'Clear, natural American female',
  },
  {
    id: 'piper-en-m',
    label: 'Marcus',
    gender: 'M',
    accent: 'American English',
    tier: 1,
    provider: 'piper',
    providerVoiceId: 'en_US-ryan-high',
    previewDescription: 'Deep, authoritative American male',
  },
  {
    id: 'piper-en-gb-f',
    label: 'Olivia',
    gender: 'F',
    accent: 'British English',
    tier: 1,
    provider: 'piper',
    providerVoiceId: 'en_GB-alba-medium',
    previewDescription: 'Warm British female',
  },
  {
    id: 'piper-en-gb-m',
    label: 'James',
    gender: 'M',
    accent: 'British English',
    tier: 1,
    provider: 'piper',
    providerVoiceId: 'en_GB-alan-low',
    previewDescription: 'Distinguished British male',
  },

  // ── Legacy Kokoro IDs (map to Piper, backwards-compat) ─────────────────────
  {
    id: 'kokoro-en-f',
    label: 'Aria (Kokoro)',
    gender: 'F',
    accent: 'American English',
    tier: 1,
    provider: 'piper',
    providerVoiceId: 'en_US-libritts_r-medium',
    previewDescription: 'Legacy — maps to Piper Aria',
  },
  {
    id: 'kokoro-en-m',
    label: 'Marcus (Kokoro)',
    gender: 'M',
    accent: 'American English',
    tier: 1,
    provider: 'piper',
    providerVoiceId: 'en_US-ryan-high',
    previewDescription: 'Legacy — maps to Piper Marcus',
  },

  // ── Tier 2: ElevenLabs (platform free key) ─────────────────────────────────
  {
    id: 'el-rachel',
    label: 'Rachel',
    gender: 'F',
    accent: 'American English',
    tier: 2,
    provider: 'elevenlabs',
    providerVoiceId: '21m00Tcm4TlvDq8ikWAM',
    previewDescription: 'Calm, natural — great for narration',
  },
  {
    id: 'el-adam',
    label: 'Adam',
    gender: 'M',
    accent: 'American English',
    tier: 2,
    provider: 'elevenlabs',
    providerVoiceId: 'pNInz6obpgDQGcFmaJgB',
    previewDescription: 'Deep, authoritative — great for docs',
  },
  {
    id: 'el-domi',
    label: 'Domi',
    gender: 'F',
    accent: 'American English',
    tier: 2,
    provider: 'elevenlabs',
    providerVoiceId: 'AZnzlk1XvdvUeBnXmlld',
    previewDescription: 'Strong, confident female',
  },
  {
    id: 'el-bella',
    label: 'Bella',
    gender: 'F',
    accent: 'American English',
    tier: 2,
    provider: 'elevenlabs',
    providerVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    previewDescription: 'Soft, approachable — lifestyle content',
  },
  {
    id: 'el-josh',
    label: 'Josh',
    gender: 'M',
    accent: 'American English',
    tier: 2,
    provider: 'elevenlabs',
    providerVoiceId: 'TxGEqnHWrfWFTfGW9XjX',
    previewDescription: 'Young, energetic — TikTok / Reels',
  },
  {
    id: 'el-arnold',
    label: 'Arnold',
    gender: 'M',
    accent: 'American English',
    tier: 2,
    provider: 'elevenlabs',
    providerVoiceId: 'VR6AewLTigWG4xSOukaG',
    previewDescription: 'Crisp narrator — business / explainer',
  },

  // ── Tier 2: PlayHT (platform free key, fallback if ElevenLabs quota hit) ───
  {
    id: 'playht-jennifer',
    label: 'Jennifer',
    gender: 'F',
    accent: 'American English',
    tier: 2,
    provider: 'playht',
    providerVoiceId: 'en-US-JennyNeural',
    previewDescription: 'Natural American female — PlayHT',
  },
  {
    id: 'playht-ryan',
    label: 'Ryan',
    gender: 'M',
    accent: 'American English',
    tier: 2,
    provider: 'playht',
    providerVoiceId: 'en-US-GuyNeural',
    previewDescription: 'Conversational American male — PlayHT',
  },
]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getVoiceMeta(voiceId: string): VoiceMeta {
  return (
    VOICE_CATALOG.find(v => v.id === voiceId) ??
    VOICE_CATALOG.find(v => v.id === 'piper-en-f')!
  )
}

export function getVoicesByTier(tier: 1 | 2 | 3): VoiceMeta[] {
  return VOICE_CATALOG.filter(v => v.tier === tier && !v.id.startsWith('kokoro-'))
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * generateVoice() — the ONLY function the rest of the app calls.
 *
 * IMPORTANT: this used to `fetch('/api/tts', ...)`. That's a relative URL,
 * which is invalid for server-side fetch() in a Next.js route handler (no
 * base to resolve against) — and even when given an absolute URL, that
 * second hop went back through Clerk's middleware, which has no session for
 * server-to-server calls and returns a 404. Both issues are eliminated by
 * implementing the provider routing directly here, in-process. /api/tts
 * (used by client-side voice previews) now also calls this function.
 *
 * 3-tier voice architecture. All provider keys stay server-side.
 *   Tier 1 — Piper TTS (self-hosted OR fallback silent WAV)
 *   Tier 2 — ElevenLabs (ELEVENLABS_API_KEY) primary, PlayHT secondary
 *   Tier 3 — User BYOK key passed per-request (never persisted)
 *
 * Routing:
 *   voice starts with 'el-'      → ElevenLabs (Tier 3 BYOK > Tier 2 platform key > Tier 1 fallback)
 *   voice starts with 'playht-'  → PlayHT     (Tier 3 BYOK > Tier 2 platform key > Tier 1 fallback)
 *   anything else                → Piper TTS  (Tier 1)
 *   Tier 2/3 fails               → graceful fallback to Piper → silent WAV
 */
export async function generateVoice(
  params: VoiceGenerationParams
): Promise<VoiceGenerationResult> {
  const { text, voice = 'piper-en-f', speed = 1.0, byokProvider, byokApiKey, byokUserId } = params

  if (!text?.trim()) {
    throw new Error('text is required')
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
      console.warn('[voice] Tier 3 BYOK failed, falling back to Tier 1:', e)
    }
  }

  // ── Tier 2: ElevenLabs ────────────────────────────────────────────────────
  if (meta.provider === 'elevenlabs') {
    const elKey = process.env.ELEVENLABS_API_KEY
    if (elKey) {
      try {
        return await callElevenLabs(text, meta.providerVoiceId, speed, elKey, 2)
      } catch (e) {
        console.warn('[voice] ElevenLabs failed, trying PlayHT fallback:', e)
        const phKey = process.env.PLAYHT_API_KEY
        const phUser = process.env.PLAYHT_USER_ID
        if (phKey && phUser) {
          try {
            const playhtVoice = 'en-US-JennyNeural' // closest neutral voice
            return await callPlayHT(text, playhtVoice, speed, phKey, phUser, 2)
          } catch (e2) {
            console.warn('[voice] PlayHT fallback also failed:', e2)
          }
        }
      }
    } else {
      console.log('[voice] ELEVENLABS_API_KEY not set — falling through to Tier 1')
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
        console.warn('[voice] PlayHT failed, falling back to Tier 1:', e)
      }
    } else {
      console.log('[voice] PLAYHT_API_KEY/PLAYHT_USER_ID not set — falling through to Tier 1')
    }
  }

  // ── Tier 1: Piper TTS ─────────────────────────────────────────────────────
  const piperUrl = process.env.PIPER_API_URL || process.env.KOKORO_API_URL
  if (piperUrl) {
    try {
      return await callPiper(text, meta.providerVoiceId, speed, piperUrl)
    } catch (e) {
      console.warn('[voice] Piper failed, generating silent fallback:', e)
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
): Promise<VoiceGenerationResult> {
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

  return {
    audioBase64,
    mimeType: 'audio/mpeg',
    durationSeconds,
    provider: 'elevenlabs',
    tier,
  }
}

// ─── PlayHT ───────────────────────────────────────────────────────────────────

async function callPlayHT(
  text: string,
  voiceId: string,
  speed: number,
  apiKey: string,
  userId: string,
  tier: 1 | 2 | 3
): Promise<VoiceGenerationResult> {
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

  return {
    audioBase64,
    mimeType: 'audio/mpeg',
    durationSeconds,
    provider: 'playht',
    tier,
  }
}

// ─── Piper TTS ────────────────────────────────────────────────────────────────
// Compatible with Kokoro's OpenAI-style /v1/audio/speech endpoint.
// Self-host: docker run -p 5000:5000 rhasspy/piper (or keep using Kokoro docker image)

async function callPiper(
  text: string,
  voiceId: string,
  speed: number,
  baseUrl: string
): Promise<VoiceGenerationResult> {
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

  return {
    audioBase64,
    mimeType: 'audio/wav',
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    provider: 'piper',
    tier: 1,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateDurationFromText(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length
  return Math.max(wordCount / 2.8, 1.0) // ~2.8 words/sec natural narration
}

function generateSilentFallback(text: string): VoiceGenerationResult {
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

  return {
    audioBase64: buffer.toString('base64'),
    mimeType: 'audio/wav',
    durationSeconds,
    provider: 'silent-fallback',
    tier: 1,
  }
}
