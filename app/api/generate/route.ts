import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getTemplate,
  getDefaultTemplate,
  buildSystemPersona,
  buildBeatInstructions,
  type ViralTemplate,
} from '@/lib/templates'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateRequest {
  niche: string
  customTopic?: string
  format: '9:16' | '16:9' | '1:1'
  duration: '30' | '60' | '90'
  tone: string
  captionStyle: string
  voice: string
  imageEngine: string
  templateId?: string   // Step 8 — optional, falls back to legacy behaviour
}

export interface SceneDirector {
  scene_number: number
  arc_beat: string
  narration: string
  image_prompt: string
  environment: string
  subject: string
  emotion: string
  lighting: string
  camera_movement: string
  visual_objective: string
  duration_seconds: number
}

export interface Character {
  name: string
  role: string
  visual_identity: string
  appears_in_scenes: number[]
}

export interface StoryArc {
  beat_1_hook: string
  beat_2_setup: string
  beat_3_tension: string
  beat_4_turn: string
  beat_5_revelation: string
  beat_6_payoff: string
  beat_7_cta: string
}

export interface GenerateResponse {
  title: string
  story_arc: StoryArc
  characters: Character[]
  scenes: SceneDirector[]
  total_duration: number
  niche: string
  format: string
  tone: string
  templateId?: string
}

// ─── Camera movement vocabulary (ported from legacy getCameraMove) ──────────

const CAMERA_MOVES = {
  wide_reveal: 'slow zoom-out from center, revealing full environment',
  intimacy_push: 'slow dolly-in toward subject face, tightening frame',
  reveal_pan: 'lateral pan left-to-right revealing scene elements',
  tension_creep: 'imperceptible slow zoom-in building unease',
  hero_rise: 'low angle tilt-up, subject grows in frame',
  memory_drift: 'gentle drift right with soft rack focus',
  chaos_shake: 'subtle handheld wobble, energy and urgency',
  clarity_lock: 'locked-off static shot, truth and certainty',
  perspective_shift: 'rotate 15° while zooming out, reframing reality',
  emotional_hold: 'ultra-slow zoom-in 5% over full duration, meditation',
}

function getCameraMove(beat: string): string {
  const map: Record<string, keyof typeof CAMERA_MOVES> = {
    hook: 'wide_reveal',
    cold_open: 'wide_reveal',
    setup: 'tension_creep',
    context: 'tension_creep',
    tension: 'chaos_shake',
    conflict: 'chaos_shake',
    turn: 'perspective_shift',
    revelation: 'reveal_pan',
    payoff: 'hero_rise',
    legacy: 'emotional_hold',
    cta: 'clarity_lock',
  }
  return CAMERA_MOVES[map[beat] ?? 'clarity_lock']
}

// ─── Scene count by duration ──────────────────────────────────────────────────

function sceneCount(duration: string, template?: ViralTemplate): number {
  if (template?.sceneCountOverride) return template.sceneCountOverride
  return duration === '30' ? 3 : duration === '60' ? 7 : 10
}

// ─── Build Groq prompt — template-aware ──────────────────────────────────────

function buildPrompt(req: GenerateRequest, template: ViralTemplate): string {
  const topic =
    req.niche === 'custom' ? req.customTopic : nicheLabel(req.niche)
  const numScenes = sceneCount(req.duration, template)
  const secPerScene = Math.floor(parseInt(req.duration) / numScenes)
  const beatInstructions = buildBeatInstructions(template)

  // Build dynamic story_arc keys from template beats
  const arcKeys = template.beats
    .map((beat, i) => `    "beat_${i + 1}_${beat}": "Single sentence for the ${beat} beat"`)
    .join(',\n')

  return `Generate a complete video script for the "${template.label}" format.

TOPIC: ${topic}
FORMAT: ${req.format} (${req.format === '9:16' ? 'TikTok/Reels vertical' : req.format === '16:9' ? 'YouTube widescreen' : 'Instagram square'})
DURATION: ${req.duration} seconds total
SCENES: ${numScenes} scenes × ~${secPerScene}s each
TONE: ${template.tone}
VISUAL STYLE: ${template.visualStyle}
CAMERA VOCABULARY: ${template.cameraVocabulary}
LIGHTING: ${template.lightingNote}

OUTPUT: Respond with ONLY a valid JSON object. No markdown. No preamble. No explanation.

JSON schema:
{
  "title": "Punchy video title matching the ${template.label} format (no quotes, no colons)",
  "story_arc": {
${arcKeys}
  },
  "characters": [
    {
      "name": "Character name or 'Narrator' if voiceover-only",
      "role": "protagonist | antagonist | narrator | expert",
      "visual_identity": "Locked physical description: gender, age range, clothing, hair, expression. Used verbatim in every scene image prompt.",
      "appears_in_scenes": [1, 2, 3]
    }
  ],
  "scenes": [
    {
      "scene_number": 1,
      "arc_beat": "${template.beats[0]}",
      "narration": "Spoken narration for this scene. Natural ${template.tone} tone. ~${secPerScene * 2} words.",
      "image_prompt": "${template.visualStyle} — describe environment, lighting (${template.lightingNote}), subject (use character visual_identity verbatim if applicable), camera angle, color palette, emotional atmosphere. No text overlays.",
      "environment": "Interior/exterior location",
      "subject": "Main visual subject",
      "emotion": "Primary emotion",
      "lighting": "Specific lighting style",
      "camera_movement": "Ken Burns move from vocabulary: ${template.cameraVocabulary}",
      "visual_objective": "What this image must make the viewer feel or understand",
      "duration_seconds": ${secPerScene}
    }
    // ... repeat for all ${numScenes} scenes
  ],
  "total_duration": ${req.duration},
  "niche": "${req.niche}",
  "format": "${req.format}",
  "tone": "${template.tone}"
}

SCENE RULES:
- Scene 1 beat: ${template.beats[0]} — ${template.beatNotes[template.beats[0]] ?? 'Strong opening.'}
- ${template.pacingNote}
- Each scene's narration flows naturally into the next.
- image_prompt must be fully self-contained — no references to other scenes.
- Characters must have locked visual identities used verbatim in every image_prompt.
- Camera moves must come from vocabulary: ${template.cameraVocabulary}
- Beat assignments (follow exactly):
${beatInstructions}
- Total narration word count target: ${Math.round(parseInt(req.duration) * 2.5)} words

Generate the full ${numScenes}-scene script now.`
}

function nicheLabel(niche: string): string {
  const map: Record<string, string> = {
    'money-psychology': 'The psychology of money and financial behavior',
    productivity: 'Productivity systems and peak performance',
    'health-fitness': 'Health, fitness, and longevity',
    relationships: 'Relationships, human connection, and communication',
    business: 'Business strategy and entrepreneurship',
    philosophy: 'Philosophy, stoicism, and the examined life',
    'tech-ai': 'Technology, AI, and the future',
    'true-crime': 'True crime and criminal psychology',
    history: 'Hidden history and forgotten stories',
    science: 'Science and the nature of reality',
  }
  return map[niche] ?? niche
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY not configured. Add it to .env.local.' },
      { status: 500 }
    )
  }

  let body: GenerateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { niche, customTopic, format, duration, tone } = body

  if (!niche || !format || !duration || !tone) {
    return NextResponse.json(
      { error: 'Missing required fields: niche, format, duration, tone' },
      { status: 400 }
    )
  }

  if (niche === 'custom' && !customTopic?.trim()) {
    return NextResponse.json(
      { error: 'Custom topic is required when niche is "custom"' },
      { status: 400 }
    )
  }

  // Resolve template — fall back to tiktok-story (default) if none provided
  const template = (body.templateId ? getTemplate(body.templateId) : undefined) ?? getDefaultTemplate()
  const systemPersona = buildSystemPersona(template)
  const prompt = buildPrompt(body, template)

  let groqResponse: Response
  try {
    groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.85,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPersona },
          { role: 'user', content: prompt },
        ],
      }),
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reach Groq API. Check your network.' },
      { status: 502 }
    )
  }

  if (!groqResponse.ok) {
    const errBody = await groqResponse.text()
    console.error('Groq API error:', groqResponse.status, errBody)
    return NextResponse.json(
      { error: `Groq API error ${groqResponse.status}. Check your GROQ_API_KEY.` },
      { status: 502 }
    )
  }

  const groqData = await groqResponse.json()
  const rawContent = groqData.choices?.[0]?.message?.content

  if (!rawContent) {
    return NextResponse.json(
      { error: 'Groq returned an empty response.' },
      { status: 500 }
    )
  }

  let parsed: GenerateResponse
  try {
    const clean = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    parsed = JSON.parse(clean)
  } catch {
    console.error('JSON parse failed. Raw response:', rawContent)
    return NextResponse.json(
      { error: 'Groq response was not valid JSON. Try again.' },
      { status: 500 }
    )
  }

  // Inject camera moves from template vocabulary if scene is missing one
  if (parsed.scenes) {
    parsed.scenes = parsed.scenes.map((scene) => ({
      ...scene,
      camera_movement: scene.camera_movement || getCameraMove(scene.arc_beat),
    }))
  }

  // Attach templateId to response for library display
  parsed.templateId = template.id

  return NextResponse.json(parsed)
}
