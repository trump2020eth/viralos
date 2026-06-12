# ViralOS — Architecture

## Overview

ViralOS is a full-stack AI video creation platform built for scale from day one. The architecture is designed so every component can be upgraded by swapping a single function — no rewrites, ever.

---

## Route Structure

```
app/
├── page.tsx                          # Landing / marketing page (auth redirect)
├── layout.tsx                        # Root layout — ClerkProvider
├── globals.css                       # ViralOS design system
│
├── (auth)/                           # Public auth pages (no shell)
│   ├── sign-in/[[...sign-in]]/
│   └── sign-up/[[...sign-up]]/
│
├── (app)/                            # Authenticated shell (topnav + sidebar)
│   ├── layout.tsx                    # Shell layout — SSR auth check
│   ├── dashboard/page.tsx            # Stats, build progress, recent videos
│   ├── new-project/page.tsx          # Video config form → script results
│   └── library/page.tsx             # Video library — filter/sort
│
└── api/
    └── generate/route.ts             # POST — Groq script generation (server-side)
```

---

## Auth Strategy

- **Clerk** handles all auth. `middleware.ts` protects every route except `/`, `/sign-in`, `/sign-up`.
- SSR auth check in `(app)/layout.tsx` — redirect to `/sign-in` if no session.
- API routes call `auth()` from `@clerk/nextjs/server` before any external API call.
- `GROQ_API_KEY` and all secrets live in server-only env vars. Nothing sensitive in `NEXT_PUBLIC_*`.

---

## Data Flow (Current — Steps 1–2)

```
User fills form (new-project/page.tsx)
    ↓
POST /api/generate
    ↓ Clerk auth() check
    ↓ Build 7-beat prompt
    ↓ Groq API (server-side, key never leaves)
    ↓ Parse + validate JSON response
    ↓ Inject Ken Burns camera moves
    ↓
GenerateResponse returned to client
    ↓
Script results view: title, story arc, scenes, characters
```

---

## Data Flow (Target — Steps 3–5)

```
User clicks "Render Video"
    ↓
POST /api/render
    ↓ Save project to Supabase
    ↓ Dispatch job to Cloudflare Queue
    ↓ Return job_id to client
    ↓
Cloudflare Worker picks up job
    ↓ Fetch images from Pollinations
    ↓ Generate TTS via Kokoro
    ↓ Render MP4 via Remotion
    ↓ Upload MP4 to Cloudflare R2
    ↓ Update render_jobs table in Supabase
    ↓
Client polls / receives notification
    ↓
Video available in Library
```

---

## Design System

Defined in `app/globals.css`. CSS custom properties — never hardcoded values in components.

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#080a0f` | Page background (void black) |
| `--bg-surface` | `#0d1017` | Cards, panels |
| `--bg-raised` | `#131720` | Inputs, secondary surfaces |
| `--brand-400` | `#7c3aed` | Electric violet — primary brand |
| `--brand-300` | `#a78bfa` | Brand text, active states |
| `--accent` | `#f97316` | Signal orange — CTAs |
| `--success` | `#22c55e` | Live/active indicators |
| `--error` | `#ef4444` | Error states |
| `--text-primary` | `#f1f5f9` | Body text |
| `--text-secondary` | `#94a3b8` | Labels, metadata |
| `--text-muted` | `#475569` | Placeholders, disabled |

Typefaces: Space Grotesk (display), Inter (body), JetBrains Mono (code/prompts).

---

## Script Generation Schema

Output of `POST /api/generate`. Defined as TypeScript types in `app/api/generate/route.ts`.

```typescript
GenerateResponse {
  title: string
  story_arc: {
    beat_1_hook: string
    beat_2_setup: string
    beat_3_tension: string
    beat_4_turn: string
    beat_5_revelation: string
    beat_6_payoff: string
    beat_7_cta: string
  }
  characters: Array<{
    name: string
    role: 'protagonist' | 'antagonist' | 'narrator' | 'expert'
    visual_identity: string   // locked — injected verbatim into every image prompt
    appears_in_scenes: number[]
  }>
  scenes: Array<{
    scene_number: number
    arc_beat: string
    narration: string
    image_prompt: string      // self-contained, includes character visual_identity
    environment: string
    subject: string
    emotion: string
    lighting: string
    camera_movement: string   // Ken Burns vocabulary
    visual_objective: string
    duration_seconds: number
  }>
  total_duration: number
  niche: string
  format: string
  tone: string
}
```

---

## Ken Burns Camera Vocabulary

10 named moves, ported from legacy `getCameraMove()`. Auto-assigned per arc beat.

| Move | Description | Default beat |
|---|---|---|
| `wide_reveal` | Slow zoom-out from center | hook |
| `tension_creep` | Imperceptible slow zoom-in | setup |
| `chaos_shake` | Subtle handheld wobble | tension |
| `perspective_shift` | 15° rotate + zoom-out | turn |
| `reveal_pan` | Lateral pan left-to-right | revelation |
| `hero_rise` | Low angle tilt-up | payoff |
| `clarity_lock` | Locked-off static | cta |
| `intimacy_push` | Slow dolly-in toward subject | — |
| `memory_drift` | Gentle drift right + rack focus | — |
| `emotional_hold` | Ultra-slow zoom-in 5% | — |

---

## Environment Variables

| Var | Side | Step | Source |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client | 1 | clerk.com |
| `CLERK_SECRET_KEY` | Server | 1 | clerk.com |
| `GROQ_API_KEY` | Server | 2 | console.groq.com |
| `NEXT_PUBLIC_SUPABASE_URL` | Client | 4 | supabase.com |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | 4 | supabase.com |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | 4 | supabase.com |
| `R2_ACCOUNT_ID` | Server | 4 | cloudflare.com |
| `R2_ACCESS_KEY_ID` | Server | 4 | cloudflare.com |
| `R2_SECRET_ACCESS_KEY` | Server | 4 | cloudflare.com |
| `R2_BUCKET_NAME` | Server | 4 | cloudflare.com |

---

## Upgrade Swaps

Each upgrade is isolated to one function or one file. No cascading changes.

| Current | Upgrade | Change |
|---|---|---|
| Kokoro TTS | ElevenLabs | Swap `synthesizeSpeech()` in `/api/render/tts.ts` |
| Pollinations | FLUX / Replicate | Swap `generateImage()` in `/api/render/images.ts` |
| Remotion OSS | Remotion Lambda | Change `renderMedia()` call — same composition |
| Supabase free | Supabase Pro | Billing upgrade, no code changes |
| Cloudflare free | Cloudflare paid | Billing upgrade, no code changes |
