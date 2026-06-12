/**
 * GET /api/health
 * System health check endpoint.
 * Returns configuration status of all integrated services.
 * Does NOT require authentication — safe to call from monitoring tools.
 */

import { NextResponse } from 'next/server'
import { validateEnv } from '@/lib/startup-validation'

interface ServiceStatus {
  configured: boolean
  status: 'ok' | 'missing' | 'degraded'
  note?: string
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  version: string
  services: {
    clerk:      ServiceStatus
    groq:       ServiceStatus
    supabase:   ServiceStatus
    r2:         ServiceStatus
    tts:        ServiceStatus
    images:     ServiceStatus
    queue:      ServiceStatus
  }
  env_validation: {
    valid: boolean
    missing_required: string[]
    missing_recommended: string[]
  }
}

export async function GET(): Promise<NextResponse> {
  const envResult = validateEnv()

  const has = (key: string) => Boolean(process.env[key])

  const services: HealthResponse['services'] = {
    clerk: {
      configured: has('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') && has('CLERK_SECRET_KEY'),
      status: has('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') && has('CLERK_SECRET_KEY') ? 'ok' : 'missing',
      note: !has('CLERK_SECRET_KEY') ? 'CLERK_SECRET_KEY missing' : undefined,
    },
    groq: {
      configured: has('GROQ_API_KEY'),
      status: has('GROQ_API_KEY') ? 'ok' : 'missing',
      note: !has('GROQ_API_KEY') ? 'Script generation unavailable' : undefined,
    },
    supabase: {
      configured: has('NEXT_PUBLIC_SUPABASE_URL') && has('SUPABASE_SERVICE_ROLE_KEY'),
      status: has('NEXT_PUBLIC_SUPABASE_URL') && has('SUPABASE_SERVICE_ROLE_KEY') ? 'ok' : 'degraded',
      note: !has('NEXT_PUBLIC_SUPABASE_URL') ? 'Project library unavailable — configure Supabase' : undefined,
    },
    r2: {
      configured: has('R2_ACCOUNT_ID') && has('R2_ACCESS_KEY_ID') && has('R2_SECRET_ACCESS_KEY'),
      status: has('R2_ACCOUNT_ID') ? 'ok' : 'degraded',
      note: !has('R2_ACCOUNT_ID') ? 'Videos returned as base64 (no persistent storage)' : undefined,
    },
    tts: {
      configured: has('PIPER_API_URL') || has('KOKORO_API_URL') || has('ELEVENLABS_API_KEY') || has('PLAYHT_API_KEY'),
      status: 'ok', // always ok — has silent fallback
      note: (!has('PIPER_API_URL') && !has('KOKORO_API_URL') && !has('ELEVENLABS_API_KEY'))
        ? 'No TTS provider configured — renders will use silent audio'
        : undefined,
    },
    images: {
      configured: true, // Pollinations is always available (no key needed)
      status: 'ok',
      note: has('REPLICATE_API_TOKEN')
        ? 'FLUX engines available'
        : has('IDEOGRAM_API_KEY')
          ? 'Ideogram engine available'
          : 'Using Pollinations (free, no key needed)',
    },
    queue: {
      configured: has('CF_ACCOUNT_ID') && has('CF_API_TOKEN'),
      status: has('CF_ACCOUNT_ID') && has('CF_API_TOKEN') ? 'ok' : 'degraded',
      note: !has('CF_ACCOUNT_ID') ? 'Async queue not configured — renders run synchronously' : undefined,
    },
  }

  const criticalDown = !services.clerk.configured || !services.groq.configured
  const anyDegraded  = Object.values(services).some(s => s.status !== 'ok')

  const overallStatus: HealthResponse['status'] = criticalDown
    ? 'error'
    : anyDegraded
      ? 'degraded'
      : 'ok'

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    services,
    env_validation: {
      valid: envResult.valid,
      missing_required:    envResult.missing_required,
      missing_recommended: envResult.missing_recommended,
    },
  }

  const httpStatus = overallStatus === 'error' ? 503 : 200
  return NextResponse.json(response, { status: httpStatus })
}
