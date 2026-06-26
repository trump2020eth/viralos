/**
 * GET /api/publish/load?projectId=xxx
 *
 * Loads a previously saved publish package from the database.
 * Returns null if not found (caller should generate fresh).
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import type { PublishPackage } from '@/app/api/publish/generate/route'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ package: null })
  }

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    const db = getSupabaseAdmin()

    const { data, error } = await db
      .from('publish_packages')
      .select('*')
      .eq('project_id', projectId)
      .eq('clerk_user_id', userId)
      .single()

    if (error || !data) {
      return NextResponse.json({ package: null })
    }

    // Reshape DB row back to PublishPackage shape
    const pkg: PublishPackage = {
      projectId:          data.project_id,
      titles:             data.titles_json || [],
      descShort:          data.desc_short || '',
      descMedium:         data.desc_medium || '',
      descLong:           data.desc_long || '',
      hashtagsSmall:      data.hashtags_small || [],
      hashtagsMedium:     data.hashtags_medium || [],
      hashtagsLarge:      data.hashtags_large || [],
      hashtagsMixed:      data.hashtags_mixed || [],
      keywordsPrimary:    data.keywords_primary || [],
      keywordsSecondary:  data.keywords_secondary || [],
      keywordsLongtail:   data.keywords_longtail || [],
      keywordsClusters:   data.keywords_clusters || [],
      thumbnails:         data.thumbnails_json || [],
      scores:             data.scores_json || {},
      audience:           data.audience_json || {},
      platforms:          data.platforms_json || {},
      checklist:          data.checklist_json || [],
      suggestions:        data.suggestions_json || [],
      generatedAt:        data.generated_at,
    }

    return NextResponse.json({ package: pkg })
  } catch (err: any) {
    console.error('[publish/load] Error:', err)
    return NextResponse.json({ package: null })
  }
}
