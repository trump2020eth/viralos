/**
 * ViralOS Template System — Step 8
 *
 * Templates control the ENTIRE generation pipeline:
 *   - Script structure + beat assignment
 *   - Storyboard generation tone + scene direction
 *   - Caption style
 *   - Visual style + image prompt prefix
 *   - Camera movement vocabulary
 *   - Voice selection
 *   - Scene pacing (scene count override)
 *
 * Templates are never cosmetic-only.
 */

export interface ViralTemplate {
  id: string
  label: string
  emoji: string
  category: 'storytelling' | 'education' | 'entertainment' | 'motivation'
  description: string

  // ── Pipeline controls ─────────────────────────────────────────────────────
  /** Recommended aspect ratio */
  defaultFormat: '9:16' | '16:9' | '1:1'
  /** Recommended duration in seconds */
  defaultDuration: '30' | '60' | '90'
  /** Default voice ID from VOICE_CATALOG */
  defaultVoice: string
  /** Caption style preset */
  captionStyle: string
  /** Scene count — overrides duration-based default when set */
  sceneCountOverride?: number

  // ── Prompt controls ───────────────────────────────────────────────────────
  /** Injected as TONE line in the prompt */
  tone: string
  /** System persona — replaces the generic "ViralOS Scene Director" persona */
  systemPersona: string
  /** Beat sequence — controls story structure */
  beats: string[]
  /** Per-beat director notes injected into the prompt */
  beatNotes: Record<string, string>
  /** Injected as IMAGE STYLE prefix for every image_prompt */
  visualStyle: string
  /** Camera movement vocabulary — comma-separated preferred moves */
  cameraVocabulary: string
  /** Pacing note injected into scene rules */
  pacingNote: string
  /** Lighting note injected into scene rules */
  lightingNote: string
}

// ─── Beat pools ────────────────────────────────────────────────────────────

const BEATS_STANDARD_7 = [
  'hook', 'setup', 'tension', 'turn', 'revelation', 'payoff', 'cta',
]

const BEATS_DOCUMENTARY = [
  'cold_open', 'context', 'witness', 'evidence', 'conflict', 'resolution', 'legacy',
]

const BEATS_REDDIT = [
  'hook', 'background', 'incident', 'escalation', 'twist', 'verdict', 'cta',
]

const BEATS_TRUE_CRIME = [
  'cold_open', 'victim', 'crime', 'investigation', 'suspect', 'revelation', 'aftermath',
]

const BEATS_HISTORY_CHANNEL = [
  'hook', 'era_context', 'key_figure', 'turning_point', 'consequence', 'modern_parallel', 'cta',
]

const BEATS_AI_NEWS = [
  'breaking_hook', 'what_happened', 'why_it_matters', 'expert_reaction', 'implications', 'cta',
]

const BEATS_MOTIVATION = [
  'pain_hook', 'common_mistake', 'truth_bomb', 'framework', 'evidence', 'challenge', 'cta',
]

const BEATS_EXPLAINER = [
  'problem_hook', 'stakes', 'concept_intro', 'deep_dive', 'example', 'summary', 'cta',
]

const BEATS_TIKTOK_STORY_30 = ['hook', 'revelation', 'cta']

// ─── Template catalog ──────────────────────────────────────────────────────

export const TEMPLATES: ViralTemplate[] = [
  // ── TikTok Story ──────────────────────────────────────────────────────────
  {
    id: 'tiktok-story',
    label: 'TikTok Story',
    emoji: '📱',
    category: 'entertainment',
    description: 'Fast-cut vertical story for TikTok and Reels. Maximum hook energy.',
    defaultFormat: '9:16',
    defaultDuration: '30',
    defaultVoice: 'kokoro-en-f',
    captionStyle: 'tiktok-v2',
    sceneCountOverride: 3,
    tone: 'punchy, fast, conversational — every sentence earns viewer attention',
    systemPersona: 'You are a TikTok native creator who has gone viral 50+ times. You write for the scroll. Every word must justify its existence.',
    beats: BEATS_TIKTOK_STORY_30,
    beatNotes: {
      hook: 'The scroll-stopper. First 2 seconds = make or break. Bold claim or shocking visual.',
      revelation: 'The payoff they stayed for. Fast, punchy, satisfying.',
      cta: 'Follow or comment prompt. One clear action.',
    },
    visualStyle: 'Bold, high-contrast, mobile-first composition. Subject fills 80% of frame. Vivid saturated colors. Close-up preferred.',
    cameraVocabulary: 'tight close-up zoom-in, rapid snap-zoom, handheld energy, Dutch angle for drama',
    pacingNote: 'Maximum 10 seconds per scene. Every scene must visually hook in first frame.',
    lightingNote: 'High contrast, backlit rim light or vivid neon — theatrical and eye-catching.',
  },

  // ── Documentary ───────────────────────────────────────────────────────────
  {
    id: 'documentary',
    label: 'Documentary',
    emoji: '🎬',
    category: 'storytelling',
    description: 'Cinematic documentary style. Cold open → evidence → resolution.',
    defaultFormat: '16:9',
    defaultDuration: '90',
    defaultVoice: 'kokoro-en-m',
    captionStyle: 'minimal',
    tone: 'measured, authoritative, cinematic — National Geographic meets Netflix',
    systemPersona: 'You are a documentary filmmaker with credits on Netflix and HBO. You write for emotional impact and intellectual depth. Every scene has a reason to exist.',
    beats: BEATS_DOCUMENTARY,
    beatNotes: {
      cold_open: 'In medias res — drop the viewer into the most dramatic moment. Then cut to TITLE.',
      context: 'Set the world. Time, place, stakes. Ground the viewer before the journey.',
      witness: 'A human voice — interview, testimony, or first-person account.',
      evidence: 'Hard facts, data, or archival material presented cinematically.',
      conflict: 'The core tension or mystery that drives the story forward.',
      resolution: 'What happened. How it ended. The truth revealed.',
      legacy: 'What it means for the viewer, humanity, or the future.',
    },
    visualStyle: 'Cinematic widescreen. Natural or dramatic side lighting. Film grain texture. Shallow depth of field. Desaturated realism with warm grade.',
    cameraVocabulary: 'wide establishing shot, slow dolly-in, locked-off tripod, slow lateral push, aerial-style pull-back',
    pacingNote: 'Longer scenes allowed. Let images breathe. Narration pacing is deliberate and unhurried.',
    lightingNote: 'Natural light preferred. Golden hour, overcast diffused, or dramatic side-light. Avoid artificial-looking setups.',
  },

  // ── True Crime ────────────────────────────────────────────────────────────
  {
    id: 'true-crime',
    label: 'True Crime',
    emoji: '🔍',
    category: 'storytelling',
    description: 'Dark, immersive true crime narrative. Evidence → suspect → truth.',
    defaultFormat: '16:9',
    defaultDuration: '90',
    defaultVoice: 'kokoro-en-f',
    captionStyle: 'tiktok-v2',
    tone: 'suspenseful, investigative, serious — no sensationalism, respect for victims',
    systemPersona: 'You are a true crime journalist and documentarian. You write with forensic accuracy and emotional restraint. You follow the evidence.',
    beats: BEATS_TRUE_CRIME,
    beatNotes: {
      cold_open: 'Open on the day everything changed. Specific date, location, ordinary moment before.',
      victim: 'Humanize the victim. Who they were — not just what happened to them.',
      crime: 'What happened. Clinical, factual, no gratuitous detail.',
      investigation: 'How the case unfolded. Key investigators, dead ends, breakthroughs.',
      suspect: 'Who, why, how they were identified.',
      revelation: 'The key evidence or confession that broke the case.',
      aftermath: 'Justice, sentencing, what changed after.',
    },
    visualStyle: 'Dark, moody, desaturated. Crime scene lighting. Shadows and silhouettes. Documentary-realism. No graphic violence.',
    cameraVocabulary: 'slow menacing dolly-in, overhead surveillance angle, dark narrow corridor push, frozen wide establishing, tension-creep zoom',
    pacingNote: 'Slow burn pacing. Build dread gradually. Each scene adds one piece of the puzzle.',
    lightingNote: 'Low-key lighting. High contrast shadows. Harsh overhead or single-source light. Blue or teal night tones.',
  },

  // ── History Channel ───────────────────────────────────────────────────────
  {
    id: 'history-channel',
    label: 'History Channel',
    emoji: '📜',
    category: 'education',
    description: 'Epic historical narrative. Hidden stories from the past.',
    defaultFormat: '16:9',
    defaultDuration: '90',
    defaultVoice: 'kokoro-en-m',
    captionStyle: 'minimal',
    tone: 'epic, gravitas-driven, revelatory — this moment changed everything',
    systemPersona: 'You are a historian and documentarian. You find the hidden human drama inside historical events. You write for viewers who thought history was boring until they watched your work.',
    beats: BEATS_HISTORY_CHANNEL,
    beatNotes: {
      hook: 'A detail about this historical period so surprising that no one believes it until you prove it.',
      era_context: 'Immerse the viewer in the world as it was. Sounds, smells, power structures.',
      key_figure: 'One human being whose choice shaped what followed.',
      turning_point: 'The exact moment history pivoted. What happened in those seconds.',
      consequence: 'The ripple effects. What changed because of this moment.',
      modern_parallel: 'Why this 500-year-old event explains something happening today.',
      cta: 'The provocative question this history leaves unanswered.',
    },
    visualStyle: 'Epic and cinematic. Painterly quality — like the works of Rembrandt or Jacques-Louis David come to life. Rich earth tones, dramatic chiaroscuro lighting.',
    cameraVocabulary: 'epic wide shot pull-back, heroic low-angle tilt-up, slow deliberate pan across landscape, intimate push toward subject face',
    pacingNote: 'Build grandeur slowly. Each scene is a painting that moves. Narration is epic and measured.',
    lightingNote: 'Painterly chiaroscuro. Candlelight, fire, or God-rays. Rich warm golds and deep shadows.',
  },

  // ── AI News ───────────────────────────────────────────────────────────────
  {
    id: 'ai-news',
    label: 'AI News',
    emoji: '🤖',
    category: 'education',
    description: 'Breaking AI and tech news format. Fast, authoritative, future-focused.',
    defaultFormat: '9:16',
    defaultDuration: '60',
    defaultVoice: 'kokoro-en-m',
    captionStyle: 'tiktok-v2',
    sceneCountOverride: 6,
    tone: 'authoritative, informed, urgency — this is happening now and it matters',
    systemPersona: 'You are a senior AI researcher and tech journalist. You explain complex AI developments in plain language without dumbing them down. You understand why things matter.',
    beats: BEATS_AI_NEWS,
    beatNotes: {
      breaking_hook: 'The announcement or development in one sentence. Make it feel urgent.',
      what_happened: 'The facts. What was released, announced, or discovered.',
      why_it_matters: 'The real significance. Not just the headline — the implications.',
      expert_reaction: 'How the AI research community or industry is responding.',
      implications: 'What this means for the next 6-12 months.',
      cta: 'A question or provocation that gets viewers to comment.',
    },
    visualStyle: 'Futuristic tech aesthetic. Neural network visualizations, glowing interfaces, data streams. Dark background with neon accent colors. Clean and precise.',
    cameraVocabulary: 'digital zoom-in to code/data, smooth orbital around 3D object, clean lateral push, precision lock-off',
    pacingNote: 'Fast but clear. No scene exceeds 12 seconds. Information density is high but digestible.',
    lightingNote: 'Dark background with neon blue, purple or cyan accent lighting. LED strip light aesthetic. High tech.',
  },

  // ── Reddit Story ──────────────────────────────────────────────────────────
  {
    id: 'reddit-story',
    label: 'Reddit Story',
    emoji: '🔴',
    category: 'entertainment',
    description: 'AITA / confession / revenge story format. Relatable drama, satisfying arc.',
    defaultFormat: '9:16',
    defaultDuration: '60',
    defaultVoice: 'kokoro-en-f',
    captionStyle: 'tiktok-v2',
    tone: 'conversational, slightly exasperated, relatable — telling a story to a friend',
    systemPersona: 'You write viral Reddit-style stories. You understand the AITA formula: set up the characters, escalate the drama, deliver the twist, let the audience judge. Relatable protagonist always.',
    beats: BEATS_REDDIT,
    beatNotes: {
      hook: 'Open with the most outrageous sentence in the story. Do not start at the beginning.',
      background: 'Quick character setup. Who they are and why we care.',
      incident: 'What happened. The specific moment that caused the drama.',
      escalation: 'How it got worse. The other party\'s reaction or the spiral.',
      twist: 'The detail that changes how we see the whole situation.',
      verdict: 'The judgment or resolution. Was the protagonist the villain or the hero?',
      cta: 'Ask the audience: what would you have done?',
    },
    visualStyle: 'Relatable, modern, slightly dramatic. Real-world interiors. Kitchen, bedroom, workplace. Cinematic but grounded.',
    cameraVocabulary: 'intimate push toward face, reaction shot zoom, handheld shaky for conflict, static for verdict',
    pacingNote: 'Conversational rhythm. Pause for impact. The twist scene gets extra time.',
    lightingNote: 'Natural room lighting. Warm interiors. Sometimes one dramatic shadow for conflict scenes.',
  },

  // ── Motivation ────────────────────────────────────────────────────────────
  {
    id: 'motivation',
    label: 'Motivation',
    emoji: '🔥',
    category: 'motivation',
    description: 'High-energy motivational content. Mindset shifts and actionable frameworks.',
    defaultFormat: '9:16',
    defaultDuration: '60',
    defaultVoice: 'kokoro-en-m',
    captionStyle: 'tiktok-v2',
    tone: 'electrifying, direct, no-fluff — challenge the viewer to be better',
    systemPersona: 'You are a performance coach who has worked with world-class athletes and CEOs. You do not coddle. You tell uncomfortable truths with precision and respect.',
    beats: BEATS_MOTIVATION,
    beatNotes: {
      pain_hook: 'Start with the pain the viewer already feels. Validate before you challenge.',
      common_mistake: 'The thing 95% of people do wrong. Name it without shame.',
      truth_bomb: 'The uncomfortable truth that reframes everything.',
      framework: 'The 3-step or single core insight that changes the behavior.',
      evidence: 'One example — athlete, CEO, or psychological study — that proves it.',
      challenge: 'A specific, doable challenge for the next 24 hours.',
      cta: 'Comment if you\'re starting today. Creates community.',
    },
    visualStyle: 'High energy, cinematic, aspirational. Athletes, sunrise, peak performance visuals. Bold and epic. Golden hour or dramatic side-light.',
    cameraVocabulary: 'hero low-angle tilt-up, sunrise wide reveal, slow-motion achievement shot, face close-up for intensity',
    pacingNote: 'Energy builds across the video. Starts grounded, ends explosive. Never drop the intensity after the hook.',
    lightingNote: 'Golden hour, sunrise, or dramatic side-lighting. Warm, powerful, aspirational. Like an athlete\'s highlight reel.',
  },

  // ── Business Explainer ────────────────────────────────────────────────────
  {
    id: 'business-explainer',
    label: 'Business Explainer',
    emoji: '📈',
    category: 'education',
    description: 'Clear business concept or case study. Credible, structured, valuable.',
    defaultFormat: '16:9',
    defaultDuration: '90',
    defaultVoice: 'kokoro-en-m',
    captionStyle: 'minimal',
    tone: 'credible, analytical, value-dense — every sentence teaches something',
    systemPersona: 'You are a business professor, McKinsey consultant, and podcast host rolled into one. You explain complex business concepts with clarity, evidence, and narrative.',
    beats: BEATS_EXPLAINER,
    beatNotes: {
      problem_hook: 'Open with the expensive mistake or misconception. Make the viewer feel it.',
      stakes: 'Who this affects and what it costs them in money, time, or opportunity.',
      concept_intro: 'Name the framework or concept clearly. One sentence definition.',
      deep_dive: 'The mechanics. How it actually works.',
      example: 'A real company or person who applied this — what happened.',
      summary: 'The 3-point takeaway they can use this week.',
      cta: 'Save this. Follow for more. Specific and honest.',
    },
    visualStyle: 'Clean, professional, modern. Corporate but not sterile. Whiteboards, offices, data visualizations, real-world business environments.',
    cameraVocabulary: 'clean lateral push, wide boardroom shot, close-up on data or whiteboard, smooth dolly-in for emphasis',
    pacingNote: 'Measured and clear. Each concept gets space to land. No rushing through the deep-dive.',
    lightingNote: 'Studio quality or bright natural. Clean, sharp, professional. White or neutral backgrounds.',
  },

  // ── Faceless YouTube ──────────────────────────────────────────────────────
  {
    id: 'faceless-youtube',
    label: 'Faceless YouTube',
    emoji: '🎯',
    category: 'education',
    description: 'Long-form faceless YouTube format. Research-heavy, narration-driven.',
    defaultFormat: '16:9',
    defaultDuration: '90',
    defaultVoice: 'kokoro-en-m',
    captionStyle: 'minimal',
    tone: 'researched, engaging, slightly conspiratorial — the kind of video people watch at 2am',
    systemPersona: 'You create faceless YouTube videos that get 2M views. You know how to keep people watching through a 10-minute video with nothing but narration and visuals. Your pacing is masterful.',
    beats: BEATS_DOCUMENTARY,
    beatNotes: {
      cold_open: 'The most interesting moment in the story. Drop viewers in. Then pull back to explain.',
      context: 'World-building. Make the viewer understand the time, stakes, and players.',
      witness: 'The human element. A personal story or case study that grounds the research.',
      evidence: 'The data, studies, or expert quotes that make this credible.',
      conflict: 'The surprising contradiction or controversy that deepens the mystery.',
      resolution: 'The answer, or why there isn\'t one.',
      legacy: 'What this means for the viewer personally. The takeaway they can use.',
    },
    visualStyle: 'Cinematic stock-footage aesthetic. B-roll heavy. Wide establishing shots of cities, nature, archives. High production value.',
    cameraVocabulary: 'wide establishing pull-back, archival-style static lock, slow aerial drift, cinematic forward push',
    pacingNote: 'Deliberate and researched. 12-15 seconds per scene. Narration is the star — visuals support it.',
    lightingNote: 'Varied and naturalistic. Match the emotional tone of each scene: dark for tension, bright for revelation.',
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────

export function getTemplate(id: string): ViralTemplate | undefined {
  return TEMPLATES.find(t => t.id === id)
}

export function getDefaultTemplate(): ViralTemplate {
  return TEMPLATES.find(t => t.id === 'tiktok-story')!
}

export function getTemplatesByCategory(): Record<string, ViralTemplate[]> {
  const grouped: Record<string, ViralTemplate[]> = {}
  for (const t of TEMPLATES) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push(t)
  }
  return grouped
}

/** Build the system persona string for Groq */
export function buildSystemPersona(template: ViralTemplate): string {
  return `${template.systemPersona}

You are producing content in the "${template.label}" format.
Visual style: ${template.visualStyle}
Camera vocabulary: ${template.cameraVocabulary}
Pacing: ${template.pacingNote}
Lighting: ${template.lightingNote}

You respond ONLY with valid JSON. No markdown. No explanation. No preamble.`
}

/** Build beat instructions string for injection into the prompt */
export function buildBeatInstructions(template: ViralTemplate): string {
  return template.beats
    .map((beat, i) => {
      const note = template.beatNotes[beat] ?? ''
      return `Scene ${i + 1} = ${beat}${note ? ` — ${note}` : ''}`
    })
    .join('\n')
}
