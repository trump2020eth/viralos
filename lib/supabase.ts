/**
 * lib/supabase.ts
 * Supabase client factory.
 *
 * Two clients:
 *   supabasePublic  — anon key, used client-side or for public reads
 *   supabaseAdmin   — service role key, used server-side only (API routes)
 *                     Bypasses RLS — never expose to client.
 *
 * NOTE: This module no longer throws at import time when env vars are missing.
 * It fails gracefully — individual callers must check isSupabaseConfigured()
 * or handle null returns. This prevents build-time crashes when Supabase
 * is not yet configured.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl             = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey         = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Returns true when all required Supabase vars are present */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

/**
 * Public (anon) client — respects RLS.
 * Returns null if Supabase is not configured.
 */
export function getSupabasePublic() {
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Admin (service role) client — bypasses RLS.
 * Only import this in /app/api/** routes.
 * Never pass to client components.
 * Throws if service role key is missing (caller must handle).
 */
export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[ViralOS] Missing Supabase env vars. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    )
  }
  if (!supabaseServiceRoleKey) {
    throw new Error(
      '[ViralOS] Missing SUPABASE_SERVICE_ROLE_KEY. ' +
      'Required for server-side database writes.'
    )
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })
}

/**
 * Legacy export for backwards compatibility with client components.
 * Prefer getSupabasePublic() in new code.
 */
export const supabasePublic = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// ─── TypeScript types matching the schema ──────────────────────────────────

export interface DbUser {
  id: string
  clerk_user_id: string
  email: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface DbProject {
  id: string
  clerk_user_id: string
  title: string
  niche: string | null
  format: '9:16' | '16:9' | '1:1'
  duration_target: number | null
  tone: string | null
  caption_style: string | null
  voice: string | null
  image_engine: string | null
  script_json: Record<string, unknown> | null
  characters_json: Record<string, unknown> | null
  status: 'draft' | 'rendering' | 'done' | 'error'
  created_at: string
  updated_at: string
}

export interface DbRenderJob {
  id: string
  job_id: string
  project_id: string
  clerk_user_id: string
  status: 'queued' | 'rendering' | 'done' | 'error'
  format: '9:16' | '16:9' | '1:1'
  duration_seconds: number | null
  scene_count: number | null
  r2_key: string | null
  r2_url: string | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface DbScene {
  id: string
  project_id: string
  scene_number: number
  narration: string | null
  image_prompt: string | null
  camera_move: string | null
  arc_beat: string | null
  emotion: string | null
  duration_seconds: number | null
  image_url: string | null
  created_at: string
}
