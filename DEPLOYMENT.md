# ViralOS — Deployment Guide

## Architecture Overview

```
Cloudflare Pages (Next.js frontend + API routes)
    ├── Clerk           — Authentication
    ├── Groq            — AI script generation
    ├── Supabase        — Postgres database (projects, renders, users)
    ├── Cloudflare R2   — MP4 video storage
    ├── Remotion        — Server-side video rendering (Node.js runtime)
    └── Cloudflare Queues + Worker — Async render dispatch (optional)
```

> **Important:** Remotion requires a **Node.js runtime** for video rendering. It cannot run inside a Cloudflare Worker edge runtime. The `/api/render/run` route must run on a Node.js server (e.g., a VPS, Railway, Render.com, or Cloudflare Pages with Node.js compatibility). The Cloudflare Worker delegates render work back to the Next.js app via HTTP.

---

## Prerequisites

- Node.js 20+
- npm 10+
- A Cloudflare account (free)
- A Clerk account (free)
- A Supabase account (free)
- A Groq account (free)

---

## Step 1 — Clone & Install

```bash
git clone https://github.com/YOUR_ORG/viralos.git
cd viralos
npm install
cp .env.example .env.local
```

---

## Step 2 — Configure Clerk (Auth)

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Create a new application
3. Copy your **Publishable Key** and **Secret Key**
4. Set in `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

5. In Clerk dashboard → Domains → add your production domain

---

## Step 3 — Configure Groq (AI Script Generation)

1. Go to [https://console.groq.com](https://console.groq.com)
2. Create an API key
3. Set in `.env.local`:

```env
GROQ_API_KEY=gsk_...
```

---

## Step 4 — Configure Supabase (Database)

1. Go to [https://supabase.com](https://supabase.com) → New project
2. Go to **SQL Editor** and run the migrations **in order**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_stripe_subscriptions.sql`
   - `supabase/migrations/003_health_indexes.sql`
3. Go to **Project Settings → API** and copy your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Step 5 — Configure Cloudflare R2 (Video Storage)

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) → R2
2. Create a bucket named **`viralos-media`**
3. Go to **Manage R2 API tokens** → Create token (Object Read & Write)
4. Set in `.env.local`:

```env
R2_ACCOUNT_ID=YOUR_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY
R2_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
R2_BUCKET_NAME=viralos-media
```

---

## Step 6 — Configure Voice (TTS)

### Option A — Piper TTS (free, self-hosted)

```bash
docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.2
```

```env
PIPER_API_URL=http://localhost:8880
```

### Option B — ElevenLabs (10k chars/month free)

```env
ELEVENLABS_API_KEY=YOUR_KEY
```

### Option C — No voice (silent fallback)

Leave TTS vars unset. Videos render with silent audio.

---

## Step 7 — Local Development

```bash
npm run dev
# App available at http://localhost:3000
# Health check: http://localhost:3000/api/health
```

---

## Step 8 — Deploy to Cloudflare Pages

### Via Cloudflare Dashboard (recommended)

1. Push your code to GitHub
2. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) → Pages → Create application
3. Connect your GitHub repository
4. Build settings:
   - **Build command:** `npx @cloudflare/next-on-pages`
   - **Build output directory:** `.vercel/output/static`
   - **Node.js version:** 20
5. Set all environment variables from `.env.example` under **Settings → Environment variables**
6. Deploy

### Via GitHub Actions (CI/CD)

Add the following secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `GROQ_API_KEY` | Groq API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `NEXT_APP_URL` | Production app URL |
| `RENDER_WORKER_SECRET` | Worker shared secret |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_API_TOKEN` | Cloudflare API token |

Pushes to `main` will automatically deploy.

---

## Step 9 — (Optional) Async Render Queue

For renders that exceed HTTP timeout limits (>2 min), set up the Cloudflare Queue:

```bash
# Create the queue
wrangler queues create viralos-render

# Deploy the render worker
wrangler deploy --config worker/wrangler.worker.toml
```

Set in `.env.local` / Cloudflare Pages env vars:
```env
CF_ACCOUNT_ID=...
CF_API_TOKEN=...
RENDER_QUEUE_NAME=viralos-render
RENDER_WORKER_SECRET=your_random_secret_here
```

---

## Verifying Your Deployment

```bash
curl https://your-viralos.pages.dev/api/health | jq .
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "clerk": { "status": "ok" },
    "groq": { "status": "ok" },
    "supabase": { "status": "ok" },
    "r2": { "status": "ok" }
  }
}
```

---

## Troubleshooting

**Build fails with "Cannot find module '@remotion/renderer'"**
→ Remotion is a peer dependency. Run `npm install` with all packages present.

**`auth()` returns null in API routes**
→ Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set and your domain is configured in Clerk.

**Videos render but don't save**
→ R2 is not configured. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

**Library shows empty even after rendering**
→ Supabase is not configured. Run the migrations and set Supabase env vars.

**Renders time out on Cloudflare Pages**
→ Cloudflare Pages has a 30s execution limit. Enable the async queue (Step 9) or deploy the render server separately on Railway/Render.com.
