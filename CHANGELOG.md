## [AUTO UPDATE] v24 — Image Engine Upgrade

### What changed

Image generation is no longer hardcoded to Pollinations. Users select the engine per-render.

**Updated: `lib/services/image.ts`**
- `ImageEngine` type: `pollinations | flux-schnell | flux-dev | ideogram`
- `generateImage()` routes to the correct provider based on `engine` param
- `generateImageReplicate()` — FLUX Schnell + FLUX Dev via Replicate API. Uses `Prefer: wait` header for inline results. Falls back gracefully to Pollinations if `REPLICATE_API_TOKEN` not set or prediction fails.
- `generateImageIdeogram()` — Ideogram v2 API. Maps render dimensions to correct aspect ratio. Falls back to Pollinations if `IDEOGRAM_API_KEY` not set.
- All providers enhance the prompt with cinematic quality suffixes before sending.

**Updated: `app/api/render/run/route.ts`**
- `buildPollinationsUrl()` removed — was a dead-end, not using the service layer
- Step 1 image generation now calls `generateImage({ engine: imageEngine, ... })` from service
- `imageEngine` properly typed as `ImageEngine`

**Updated: `app/(app)/new-project/page.tsx`**
- Image engine `<select>` now has 4 options with quality tier and cost label:
  - ⚡ Pollinations — Free, no key (baseline)
  - 🚀 FLUX Schnell — ~$0.003/img (REPLICATE_API_TOKEN)
  - ✨ FLUX Dev — ~$0.025/img (REPLICATE_API_TOKEN)
  - 🎨 Ideogram v2 — Free tier (IDEOGRAM_API_KEY)
- Contextual hint shown under select when Replicate or Ideogram selected, with signup link
- Pipeline status card now shows actual engine name (FLUX Schnell / FLUX Dev / Ideogram v2 / Pollinations)

**Updated: `.env.local.example`**
- `REPLICATE_API_TOKEN` — documented with signup link and $5 free credit note
- `IDEOGRAM_API_KEY` — documented with signup link and free tier note

### Cost to start

$0. Replicate gives $5 free credit on signup (~250 renders at FLUX Schnell). Ideogram has a free monthly credit tier. Both fall back to Pollinations if keys are absent — zero breakage.

### Next

Set `REPLICATE_API_TOKEN` in .env.local, select FLUX Schnell, render 5 test videos across templates. Then Step 9: Bulk generation dashboard.

---


## [PLANNED] Image Engine Upgrade — FLUX Schnell + FLUX Dev + Ideogram

### Objective

Replace Pollinations as the only image option with a user-selectable engine menu.
Zero cost to start — Replicate $5 free credit (~250 renders) + Ideogram free tier.
Single architectural swap — lib/services/image.ts is the only provider layer.

### Files to change

- `lib/services/image.ts` — add `generateImageFluxReplicate()` (Schnell + Dev) and `generateImageIdeogram()`. Route via `imageEngine` param in `generateImage()`.
- `app/api/render/run/route.ts` — replace inline `buildPollinationsUrl()` with `generateImage()` from service layer. Wire `imageEngine` from request body.
- `app/(app)/new-project/page.tsx` — upgrade image engine `<select>` to 4 options with quality tier badges and cost labels.
- `.env.local.example` — document `REPLICATE_API_TOKEN` and `IDEOGRAM_API_KEY`.

### Provider plan

| Engine | Cost | Free | Quality |
|---|---|---|---|
| Pollinations | Free | Always | ⭐⭐ Baseline |
| FLUX Schnell (Replicate) | ~$0.003/img | $5 credit on signup | ⭐⭐⭐⭐ Big jump |
| FLUX Dev (Replicate) | ~$0.025/img | Same $5 credit | ⭐⭐⭐⭐⭐ Best quality |
| Ideogram v2 | Free tier | Monthly credits | ⭐⭐⭐⭐ Strong cinematic |

### Why this matters

Pollinations is the primary quality gap vs InVideo. FLUX Schnell at $0.003/image is
the single highest ROI upgrade available. $5 free credit = ~250 full renders before
any spend. Ideogram free tier adds a zero-cost quality option with no credit card.

---


## [AUTO UPDATE] v23 — Step 8: Custom Templates + Brand Kits

### What changed

Templates now control the entire generation pipeline — not just the UI.

**New file: `lib/templates.ts`**
- `ViralTemplate` interface — 12 pipeline properties per template
- 8 production-ready templates: TikTok Story, Documentary, True Crime, History Channel, AI News, Reddit Story, Motivation, Business Explainer, Faceless YouTube
- Each template defines: tone, system persona, beat sequence, per-beat director notes, visual style, camera vocabulary, pacing note, lighting note, default format/duration/voice/captionStyle, optional sceneCountOverride
- Helper functions: `getTemplate()`, `getDefaultTemplate()`, `buildSystemPersona()`, `buildBeatInstructions()`

**Updated: `app/api/generate/route.ts`**
- `GenerateRequest` accepts optional `templateId` — backwards compatible, falls back to TikTok Story
- `buildPrompt()` fully template-aware: injects visual style, camera vocabulary, lighting, tone, and per-beat director notes into every Groq prompt
- Groq system message now uses `buildSystemPersona(template)` — different AI persona per template
- `sceneCount()` respects `template.sceneCountOverride` (AI News forces 6 scenes, TikTok Story forces 3)
- Dynamic `story_arc` JSON schema keys generated from `template.beats` — Documentary gets cold_open→legacy instead of hook→cta
- `templateId` echoed back in `GenerateResponse`

**Updated: `app/(app)/new-project/page.tsx`**
- Template selector is now the first card — 8 buttons with emoji, label, and description
- Selecting a template auto-fills: format, duration, voice, captionStyle, tone
- Template details strip shows format / duration / beat count / caption style / tone preview
- Preview summary shows Template + Topic (was Niche + Tone)
- `handleGenerate()` forwards `templateId` to `/api/generate`

### Architecture

Templates are not cosmetic. They alter:
- The AI system persona (different writing style per format)
- The beat sequence (Documentary: cold_open → context → witness → evidence → conflict → resolution → legacy)
- Per-beat director notes injected into the prompt (exact instructions per scene type)
- Visual style prefix on every image_prompt
- Camera vocabulary (template-specific Ken Burns moves)
- Pacing and lighting notes as scene rules

Adding a new template = one entry in `TEMPLATES[]` in `lib/templates.ts`. Zero other changes.

### Next
Step 9: Bulk generation dashboard — submit a topic + template, get 5-10 videos queued automatically.

---


## [AUTO UPDATE] v22 — Step 7: 3-Tier Voice Architecture

### What changed

Zero-cost voice by default. Quality upgrades by setting one env var.

**Tier 1 — Piper TTS (free, always)**
- `lib/services/voice.ts` — full rewrite with `VOICE_CATALOG` (18 voices across 3 tiers)
- Legacy `kokoro-en-f` / `kokoro-en-m` IDs remapped to Piper — backwards compatible, no DB changes
- 4 Piper voices: Aria (US F), Marcus (US M), Olivia (GB F), James (GB M)

**Tier 2 — ElevenLabs + PlayHT (free tiers)**
- `app/api/tts/route.ts` — full rewrite with 3-tier routing
- ElevenLabs primary (10k chars/mo free, `eleven_turbo_v2` model)
- PlayHT automatic fallback when ElevenLabs quota is hit (12k chars/mo free)
- 6 ElevenLabs voices + 2 PlayHT voices in catalog
- Set `ELEVENLABS_API_KEY` and/or `PLAYHT_API_KEY + PLAYHT_USER_ID` in `.env.local`
- Falls back to Tier 1 automatically if keys not set or quota exceeded

**Tier 3 — BYOK (Bring Your Own Key)**
- `app/(app)/new-project/page.tsx` — voice selector redesigned with 3 `<optgroup>` sections
- Tier badge shown inline (⚡ Free / ✨ Quality)
- Collapsible "🔑 Use your own API key" panel: provider select + API key input + PlayHT user ID
- BYOK key used for that render only — never stored server-side
- Params threaded through: new-project → queue → worker → run → tts

**Wiring**
- `app/api/render/queue/route.ts` — byok fields added to request interface + forwarded
- `app/api/render/run/route.ts` — byok fields added to request interface + forwarded to /api/tts
- `worker/render-worker.ts` — byok fields added to `RenderQueueMessage` + forwarded
- `.env.local.example` — Step 7 vars documented with full setup instructions

### Graceful fallback chain
```
Request voice
  → Tier 3 BYOK key present? → use it
  → Tier 2 EL key present? → try ElevenLabs → fail → try PlayHT
  → Tier 1 Piper URL present? → use Piper
  → silent WAV fallback (render still works)
```

### Step 6 (Stripe) status
Deferred — no paying users yet. Zero cost to run. Will implement when first monetization is needed.

---

## [AUTO UPDATE] v21 — Step 5: Cloudflare Queue Async Render Dispatch

### What changed

**Phase 1 is now complete.** All 5 steps done. Renders no longer block on a synchronous HTTP call that hits the 2-minute timeout for longer videos.

### New files

- **`worker/render-worker.ts`** — Cloudflare Worker. Consumes the `viralos-render` queue. Each message triggers a call to `/api/render/run` (Node.js, not blocked by Worker runtime). Updates Supabase on failure. `max_batch_size=1`, `max_retries=2`, DLQ configured.

- **`worker/wrangler.worker.toml`** — Standalone wrangler config for worker deployment. `wrangler deploy --config worker/wrangler.worker.toml`.

- **`app/api/render/queue/route.ts`** — `POST /api/render/queue`. Clerk auth. Creates `render_job` row (`status: queued`) in Supabase. Dispatches job to CF Queue via REST API. **Falls back** to calling `/api/render/run` synchronously if `CF_ACCOUNT_ID`/`CF_API_TOKEN` not set. Returns `{ jobId, status, async: bool }` immediately.

- **`app/api/render/run/route.ts`** — `POST /api/render/run`. Internal endpoint authenticated via `RENDER_WORKER_SECRET` (not Clerk — Worker has no session). Extracted full render pipeline from `/api/render`: images → TTS → Remotion → R2 → Supabase. Called by the Worker (async path) and by the queue route (sync fallback). All Step 3/4 graceful degradation preserved.

- **`app/api/render/status/[jobId]/route.ts`** — `GET /api/render/status/[jobId]`. Clerk auth + ownership check. Returns live `render_job` row: `status`, `outputUrl`, `elapsedSeconds`, `error`. Returns `{ status: unknown }` if Supabase not configured — UI shows generic spinner.

### Modified files

- **`app/(app)/new-project/page.tsx`**
  - `handleRender()` now calls `/api/render/queue` instead of `/api/render` directly
  - Async path: `pollRenderStatus()` polls `/api/render/status/[jobId]` every 3s with elapsed time label
  - Sync fallback: handles inline result when CF Queue not configured
  - Legacy fallback: falls back to `/api/render` if queue route fails entirely
  - Pipeline status card shows new **Queue** step + job ID label
  - `renderJobId` + `renderAsync` state added

- **`wrangler.toml`** — Commented queue producer/consumer blocks + deployment notes

- **`.env.local.example`** — `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `RENDER_QUEUE_NAME`, `RENDER_WORKER_SECRET`, `NEXT_APP_URL` documented with full setup steps

### Architecture

```
User clicks Render
    ↓
POST /api/render/queue  (Clerk auth)
    ↓ creates render_job row (status: queued)
    ↓
CF Queue API  ← if CF_ACCOUNT_ID set
    ↓ else: calls /api/render/run synchronously (Step 4 fallback)
    ↓
UI polls /api/render/status/[jobId] every 3s
    ↓
Cloudflare Worker picks up job
    ↓
POST /api/render/run  (RENDER_WORKER_SECRET auth)
    ↓
Images + TTS + Remotion render + R2 upload + Supabase update
    ↓
status: done → UI poll catches it → video shown
```

**Three graceful fallback levels:**
1. CF Queue configured → full async (no HTTP timeout)
2. CF Queue not configured → sync render, same as Step 4
3. `/api/render/queue` fails → falls back to original `/api/render`

### Next

**Phase 2, Step 6**: Stripe subscription tiers + usage metering.
Free: 3 renders/month. Pro $19/mo: 50 renders. Studio $49/mo: unlimited.

---

## [v20-step4] Step 4 Complete — Supabase Schema + R2 Storage + Project Library

### Added

**Supabase Schema (`supabase/migrations/001_initial_schema.sql`)**:

- `users` table — mirrors Clerk users. `clerk_user_id` is FK for all tables. Upserted on every dashboard load.
- `projects` table — stores `script_json` (full GenerateResponse), `characters_json`, `status` lifecycle (draft → rendering → done/error), all generation params.
- `scenes` table — one row per scene, for future storyboard editor. Unique on `(project_id, scene_number)`.
- `render_jobs` table — per render attempt. Stores `r2_key`, `r2_url`, `duration_seconds`, `scene_count`, error messages, timing.
- Row Level Security on all tables. Service role bypasses RLS.
- Auto-updated `updated_at` triggers.

**Supabase Client (`lib/supabase.ts`)**:

- `supabasePublic` — anon key, respects RLS (client components).
- `getSupabaseAdmin()` — service role, bypasses RLS (server-only).
- TypeScript types: DbUser, DbProject, DbRenderJob, DbScene.

**R2 Storage Service (`lib/services/storage.ts`)**:

- `uploadVideo()` — uploads MP4 to R2, returns 7-day presigned URL. Returns null if unconfigured (base64 fallback).
- `getVideoUrl()` — refreshes presigned URL. Key pattern: `videos/{userId}/{jobId}.mp4`.
- Swappable: replace to use S3, GCS, or Supabase Storage.

**User Sync (`app/api/user/sync/route.ts`)** — POST upserts Clerk user into Supabase. Called server-side on dashboard load.

**Projects API (`app/api/projects/route.ts`)** — GET (library, newest first, render_jobs joined) + POST (create project + scenes).

### Modified

- **`app/api/render/route.ts`** — After Remotion render: R2 upload → Supabase render_job persist → project status update. Non-fatal: Step 3 base64 fallback preserved.
- **`app/(app)/new-project/page.tsx`** — Saves project to Supabase after generate. Passes projectId to render to link jobs.
- **`app/(app)/library/page.tsx`** — Real /api/projects data. Hover-to-play video. Download button. Setup guidance on error.
- **`app/(app)/dashboard/page.tsx`** — Server component with real stats (video count, render count, total duration). User sync on load.
- **`package.json`** — Added @supabase/supabase-js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner.
- **`.env.local.example`** — Supabase + R2 vars documented. Step 5 vars pre-staged.

### Architecture

Graceful degradation: app fully functional without Step 4 config (falls back to Step 3 behaviour). Character memory now persisted in Supabase projects.characters_json.

### Next

**Phase 1, Step 5**: Cloudflare Queue + Worker for async render dispatch.

---

## [v20-step3] Step 3 Complete — Remotion Video Renderer

### Added

**Provider Abstraction Layer (`lib/services/`)** — all AI providers now behind swappable functions:

- **`lib/services/image.ts`** — `generateImage()`. Current: Pollinations (free, no key). Upgrade: swap to FLUX Schnell → one line change.
- **`lib/services/voice.ts`** — `generateVoice()`. Current: Kokoro TTS via `/api/tts`. Upgrade: swap to ElevenLabs (Step 7) → one line change.
- **`lib/services/video.ts`** — `renderFinalVideo()` + `generateSceneVideo()`. Current: Remotion OSS. Upgrade path: Remotion Lambda (parallel renders) or Kling/Veo (AI scene video) → one function swap each.
- **`lib/services/index.ts`** — single re-export point. Everything in the app imports from here only.

**Ken Burns Engine (`remotion/kenburns.ts`)** — ported from legacy `getCameraMove()` + `parseCameraMovement()`:

- `getKenBurnsFrame(move, frame, durationFrames)` — returns `{ scale, translateX, translateY }` per frame with easing.
- `parseCameraMovement(text)` — maps free-text camera descriptions to the 10 named vocabulary moves.
- 10 moves: `wide_reveal` (zoom-out reveal), `intimacy_push` (dolly-in), `reveal_pan` (lateral pan), `tension_creep` (imperceptible creep), `hero_rise` (tilt-up), `memory_drift` (gentle drift + rack focus sim), `chaos_shake` (deterministic handheld wobble), `clarity_lock` (static), `perspective_shift` (zoom-out + diagonal push), `emotional_hold` (ultra-slow 5% zoom).
- All moves use easeInOut/easeOut — never linear.

**Caption Engine (`remotion/captions.tsx`)** — ported from legacy caption engine:

- `buildCaptionSegments(text, fps, durationFrames)` — distributes words evenly across frames. Step 7 (ElevenLabs) will supply real word timestamps.
- `getCurrentCaption(segments, frame)` — returns 3-word sliding window (before / **current** / after) for each frame.
- `CaptionOverlay` — React component, renders active caption into composition.
- **TikTok v2 style**: uppercase Arial Black, yellow `#FFE000` highlight on active word, black stroke, centered bottom. Active word scales up 8%.
- **Reels Bold style**: white pill background, SF Pro, yellow highlighted active word, 85% max-width constraint.

**Remotion Composition (`remotion/compositions/ViralOSComposition.tsx`)**:

- `ViralOSComposition` — main composition. One `<Sequence>` per scene, timed to actual TTS audio duration.
- `SceneRenderer` — per-scene layer stack: Ken Burns image → radial vignette → bottom caption gradient → `<Audio>` → `<CaptionOverlay>`.
- 8-frame fade-in / 8-frame fade-out transitions between every scene.
- Ken Burns applied as CSS `transform: scale() translate()` on `<AbsoluteFill>` — GPU-accelerated, no layout reflow.
- `getVideoDimensions(format)` — 9:16 → 1080×1920, 16:9 → 1920×1080, 1:1 → 1080×1080.

**Remotion Root (`remotion/Root.tsx`)**:

- Registers `ViralOS-9-16`, `ViralOS-16-9`, `ViralOS-1-1` compositions.
- `calculateMetadata()` sets `durationInFrames` from actual scene audio lengths — no hardcoded durations.

**TTS API Route (`app/api/tts/route.ts`)**:

- Clerk auth-guarded. `KOKORO_API_URL` server-only, never in client bundle.
- Calls Kokoro's OpenAI-compatible `/v1/audio/speech` endpoint (model: `kokoro`, WAV output).
- Voice mapping: `kokoro-en-f` → `af_heart` (warm female), `kokoro-en-m` → `am_michael` (authoritative male).
- **Silent fallback**: if `KOKORO_API_URL` not configured, generates a correctly-sized silent WAV from word count estimate. Video renders without audio — add Kokoro when ready.
- Duration calculation from WAV header bytes (PCM 16-bit 24kHz) with word-count fallback.

**Render API Route (`app/api/render/route.ts`)**:

- Master render orchestrator. Clerk auth-guarded.
- Step 1: Fetches all scene images in parallel (Pollinations URLs, deterministic seed per scene).
- Step 2: Generates TTS for all scenes in parallel (server-to-server `/api/tts` call, cookie-forwarded for auth).
- Step 3: Assembles `SceneAsset[]` — matches each scene to its image URL + audio base64.
- Step 4: Calls Remotion `bundle()` + `selectComposition()` + `renderMedia()`. H264 codec, 2-minute timeout.
- Step 5: Reads output MP4, returns as `data:video/mp4;base64,...` for direct browser download.
- Temp file cleanup after response.

### Modified

**`app/(app)/new-project/page.tsx`** — Render button live:

- Added `rendering`, `renderError`, `renderProgress`, `videoUrl` state.
- `handleRender()` → `POST /api/render` → base64 MP4 data URL.
- Progress messages: "Fetching scene images…" → "Generating voices + images…" → "Compositing video…"
- Render button shows spinner + progress text while rendering.
- On completion: in-line `<video>` player + "Save MP4" download link appear in sidebar.
- Pipeline status dots: script=green, voice/images/render=orange (active) / green (done) / violet (ready).
- `handleReset()` clears video URL and render state.

**`package.json`** — Added `remotion`, `@remotion/bundler`, `@remotion/renderer` ^4.0.0. Added `remotion:studio` script.

**`.env.local.example`** — Added `KOKORO_API_URL` with Docker self-host command and fallback note.

### Architecture notes

- Provider abstraction complete: every AI call in the app now goes through `lib/services/`. Zero direct provider calls in components or API routes.
- Storyboard-first pipeline matches MASTER_PROMPT spec: Script → Storyboard → Scenes → Visual Gen → Voice Gen → Final Render.
- Ken Burns + caption logic is entirely in `remotion/` — Remotion is a peer dependency, swappable with Remotion Lambda (Step 5) with zero architecture changes.
- `generateSceneVideo()` stub exists in `lib/services/video.ts` — ready to wire Kling/Veo/Runway when available.

---

## [v20-step2] Step 2 Complete — Groq Script Generation API Route

### Added

**`app/api/generate/route.ts`** — Production server-side script generation:

- **Auth guard**: Clerk `auth()` checked before any Groq call. 401 if unauthenticated.
- **`GROQ_API_KEY` server-only**: Never in client bundle. Validated on startup — descriptive 500 if missing.
- **Full 7-beat story arc schema** ported from legacy `callAPI()` prompt — `beat_1_hook` through `beat_7_cta`.
- **Scene Director schema** ported from legacy `buildTimeline()`: every scene has `arc_beat`, `narration`, `image_prompt`, `environment`, `subject`, `emotion`, `lighting`, `camera_movement`, `visual_objective`, `duration_seconds`.
- **Character memory system** ported from legacy `renderCharacters()`: `characters` array with `name`, `role`, `visual_identity` (locked string, injected verbatim into image prompts), `appears_in_scenes`.
- **Ken Burns camera vocabulary** ported from legacy `getCameraMove()` / `parseCameraMovement()`: 10 named moves (`wide_reveal`, `intimacy_push`, `reveal_pan`, `tension_creep`, `hero_rise`, `memory_drift`, `chaos_shake`, `clarity_lock`, `perspective_shift`, `emotional_hold`). Auto-injected per arc beat if model omits.
- **Scene count scales with duration**: 30s=3 scenes, 60s=7 scenes, 90s=10 scenes. Beat assignment auto-calculated.
- **`response_format: json_object`** enforced on Groq. Strips any accidental markdown fences before `JSON.parse`.
- **Groq model**: `llama-3.3-70b-versatile`, `temperature: 0.85`, `max_tokens: 4096`.
- **Input validation**: niche, format, duration, tone required. Custom topic required when `niche === 'custom'`.

### Modified

**`app/(app)/new-project/page.tsx`** — Wired to live API, full script results view:

- `handleGenerate()` → `POST /api/generate` → structured `GenerateResponse`.
- Two-view pattern: config form switches to script results on success.
- **Script results view**:
  - Video title from Groq.
  - **7-beat story arc panel**: all beats displayed with numbered indicators.
  - **Scene cards**: expandable. Collapsed = scene number + beat badge + 2-line narration preview. Expanded = full narration + director metadata grid (environment, lighting, camera, visual goal) + image prompt in monospace + copy button.
  - **Characters panel** (right sidebar): name, role badge, locked visual identity description, scene appearances.
  - **Pipeline status**: Script=live, Voice/Images/Render=pending Step 3.
  - **Copy all narration** button: copies all scenes as `[Scene N]\nnarration` text.
  - **Reset** returns to config form.
- Auto-expands Scene 1 on result load.

**`.env.local.example`** — `GROQ_API_KEY` uncommented and documented as active (Step 2).

### Architecture notes

- `SceneDirector` and `GenerateResponse` types exported from route — imported in page component for full type safety.
- No rewrites to Step 1 files. Auth shell, layout, nav untouched.
- Data layer still mock in dashboard/library — Supabase wired in Step 4 with zero component changes.

---

# Changelog

## [v20] Step 1 Complete — Next.js App Shell + Clerk Auth

### Added

**New stack scaffolded — all files from scratch:**

- **`package.json`** — Next.js 15, Clerk v6, TypeScript. Zero bloat. Only what Step 1 needs.
- **`next.config.js`** — minimal Next.js config, Clerk image domain allowlisted.
- **`tsconfig.json`** — strict TypeScript, path alias `@/*`.
- **`middleware.ts`** — Clerk auth guard. Public routes: `/`, `/sign-in`, `/sign-up`. Everything else protected server-side.
- **`.env.local.example`** — all env vars documented across all 5 steps. Nothing ever exposed client-side.
- **`wrangler.toml`** — Cloudflare Pages deploy config.
- **`README.md`** — complete setup guide, architecture map, upgrade path table.

**App shell (authenticated):**
- **`app/layout.tsx`** — Root layout with `ClerkProvider`. Auth state available SSR throughout.
- **`app/globals.css`** — ViralOS design system: void-black base (`#080a0f`), electric violet brand (`#7c3aed`), signal orange CTA (`#f97316`). Typefaces: Space Grotesk (display), Inter (body), JetBrains Mono (code/mono). Full token system: bg layers, text scale, border colors, shadow + glow vars. All component classes: shell grid, topnav, sidebar, stat cards, video cards, badges, empty states, forms, buttons, progress bars, landing sections.
- **`app/page.tsx`** — Landing/marketing page. Detects auth state server-side; redirects signed-in users to `/dashboard`. Hero with gradient title, proof points (< 60s render, 7-beat story, free), CTA to sign-up.
- **`app/(auth)/sign-in/[[...sign-in]]/page.tsx`** — Clerk `<SignIn>` component, branded to ViralOS dark palette.
- **`app/(auth)/sign-up/[[...sign-up]]/page.tsx`** — Clerk `<SignUp>` component, branded to ViralOS dark palette.
- **`app/(app)/layout.tsx`** — Authenticated shell layout. SSR auth check → redirect if not signed in. Top nav: wordmark, "New Video" CTA, Clerk `<UserButton>`. Sidebar: nav items with active detection.
- **`app/(app)/dashboard/page.tsx`** — Dashboard. Personalized greeting via `currentUser()`. Four stat cards (Videos, Renders, Runtime, Storage) — mock data, wired to Supabase in Step 4. Build progress tracker showing all 5 steps with live completion state. Recent videos empty state with CTA.
- **`app/(app)/new-project/page.tsx`** — Video creation form. Niche picker (11 options + custom), format selector (9:16/16:9/1:1), duration (30/60/90s), tone, caption style, voice, image engine. Live preview with aspect-ratio-accurate placeholder. Config summary panel. Generate button (wired to mock — real Groq API route in Step 2). Active stack display.
- **`app/(app)/library/page.tsx`** — Video library. Filter tabs (All/Draft/Rendering/Done/Error), sort dropdown. Grid layout with video cards (9:16 thumbnail ratio). Empty state with CTA. Placeholder for Supabase data in Step 4.
- **`components/NavItems.tsx`** — Client component. `usePathname()` for active state. Two nav groups: WORKSPACE (Dashboard, New Video, Library) and COMING SOON (Render Queue · Step 5, Publish · Phase 2, both disabled). Active item gets brand violet left-border indicator.

### Architecture decisions

- **Route groups**: `(auth)` for public Clerk pages, `(app)` for the authenticated shell — avoids topnav/sidebar leaking onto auth pages.
- **No API keys client-side**: Groq key will enter at Step 2 as a server-only env var. Nothing in `NEXT_PUBLIC_` that shouldn't be.
- **Mock data throughout**: All stat counts and library queries return empty/zero. Supabase wired in Step 4 with zero component rewrites — just swap fetch calls.
- **Upgrade-ready selects**: Voice and image dropdowns already show ElevenLabs and FLUX options — disabled with "Step 7" label. One function swap to enable.

### Notes
- Clerk setup takes ~5 minutes (create app, enable Google+Email, copy two keys).
- Deploy to Cloudflare Pages: connect GitHub repo, set build command `npm run build`, add env vars in Pages dashboard.

---

## [AUTO UPDATE] v19.1 — Architecture Pivot + Master Prompt

### Decision

Monolithic browser-only app deprecated as production target. Full-stack scale-ready architecture adopted.

### New Stack (Canonical)

- **Frontend**: Next.js (App Router) on Cloudflare Pages
- **Auth**: Clerk (free tier, Google + email login, user management dashboard)
- **Database**: Supabase (free tier Postgres, stores users, projects, video library, render jobs)
- **Storage**: Cloudflare R2 (free 10GB, stores rendered MP4s and generated images)
- **AI Scripts**: Groq — llama-3.3-70b (free, already proven)
- **TTS**: Kokoro TTS (open source, free → upgradeable to ElevenLabs)
- **Images**: Pollinations (free → upgradeable to FLUX/Replicate)
- **Video Render**: Remotion OSS (server-side React+ffmpeg → upgradeable to Remotion Lambda)
- **Render Queue**: Cloudflare Queues + Worker
- **Payments (Phase 2)**: Stripe

### Added

- **`MASTER_PROMPT.md`** — Canonical engineering brief.
- **`VIRALOS_STATE.json`** — Reflects new architecture, target stack, upgrade path, build order.

### Next

**Phase 1, Step 2**: Port `callAPI()` into `/api/generate` — server-side Groq, key never exposed.

---

## [AUTO UPDATE] v19 — System Bootstrap (Modular Architecture)

### Added

- **`app.js`** — All JavaScript/logic extracted from monolithic `index.html`
- **`styles.css`** — All CSS extracted from monolithic `index.html`

### Improved

- **`index.html`** — Reduced from ~538KB monolith to clean ~40KB HTML skeleton.

---

## [AUTO UPDATE] v18 — Motion Director v1.0

- `parseCameraMovement()` — 10 named Ken Burns vocabularies
- `getCameraMove()` — `cameraMovement` param wired end-to-end

---

## [AUTO UPDATE] v17 — Character Memory System v1.0

- `characters` array in JSON schema with locked visual identities
- `renderCharacters()` function
- Characters tab in UI
- Character memory injected verbatim into every scene image prompt

---

## [AUTO UPDATE] v16 — Story Engine v1.0 + Scene Director v1.0

- `story_arc` 7-beat narrative spine
- Scene Director schema: `arc_beat`, `environment`, `subject`, `emotion`, `lighting`, `camera_movement`, `visual_objective`

---

## [AUTO UPDATE] v15 — Platform Publishing v1.0

- TikTok Content Posting API v2, YouTube Data API v3, Instagram Graph API

## [AUTO UPDATE] v14–v5

- AI Visual Parallel Fetch, Export Stability, Timeline Polish, Caption Engine, Animation Engine v2, Bulk Factory
