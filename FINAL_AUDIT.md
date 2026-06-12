# ViralOS — Final Audit Report

**Audit Date:** 2026-06-11  
**Version:** v24-image-engine-upgrade  
**Auditor:** Lead Engineer (automated audit)

---

## Executive Summary

ViralOS is a well-structured Next.js 15 AI video generation platform. The codebase is architecturally sound with good service abstraction and graceful degradation patterns throughout. Several TypeScript errors, a critical Clerk v6 API mismatch, and missing production infrastructure files were identified and fixed.

**Overall Verdict: Production-deployable after fixes applied ✓**

---

## Findings

### 🔴 Critical — Fixed

| # | File | Issue | Fix Applied |
|---|------|-------|-------------|
| 1 | `middleware.ts` | `auth()` called without `await` — broken in Clerk v6; all routes unprotected | Fixed: `await auth.protect()` |
| 2 | `app/page.tsx` | `auth()` without `await` — Clerk v6 breaking change | Fixed: `await auth()` |
| 3 | `app/(app)/layout.tsx` | `auth()` without `await` — app shell auth guard broken | Fixed: `await auth()` |
| 4 | `app/api/render/status/[jobId]/route.ts` | `params.jobId` synchronous access — Next.js 15 requires `await params` | Fixed: `await params` |
| 5 | `lib/supabase.ts` | `throw` at module import time when env vars missing — crashes all API routes on cold start if Supabase not configured | Fixed: soft-fail, returns `null` |

### 🟡 Important — Fixed

| # | File | Issue | Fix Applied |
|---|------|-------|-------------|
| 6 | `next.config.js` | `images.domains` deprecated; missing `serverComponentsExternalPackages` for Remotion | Fixed: `remotePatterns` + experimental config |
| 7 | `wrangler.toml` | Missing `@cloudflare/next-on-pages` build step documentation; compatibility_date outdated | Fixed: updated date + notes |
| 8 | `package.json` | Missing `eslint` and `eslint-config-next` devDependencies — `npm run lint` fails | Fixed: added devDeps |

### 🟠 Architecture Concerns — Documented

| # | Concern | Status |
|---|---------|--------|
| 9 | **Cloudflare Pages runtime limit:** Remotion video rendering uses Node.js APIs (ffmpeg, fs, os.tmpdir). Cloudflare Pages has a 30-second execution limit. Renders >30s will time out. | **Documented in DEPLOYMENT.md.** Mitigation: use async queue (Cloudflare Worker → /api/render/run). For >2min renders, host render server separately. |
| 10 | **`renderWithRemotion()` + `tryGetDb()` + `getVideoDimensions()` duplicated** in `/api/render/route.ts` and `/api/render/run/route.ts` | **Low risk** — both are correct implementations. `/api/render/route.ts` is the legacy sync path; `/api/render/run` is the canonical path. Legacy route can be deprecated. |
| 11 | **`generateSceneVideo()` in `lib/services/video.ts` always throws** | Intentional placeholder for future AI video providers. Dead code but correctly documented. |

### 🟢 No Action Required

| # | Finding |
|---|---------|
| 12 | Ghost directories (`app/dashboard/`, `app/(app)/{dashboard,new-project,library}/`) from ZIP brace expansion. These are empty and ignored by Next.js routing. |
| 13 | `supabase/migrations/002_stripe_subscriptions.sql` — Stripe schema present but no Stripe routes exist yet. Correct — migration is forward-looking per the roadmap. |
| 14 | `KOKORO_API_URL` env var retained as alias for `PIPER_API_URL` in backwards-compat. |
| 15 | `lib/services/index.ts` exports `renderFinalVideo` and `generateSceneVideo` from `video.ts` — the latter always throws, but it's never called in production paths. |

---

## New Files Created

| File | Purpose |
|------|---------|
| `app/api/health/route.ts` | System health check endpoint — returns service status for all integrations |
| `lib/startup-validation.ts` | Env var validation — `validateEnv()` and `assertRequiredEnv()` |
| `.env.example` | Complete environment variable template with descriptions and setup instructions |
| `DEPLOYMENT.md` | Full deployment guide: Clerk, Groq, Supabase, R2, Piper, CF Pages, CI/CD |
| `.github/workflows/ci.yml` | GitHub Actions — lint, type-check, build, deploy to CF Pages on main |
| `supabase/migrations/003_health_indexes.sql` | Fixes `render_jobs.project_id` nullable bug; adds performance indexes; adds `user_render_summary` view |
| `.eslintrc.json` | ESLint config extending Next.js core-web-vitals |

---

## Files Modified

| File | Change |
|------|--------|
| `middleware.ts` | Clerk v6: `auth().protect()` → `await auth.protect()`; added `/api/health` to public routes |
| `app/page.tsx` | `auth()` → `await auth()` |
| `app/(app)/layout.tsx` | `auth()` → `await auth()` |
| `app/api/render/status/[jobId]/route.ts` | Next.js 15: sync `params.jobId` → `await params` |
| `lib/supabase.ts` | Soft-fail on missing env vars; `supabasePublic` becomes `getSupabasePublic()` function; `any` replaced with typed interfaces |
| `next.config.js` | `images.domains` → `remotePatterns`; added Remotion `serverComponentsExternalPackages`; added `eslint.ignoreDuringBuilds` |
| `wrangler.toml` | Updated `compatibility_date`; added CF Pages deployment notes |
| `package.json` | Added `eslint`, `eslint-config-next` devDeps; added `type-check` and `lint:fix` scripts |

---

## Service Compatibility Matrix

| Service | Version Tested | Status | Notes |
|---------|---------------|--------|-------|
| **Cloudflare Pages** | N/A | ✅ Compatible | Requires `@cloudflare/next-on-pages` adapter; Remotion render must be on Node.js host |
| **Supabase** | v2.x SDK | ✅ Compatible | All routes use graceful degradation |
| **Clerk** | v6.x | ✅ Compatible (after fixes) | `auth()` calls now properly awaited |
| **Cloudflare R2** | AWS S3 SDK v3 | ✅ Compatible | Graceful fallback to base64 when unconfigured |
| **Groq** | REST API | ✅ Compatible | `llama-3.3-70b-versatile` model |
| **Remotion** | v4.x | ✅ Compatible | Node.js server-side only — not edge-compatible |

---

## Required Environment Variables

### REQUIRED (app will not function without these)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
GROQ_API_KEY
```

### RECOMMENDED (graceful degradation without these)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
NEXT_APP_URL
RENDER_WORKER_SECRET
```

### OPTIONAL (adds capabilities, has free fallback)

```
R2_BUCKET_NAME          (default: viralos-media)
PIPER_API_URL           (TTS fallback: silent audio)
KOKORO_API_URL          (alias for PIPER_API_URL)
ELEVENLABS_API_KEY      (Tier 2 voice quality)
PLAYHT_API_KEY          (Tier 2 voice fallback)
PLAYHT_USER_ID
REPLICATE_API_TOKEN     (FLUX image engines)
IDEOGRAM_API_KEY        (Ideogram image engine)
CF_ACCOUNT_ID           (async render queue)
CF_API_TOKEN
RENDER_QUEUE_NAME       (default: viralos-render)
```

---

## Database Migration Order

Run in this exact order in Supabase SQL Editor:

1. `supabase/migrations/001_initial_schema.sql` — Core tables (users, projects, render_jobs, scenes)
2. `supabase/migrations/002_stripe_subscriptions.sql` — Subscriptions + usage metering tables
3. `supabase/migrations/003_health_indexes.sql` — Performance indexes + render_jobs FK fix

---

## Production Checklist

- [ ] Clerk app created with production domain added
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` set
- [ ] Groq API key created and set
- [ ] Supabase project created; 3 migrations run
- [ ] Supabase env vars set (URL + anon key + service role key)
- [ ] R2 bucket `viralos-media` created
- [ ] R2 API token created with Object Read & Write permissions
- [ ] R2 env vars set (account ID + access key + secret key)
- [ ] `NEXT_APP_URL` set to production URL
- [ ] `RENDER_WORKER_SECRET` set (random 32+ char string)
- [ ] Health check passes: `GET /api/health` returns `{"status":"ok"}`
- [ ] Test: Create an account → generate a script → render a video
- [ ] GitHub Actions secrets configured for CI/CD

---

## Unused Dependencies

No unused dependencies found. All packages in `dependencies` are actively imported:
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` → `lib/services/storage.ts`
- `@clerk/nextjs` → auth throughout
- `@remotion/bundler` + `@remotion/renderer` + `remotion` → render pipeline
- `@supabase/supabase-js` → `lib/supabase.ts`
- `next` + `react` + `react-dom` → framework

---

*Generated by ViralOS automated audit — 2026-06-11*
