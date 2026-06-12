# ViralOS — Roadmap

## Phase 1 — Personal Use (Free Stack)

Goal: produce video quality that matches InVideo. Validate the pipeline end-to-end on real content before monetizing.

---

### ✅ Step 1 — App Shell + Auth
**Status: Complete**

- Next.js 15 App Router scaffold
- Clerk auth (Google + email) with branded sign-in/sign-up pages
- Authenticated shell: topnav, sidebar, route groups
- Three protected pages: Dashboard, New Video, Library
- ViralOS design system (void black, electric violet, signal orange)
- Cloudflare Pages config (`wrangler.toml`)

---

### ✅ Step 2 — Groq Script Generation
**Status: Complete**

- `POST /api/generate` — server-side, Clerk-auth-guarded
- `GROQ_API_KEY` never exposed to client
- 7-beat story arc schema (hook → setup → tension → turn → revelation → payoff → CTA)
- Scene Director schema: narration, image prompt, environment, lighting, camera movement, visual objective
- Character memory system: locked `visual_identity` strings injected verbatim into image prompts
- Ken Burns camera vocabulary: 10 named moves, auto-assigned per arc beat
- Scene scaling: 30s=3 scenes, 60s=7 scenes, 90s=10 scenes
- Script results view: expandable scene cards, character panel, pipeline status

---

### 🔲 Step 3 — Remotion Video Renderer
**Status: Next**

Port `buildTimeline()`, `getCameraMove()`, `parseCameraMovement()` from legacy `app.js` into Remotion.

Deliverables:
- `remotion/` directory with Remotion composition
- One `<Sequence>` per scene, timed to narration duration
- Ken Burns motion via CSS transforms (scale + translate interpolated over scene duration)
- Pollinations image fetch per scene (using `image_prompt` from Step 2)
- Kokoro TTS voice synthesis (narration text → audio file)
- Caption layer: word-timed subtitles, TikTok v2 and Reels Bold styles
- `POST /api/render` triggers Remotion server-side render → returns MP4
- Render button on script results page goes live

**Upgrade path:** swap `renderMedia()` call for Remotion Lambda — zero composition changes.

---

### 🔲 Step 4 — Supabase + R2 Storage
**Status: Pending**

Wire persistent data layer. All mock data replaced with real queries.

Deliverables:
- Supabase schema: `users`, `projects`, `scenes`, `render_jobs` tables
- Projects saved on script generation
- Render jobs tracked (pending → rendering → done → error)
- Rendered MP4s uploaded to Cloudflare R2
- Library page: real video cards with thumbnails, status badges, playback
- Dashboard: real stats (video count, render time, storage used)

---

### 🔲 Step 5 — Async Render Queue
**Status: Pending**

Move render off the request thread. User submits → gets notified when done.

Deliverables:
- Cloudflare Queue binding in `wrangler.toml`
- `POST /api/render` enqueues job → returns `job_id` immediately
- Cloudflare Worker: dequeues, runs Remotion render, uploads to R2, updates Supabase
- Render status polling on Library page (or websocket push)
- User notified when render completes

---

## Phase 2 — Monetization

Activated when Phase 1 output quality matches InVideo. Each step is additive — no Phase 1 rewrites.

---

### 🔲 Step 6 — Stripe Subscription Tiers
- Free tier: 5 videos/month, watermark
- Pro tier ($X/mo): unlimited, no watermark, priority render
- Usage metering via Supabase render_jobs
- Stripe webhook → update user tier in Supabase
- Upgrade prompt in dashboard when free limit approached

### 🔲 Step 7 — ElevenLabs Voice Upgrade
- Swap `synthesizeSpeech()` — one function
- Voice selection UI unlocked for Pro users
- 30+ voices, custom voice cloning option

### 🔲 Step 8 — Custom Templates + Brand Kits
- Saved color palettes, fonts, logo overlays
- Template library (hooks, listicles, storytelling)
- Brand kit stored in Supabase per user

### 🔲 Step 9 — Bulk Generation Dashboard
- CSV/list input → generate N videos in parallel
- Render queue priority for Pro users
- Bulk export with naming conventions

### 🔲 Step 10 — Direct Platform Publishing
- TikTok Content Posting API v2
- YouTube Data API v3
- Instagram Graph API
- OAuth tokens stored server-side in Supabase (never client-side paste)
- Scheduled publishing queue
- Per-platform format optimization (aspect ratio, duration, captions)

---

## Quality Bar (Non-Negotiable)

A paying InVideo user must prefer ViralOS. That requires:

- ✅ Real MP4 files (not canvas recordings or screen captures)
- ✅ Cinematic Ken Burns motion (not static image slideshows)
- ✅ Word-synced captions (not static subtitles)
- ✅ AI voice narration (not text-only)
- ✅ Sub-60s render time per video
- ✅ Works on any device (server renders, browser only previews)
- ✅ 7-beat narrative structure (not random scene assembly)
- ✅ Locked character visual consistency across scenes
