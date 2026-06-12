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
 * Routing: delegates to the /api/tts route which handles the actual provider calls
 * server-side (keys never exposed to client).
 */
export async function generateVoice(
  params: VoiceGenerationParams
): Promise<VoiceGenerationResult> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`TTS failed: ${err.error || response.status}`)
  }

  return response.json()
}
