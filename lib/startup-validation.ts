/**
 * lib/startup-validation.ts
 * Startup environment variable validation system.
 *
 * Call validateEnv() at the top of critical API routes, or import
 * startupCheck once in instrumentation.ts (Next.js 15).
 *
 * Variables are grouped by:
 *   REQUIRED   — App will not function at all without these
 *   RECOMMENDED — Degrades gracefully but key features unavailable
 *   OPTIONAL   — Adds capabilities, has free fallback
 */

export interface EnvCheck {
  key: string
  present: boolean
  tier: 'required' | 'recommended' | 'optional'
  description: string
}

export interface ValidationResult {
  valid: boolean          // false only if a REQUIRED var is missing
  checks: EnvCheck[]
  missing_required: string[]
  missing_recommended: string[]
}

const ENV_SPEC: Array<{ key: string; tier: 'required' | 'recommended' | 'optional'; description: string }> = [
  // ── Required ───────────────────────────────────────────────────────────────
  {
    key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    tier: 'required',
    description: 'Clerk publishable key — auth will not work without this',
  },
  {
    key: 'CLERK_SECRET_KEY',
    tier: 'required',
    description: 'Clerk secret key — server-side auth will not work without this',
  },
  {
    key: 'GROQ_API_KEY',
    tier: 'required',
    description: 'Groq API key — script generation will not work without this',
  },

  // ── Recommended ────────────────────────────────────────────────────────────
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    tier: 'recommended',
    description: 'Supabase project URL — project library and render history unavailable without this',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    tier: 'recommended',
    description: 'Supabase anon key — required alongside NEXT_PUBLIC_SUPABASE_URL',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    tier: 'recommended',
    description: 'Supabase service role key — server-side DB writes unavailable without this',
  },
  {
    key: 'R2_ACCOUNT_ID',
    tier: 'recommended',
    description: 'Cloudflare R2 account ID — videos returned as base64 without R2',
  },
  {
    key: 'R2_ACCESS_KEY_ID',
    tier: 'recommended',
    description: 'Cloudflare R2 access key ID',
  },
  {
    key: 'R2_SECRET_ACCESS_KEY',
    tier: 'recommended',
    description: 'Cloudflare R2 secret access key',
  },
  {
    key: 'NEXT_APP_URL',
    tier: 'recommended',
    description: 'Public URL of this app — required for Worker → /api/render/run calls',
  },
  {
    key: 'RENDER_WORKER_SECRET',
    tier: 'recommended',
    description: 'Shared secret for Cloudflare Worker authentication',
  },

  // ── Optional ───────────────────────────────────────────────────────────────
  {
    key: 'PIPER_API_URL',
    tier: 'optional',
    description: 'Piper TTS URL — falls back to silent audio if not set',
  },
  {
    key: 'KOKORO_API_URL',
    tier: 'optional',
    description: 'Legacy Kokoro TTS URL — alias for PIPER_API_URL',
  },
  {
    key: 'ELEVENLABS_API_KEY',
    tier: 'optional',
    description: 'ElevenLabs API key — Tier 2 voice quality',
  },
  {
    key: 'PLAYHT_API_KEY',
    tier: 'optional',
    description: 'PlayHT API key — Tier 2 voice fallback',
  },
  {
    key: 'PLAYHT_USER_ID',
    tier: 'optional',
    description: 'PlayHT user ID — required with PLAYHT_API_KEY',
  },
  {
    key: 'REPLICATE_API_TOKEN',
    tier: 'optional',
    description: 'Replicate API token — enables FLUX Schnell/Dev image engines',
  },
  {
    key: 'IDEOGRAM_API_KEY',
    tier: 'optional',
    description: 'Ideogram API key — enables Ideogram v2 image engine',
  },
  {
    key: 'CF_ACCOUNT_ID',
    tier: 'optional',
    description: 'Cloudflare account ID — enables async render queue dispatch',
  },
  {
    key: 'CF_API_TOKEN',
    tier: 'optional',
    description: 'Cloudflare API token — enables async render queue dispatch',
  },
  {
    key: 'RENDER_QUEUE_NAME',
    tier: 'optional',
    description: 'Cloudflare Queue name (default: viralos-render)',
  },
  {
    key: 'R2_BUCKET_NAME',
    tier: 'optional',
    description: 'R2 bucket name (default: viralos-media)',
  },
]

export function validateEnv(): ValidationResult {
  const checks: EnvCheck[] = ENV_SPEC.map(({ key, tier, description }) => ({
    key,
    tier,
    description,
    present: Boolean(process.env[key]),
  }))

  const missing_required    = checks.filter(c => c.tier === 'required'    && !c.present).map(c => c.key)
  const missing_recommended = checks.filter(c => c.tier === 'recommended' && !c.present).map(c => c.key)

  return {
    valid: missing_required.length === 0,
    checks,
    missing_required,
    missing_recommended,
  }
}

/**
 * assertRequiredEnv()
 * Throws in production if required env vars are missing.
 * Call this in critical API routes for fail-fast behaviour.
 */
export function assertRequiredEnv(): void {
  const result = validateEnv()
  if (!result.valid) {
    throw new Error(
      `[ViralOS] Missing required environment variables: ${result.missing_required.join(', ')}. ` +
      'Check .env.example and configure your deployment.'
    )
  }
}
