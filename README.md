# ViralOS AI Content Engine

Production-grade AI video creation platform — InVideo competitor.

## Stack
- **Frontend**: Next.js 15 (App Router) → Cloudflare Pages
- **Auth**: Clerk (Google + email, free tier)
- **Database**: Supabase (Step 4)
- **Storage**: Cloudflare R2 (Step 4)
- **Scripts**: Groq llama-3.3-70b (Step 2)
- **TTS**: Kokoro (Step 3)
- **Images**: Pollinations (Step 3)
- **Video**: Remotion OSS (Step 3)
- **Queue**: Cloudflare Queues (Step 5)

## Phase 1 Build Status
- [x] Step 1: App shell + Clerk auth
- [ ] Step 2: Groq script generation
- [ ] Step 3: Remotion video renderer
- [ ] Step 4: Supabase + R2 storage
- [ ] Step 5: Cloudflare Queue + Worker

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
# Add your Clerk keys from https://dashboard.clerk.com
```

### 3. Run dev server
```bash
npm run dev
# Open http://localhost:3000
```

### 4. Deploy to Cloudflare Pages
```bash
# Connect your GitHub repo to Cloudflare Pages
# Build command: npm run build
# Output directory: .next
# Add all .env vars to Cloudflare Pages environment variables
```

## Clerk Setup (5 minutes)
1. Create account at https://clerk.com
2. Create new application → enable Google + Email
3. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
4. Paste into `.env.local`
5. Run `npm run dev` → auth works immediately

## Architecture

```
app/
├── (auth)/
│   ├── sign-in/     # Clerk sign-in
│   └── sign-up/     # Clerk sign-up
├── (app)/           # Protected routes
│   ├── layout.tsx   # Shell: topnav + sidebar
│   ├── dashboard/   # Stats + build progress
│   ├── new-project/ # Video creation form
│   └── library/     # Video library
├── layout.tsx       # ClerkProvider root
└── page.tsx         # Landing / marketing

components/
└── NavItems.tsx     # Client-side nav with active state

middleware.ts        # Clerk auth guard
```

## Upgrade Path (no rewrites ever)
| Current | Upgrade | Trigger |
|---------|---------|---------|
| Kokoro TTS | ElevenLabs | Swap one function |
| Pollinations | FLUX API | Swap one function |
| Remotion OSS | Remotion Lambda | Zero architecture change |
| Supabase free | Supabase Pro | Billing upgrade |
| Cloudflare free | Cloudflare paid | Billing upgrade |
