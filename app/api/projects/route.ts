/**
 * /api/projects
 *
 * GET  — returns all projects for the authenticated user (newest first)
 * POST — creates a new project from a completed /api/generate response
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { GenerateResponse } from '@/app/api/generate/route'

// ─── GET /api/projects ────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getSupabaseAdmin()

    const { data, error } = await db
      .from('projects')
      .select(`
        id, title, niche, format, duration_target, status,
        caption_style, voice, created_at, updated_at,
        render_jobs (
          id, job_id, status, duration_seconds, r2_url, completed_at
        )
      `)
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ projects: data })
  } catch (err: any) {
    console.error('[projects GET] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Database error' },
      { status: 500 }
    )
  }
}

// ─── POST /api/projects ───────────────────────────────────────────────────────

interface CreateProjectRequest {
  script: GenerateResponse
  niche?: string
  format: '9:16' | '16:9' | '1:1'
  duration?: string
  tone?: string
  captionStyle?: string
  voice?: string
  imageEngine?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateProjectRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { script, niche, format, duration, tone, captionStyle, voice, imageEngine } = body

  if (!script?.title || !script?.scenes?.length) {
    return NextResponse.json(
      { error: 'script.title and script.scenes are required' },
      { status: 400 }
    )
  }

  try {
    const db = getSupabaseAdmin()

    // 1. Create project row
    const { data: project, error: projectError } = await db
      .from('projects')
      .insert({
        clerk_user_id:   userId,
        title:           script.title,
        niche:           niche || null,
        format:          format,
        duration_target: duration ? parseInt(duration) : null,
        tone:            tone || null,
        caption_style:   captionStyle || null,
        voice:           voice || null,
        image_engine:    imageEngine || null,
        script_json:     script,
        characters_json: script.characters || null,
        status:          'draft',
      })
      .select()
      .single()

    if (projectError) throw projectError

    // 2. Insert individual scenes for future storyboard editor
    if (script.scenes?.length) {
      const sceneRows = script.scenes.map((scene: any) => ({
        project_id:       project.id,
        scene_number:     scene.scene_number,
        narration:        scene.narration || null,
        image_prompt:     scene.image_prompt || null,
        camera_move:      scene.camera_movement || null,
        arc_beat:         scene.arc_beat || null,
        emotion:          scene.emotion || null,
        duration_seconds: scene.duration || null,
      }))

      const { error: scenesError } = await db
        .from('scenes')
        .insert(sceneRows)

      if (scenesError) {
        console.warn('[projects POST] Scenes insert warning:', scenesError)
        // Non-fatal — project still created
      }
    }

    return NextResponse.json({ project }, { status: 201 })
  } catch (err: any) {
    console.error('[projects POST] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Database error' },
      { status: 500 }
    )
  }
}
