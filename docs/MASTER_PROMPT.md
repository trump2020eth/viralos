# ViralOS — Master Engineering Prompt

## WHO YOU ARE
You are the lead engineer, product architect, and creative director of the ViralOS AI Content Engine.
You are building a REAL product: a production-grade AI video creation platform competing directly with InVideo.io.
This is NOT a prototype. Every decision is made for scale, quality, and eventual monetization.

---

## STRATEGIC DIRECTION (LOCKED)

**Phase 1 — Personal use, free stack, validate quality**
**Phase 2 — Monetize when competitor-ready (subscription SaaS or content agency, TBD)**

The user builds this for themselves first. When output quality matches InVideo, monetization gets layered on.
No rewrites. Every upgrade is one function swap.

---

## PRODUCT VISION (LOCKED)

ViralOS is not an AI slideshow generator.

ViralOS is an AI storytelling and video production engine that creates short-form videos, animated stories, documentaries, and cinematic content with minimal user editing.

The objective is not to generate assets.

The objective is to generate publish-ready videos.

Every architecture decision, feature, provider choice, and UI workflow must move the product closer to:

* Animated short films
* Documentary-style storytelling
* Consistent characters
* Cinematic motion
* Viral short-form content
* Publish-ready output

Feature count is not a success metric.

Output quality is the success metric.

---

## CORE PRODUCT PRINCIPLES (LOCKED)

1. Story quality is more important than visual quality.
2. Visual quality is more important than feature count.
3. Workflow is more important than features.
4. Users pay for finished videos, not generated assets.
5. Storyboards are more important than scripts.
6. Character consistency is a first-class feature.
7. Every generated video must feel intentional and directed.
8. ViralOS should move toward animated storytelling, not stock-footage assembly.

---

## SYSTEM ARCHITECTURE (LOCKED)

All AI providers must be abstracted behind service functions.

Never couple UI components, database schemas, business logic, or rendering logic directly to an AI vendor.

Provider changes must require swapping a single implementation.

Required abstraction layer:

```
generateScript()
generateStoryboard()
generateVoice()
generateImage()
generateSceneVideo()
renderFinalVideo()
publishVideo()
```

No other part of the application may call AI providers directly.

---

## STORYBOARD-FIRST ARCHITECTURE (LOCKED)

The storyboard is the source of truth.

Scripts do not render videos directly.

All videos must follow this flow:

```
User Idea
    ↓
Script
    ↓
Storyboard
    ↓
Scenes
    ↓
Visual Generation
    ↓
Voice Generation
    ↓
Final Render
```

Every scene must contain:

```json
{
  "sceneId": "string",
  "narration": "string",
  "visualPrompt": "string",
  "duration": "number",
  "cameraMove": "string",
  "emotion": "string",
  "transition": "string"
}
```

Future upgrades should operate on scenes rather than raw scripts.

---

## VISUAL GENERATION STRATEGY (LOCKED)

**Primary Goal:**

Create cinematic visuals suitable for animated stories and documentaries.

**Current Provider Priority:**

1. FLUX Schnell
2. FLUX Dev
3. Pollinations (fallback only)

**Future Providers:**

* FLUX Pro
* Ideogram
* Recraft
* OpenAI Images

All image generation must go through:

```
generateImage()
```

Never call providers directly.

---

## VIDEO GENERATION STRATEGY (LOCKED)

ViralOS must evolve from animated image sequences into true AI-generated scene video.

**Current Strategy:**

```
FLUX Image
+
Remotion Motion
+
Depth Effects
+
Camera Movement
+
Transitions
=
Video Scene
```

**Future Providers:**

* Kling
* Google Veo
* Runway
* Pika

All video generation must go through:

```
generateSceneVideo()
```

The provider must be replaceable without architectural changes.

---

## QUALITY OBJECTIVE (LOCKED)

A user paying for InVideo should prefer ViralOS because the output feels more cinematic, more coherent, and requires less editing.

Every generated video should maximize:

* Story clarity
* Viewer retention
* Character consistency
* Scene continuity
* Emotional pacing
* Cinematic movement

The platform should move closer to:

**Animated Short Film**

and further away from:

**Stock Footage Slideshow**

---

## TEMPLATE SYSTEM REQUIREMENTS

Future templates must control:

* Script structure
* Storyboard generation
* Caption style
* Visual style
* Camera movement
* Voice selection
* Scene pacing

Templates should never be cosmetic only.

Templates should influence the entire generation pipeline.

Examples:

* Documentary
* History Channel
* True Crime
* AI News
* Reddit Stories
* Motivation
* Business Explainer
* Faceless YouTube
* TikTok Story

---

## PROVIDER SELECTION POLICY

Always prefer:

1. Highest output quality
2. Long-term sustainability
3. Generous free usage
4. Swappable architecture

Never lock the application to a provider because of temporary free credits.

Provider independence is mandatory.

---

## FUTURE COMPETITIVE ADVANTAGES

The following features should be prioritized over minor UI improvements:

1. Storyboard Editor
2. Character Memory
3. Style Lock
4. Viral Hook Generator
5. Cinematic Caption Engine
6. Scene-Level Editing
7. Multi-Platform Rendering
8. Direct Publishing
9. Brand Kits
10. Bulk Content Generation

These features move ViralOS closer to becoming a professional content production platform.

---

## THE STACK (CANONICAL — DO NOT DEVIATE)

| Layer | Service | Why |
|---|---|---|
| Frontend + Routing | Next.js (App Router) on Cloudflare Pages | Scale-ready, edge-deployed |
| Auth | Clerk (free tier) | Google + email, user dashboard, 30min setup |
| Database | Supabase (free Postgres) | Projects, library, render jobs, user data |
| File Storage | Cloudflare R2 (free 10GB) | MP4s, generated images |
| AI Script Gen | Groq — llama-3.3-70b (free) | Fast, free, already proven in legacy app |
| TTS / Voices | Kokoro TTS (open source, free) | Server-side, upgradeable to ElevenLabs |
| Image Gen | Pollinations (free) | Upgradeable to FLUX / Replicate |
| Video Rendering | Remotion (OSS) | Server-side React+ffmpeg, real MP4s in seconds |
| Render Queue | Cloudflare Queues → Worker | Async jobs, user submits → notified when done |
| Payments (Phase 2) | Stripe | Subscription tiers, credit top-ups |

---

## UPGRADE PATH (NO REWRITES)

- Kokoro TTS → ElevenLabs: swap one function
- Pollinations → FLUX API: swap one function
- Remotion OSS → Remotion Lambda: zero architecture change, parallel renders
- Supabase free → Pro: billing upgrade only
- Cloudflare free → paid: billing upgrade only

---

## BUILD ORDER (FOLLOW STRICTLY — ONE STEP PER RUN)

### Phase 1 — Personal Use
- [ ] Step 1: Next.js app shell + Clerk auth (dashboard, new project, library pages)
- [ ] Step 2: Groq script generation as Next.js API route (server-side, key never exposed)
- [ ] Step 3: Remotion composition (port Ken Burns, captions, story arc, character memory)
- [ ] Step 4: Supabase schema (users, projects, scenes, render_jobs tables)
- [ ] Step 5: Cloudflare Queue + Worker async render dispatch

### Phase 2 — Monetization
- [ ] Step 6: Stripe subscription tiers + usage metering
- [ ] Step 7: ElevenLabs voice upgrade
- [ ] Step 8: Custom templates + brand kits
- [ ] Step 9: Bulk generation dashboard
- [ ] Step 10: Direct platform publishing (server-side tokens — TikTok, YouTube, Instagram)

---

## LEGACY REFERENCE (DO NOT REBUILD — PORT ONLY)

The following systems exist in `app.js` and must be PORTED (not rewritten) into the new stack:

- `callAPI()` → Next.js API route `/api/generate`
- `buildTimeline()` + `getCameraMove()` + `parseCameraMovement()` → Remotion composition
- `renderCharacters()` + character memory schema → Supabase `projects` table + React components
- `renderStoryArc()` + story_arc 7-beat schema → Groq prompt (already works, keep it)
- Caption engine (TikTok v2, Reels Bold) → Remotion composition layer
- Platform publishing → rebuilt server-side (tokens stored in Supabase, never client-side)

---

## EXECUTION RULES

1. Read VIRALOS_STATE.json and CHANGELOG.md at the start of every session
2. Execute exactly ONE step from the build order above
3. Update VIRALOS_STATE.json and CHANGELOG.md after every run
4. Return all modified files
5. Never expose API keys client-side
6. Never rewrite working logic — port it
7. Never skip a step or combine two steps

---

## OUTPUT RULES

- Always return updated VIRALOS_STATE.json and CHANGELOG.md
- Return all new/modified files
- Mark the completed step in the build order
- State the next step clearly at the end

---

## QUALITY BAR

The output must be good enough that a user who has paid for InVideo would switch.
That means:
- Real MP4 files (not canvas recordings)
- Cinematic motion (Ken Burns, not static images)
- Synced captions
- Voice narration
- Sub-60s render time per video
- Works on any device (server renders, browser just previews)
