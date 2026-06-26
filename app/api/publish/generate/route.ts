/**
 * POST /api/publish/generate
 *
 * Generates a complete publishing package for a completed video project.
 * Called automatically after a successful render, or manually by the user.
 *
 * Input:  { projectId, title, niche, tone, format, scenes[] }
 * Output: Full PublishPackage object
 *
 * Uses Groq (llama-3.3-70b) — same model as script generation.
 * Saves result to publish_packages table if Supabase is configured.
 * Returns the package regardless of DB success.
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export interface TitleOption {
  label: 'High Curiosity' | 'Question' | 'How-To' | 'SEO' | 'Trending' | 'Short' | 'Long' | 'Clickbait' | 'Educational' | 'Story'
  title: string
}

export interface ThumbnailConcept {
  headline: string
  emotion: string
  color: string
  placement: string
  focus: string
}

export interface ScoreEntry {
  score: number   // 1-10
  explanation: string
}

export interface PublishScores {
  hook:         ScoreEntry
  curiosity:    ScoreEntry
  retention:    ScoreEntry
  seo:          ScoreEntry
  shareability: ScoreEntry
  novelty:      ScoreEntry
}

export interface PlatformVersion {
  title:       string
  description: string
  hashtags:    string[]
  cta:         string
}

export interface ChecklistItem {
  item:   string
  passed: boolean
  note?:  string
}

export interface AISuggestion {
  type:       'hook' | 'intro' | 'ending' | 'cta' | 'title' | 'thumbnail'
  suggestion: string
  priority:   'high' | 'medium' | 'low'
}

export interface KeywordCluster {
  cluster: string
  terms:   string[]
}

export interface AudienceProfile {
  age_range:  string
  interests:  string[]
  intent:     string
  best_time:  string
}

export interface PublishPackage {
  projectId: string

  titles:     TitleOption[]

  descShort:  string
  descMedium: string
  descLong:   string

  hashtagsSmall:  string[]
  hashtagsMedium: string[]
  hashtagsLarge:  string[]
  hashtagsMixed:  string[]

  keywordsPrimary:   string[]
  keywordsSecondary: string[]
  keywordsLongtail:  string[]
  keywordsClusters:  KeywordCluster[]

  thumbnails:  ThumbnailConcept[]
  scores:      PublishScores
  audience:    AudienceProfile

  platforms: {
    tiktok:           PlatformVersion
    youtube_shorts:   PlatformVersion
    instagram_reels:  PlatformVersion
    facebook_reels:   PlatformVersion
  }

  checklist:   ChecklistItem[]
  suggestions: AISuggestion[]

  generatedAt: string
}

interface GeneratePublishRequest {
  projectId:  string
  title:      string
  niche:      string
  tone:       string
  format:     string
  sceneNarrations: string[]  // narration text per scene for context
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: GeneratePublishRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { projectId, title, niche, tone, format, sceneNarrations } = body

  if (!projectId || !title) {
    return NextResponse.json({ error: 'projectId and title required' }, { status: 400 })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })
  }

  const narrationSummary = sceneNarrations?.slice(0, 5).join(' ').slice(0, 800) || ''

  const prompt = `You are an expert viral content strategist and YouTube/TikTok SEO specialist.

A faceless AI video has been created with these details:
- Title: "${title}"
- Niche: ${niche || 'general'}
- Tone: ${tone || 'engaging'}
- Format: ${format || '9:16'} (${format === '9:16' ? 'TikTok/Reels/Shorts' : format === '16:9' ? 'YouTube' : 'Instagram square'})
- Script preview: "${narrationSummary}"

Generate a complete publishing package. Respond ONLY with a valid JSON object matching this exact schema — no preamble, no markdown, no explanation:

{
  "titles": [
    { "label": "High Curiosity", "title": "..." },
    { "label": "Question", "title": "..." },
    { "label": "How-To", "title": "..." },
    { "label": "SEO", "title": "..." },
    { "label": "Trending", "title": "..." },
    { "label": "Short", "title": "..." },
    { "label": "Long", "title": "..." },
    { "label": "Clickbait", "title": "..." },
    { "label": "Educational", "title": "..." },
    { "label": "Story", "title": "..." }
  ],
  "descShort": "One sentence, max 120 chars, hook-first",
  "descMedium": "3-4 sentences with natural keywords, value proposition",
  "descLong": "Full paragraph, 150-250 words, optimized for YouTube description with keywords woven in naturally",
  "hashtagsSmall": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "hashtagsMedium": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7"],
  "hashtagsLarge": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7"],
  "hashtagsMixed": ["#small1", "#medium1", "#large1", "#small2", "#medium2", "#large2", "#small3", "#medium3"],
  "keywordsPrimary": ["keyword1", "keyword2", "keyword3"],
  "keywordsSecondary": ["keyword4", "keyword5", "keyword6", "keyword7"],
  "keywordsLongtail": ["long tail phrase 1", "long tail phrase 2", "long tail phrase 3"],
  "keywordsClusters": [
    { "cluster": "Cluster Name", "terms": ["term1", "term2", "term3"] },
    { "cluster": "Cluster Name 2", "terms": ["term4", "term5", "term6"] }
  ],
  "thumbnails": [
    { "headline": "TEXT OVERLAY", "emotion": "shock/curiosity/fear/joy/awe", "color": "color palette direction", "placement": "subject placement description", "focus": "focal point description" },
    { "headline": "...", "emotion": "...", "color": "...", "placement": "...", "focus": "..." },
    { "headline": "...", "emotion": "...", "color": "...", "placement": "...", "focus": "..." },
    { "headline": "...", "emotion": "...", "color": "...", "placement": "...", "focus": "..." },
    { "headline": "...", "emotion": "...", "color": "...", "placement": "...", "focus": "..." }
  ],
  "scores": {
    "hook":         { "score": 8, "explanation": "..." },
    "curiosity":    { "score": 7, "explanation": "..." },
    "retention":    { "score": 8, "explanation": "..." },
    "seo":          { "score": 7, "explanation": "..." },
    "shareability": { "score": 6, "explanation": "..." },
    "novelty":      { "score": 7, "explanation": "..." }
  },
  "audience": {
    "age_range": "18-34",
    "interests": ["interest1", "interest2", "interest3"],
    "intent": "entertainment/education/inspiration/discovery",
    "best_time": "Best posting window e.g. Tuesday-Thursday 7-9pm EST"
  },
  "platforms": {
    "tiktok": {
      "title": "Optimized TikTok title (max 100 chars)",
      "description": "TikTok caption with hook + hashtags, max 150 chars",
      "hashtags": ["#tiktok1", "#tiktok2", "#tiktok3", "#tiktok4", "#tiktok5"],
      "cta": "Follow for more [niche] content"
    },
    "youtube_shorts": {
      "title": "YouTube Shorts title (max 100 chars, SEO optimized)",
      "description": "YouTube Shorts description with keywords",
      "hashtags": ["#Shorts", "#tag2", "#tag3"],
      "cta": "Subscribe for weekly [niche] videos"
    },
    "instagram_reels": {
      "title": "Instagram Reel caption hook",
      "description": "Full Instagram caption 125-150 chars before 'more' cutoff",
      "hashtags": ["#reels", "#tag2", "#tag3", "#tag4", "#tag5"],
      "cta": "Save this for later ✨"
    },
    "facebook_reels": {
      "title": "Facebook Reel title",
      "description": "Facebook-optimized description, conversational tone",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "cta": "Share with someone who needs to see this"
    }
  },
  "checklist": [
    { "item": "Strong opening hook", "passed": true, "note": "..." },
    { "item": "Clear pacing", "passed": true },
    { "item": "Caption friendly", "passed": true },
    { "item": "Loop potential", "passed": false, "note": "Consider ending on a cliffhanger" },
    { "item": "High curiosity gap", "passed": true },
    { "item": "Mobile friendly format", "passed": true },
    { "item": "Audio optimized", "passed": true },
    { "item": "Keyword in title", "passed": true }
  ],
  "suggestions": [
    { "type": "hook", "suggestion": "...", "priority": "high" },
    { "type": "title", "suggestion": "...", "priority": "medium" }
  ]
}`

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 3000,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      throw new Error(`Groq error ${groqRes.status}: ${errText}`)
    }

    const groqData = await groqRes.json()
    const raw = groqData.choices?.[0]?.message?.content || ''

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    let parsed: Omit<PublishPackage, 'projectId' | 'generatedAt'>

    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error('Failed to parse Groq response as JSON')
    }

    const pkg: PublishPackage = {
      projectId,
      generatedAt: new Date().toISOString(),
      ...parsed,
    }

    // Save to Supabase (non-blocking on failure)
    await savePackageToDb(pkg, userId).catch((e) =>
      console.warn('[publish/generate] DB save failed (non-fatal):', e.message)
    )

    return NextResponse.json({ package: pkg })
  } catch (err: any) {
    console.error('[publish/generate] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate publish package' }, { status: 500 })
  }
}

async function savePackageToDb(pkg: PublishPackage, userId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const db = getSupabaseAdmin()

  await db.from('publish_packages').upsert({
    project_id:          pkg.projectId,
    clerk_user_id:       userId,
    titles_json:         pkg.titles,
    desc_short:          pkg.descShort,
    desc_medium:         pkg.descMedium,
    desc_long:           pkg.descLong,
    hashtags_small:      pkg.hashtagsSmall,
    hashtags_medium:     pkg.hashtagsMedium,
    hashtags_large:      pkg.hashtagsLarge,
    hashtags_mixed:      pkg.hashtagsMixed,
    keywords_primary:    pkg.keywordsPrimary,
    keywords_secondary:  pkg.keywordsSecondary,
    keywords_longtail:   pkg.keywordsLongtail,
    keywords_clusters:   pkg.keywordsClusters,
    thumbnails_json:     pkg.thumbnails,
    scores_json:         pkg.scores,
    audience_json:       pkg.audience,
    platforms_json:      pkg.platforms,
    checklist_json:      pkg.checklist,
    suggestions_json:    pkg.suggestions,
    generated_at:        pkg.generatedAt,
    updated_at:          new Date().toISOString(),
  }, { onConflict: 'project_id' })
}
