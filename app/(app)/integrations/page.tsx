'use client'

import { useState, useEffect } from 'react'

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Integration {
  id: string
  name: string
  category: 'required' | 'recommended' | 'optional'
  tier: string
  description: string
  envVars: { key: string; hint: string; secret?: boolean }[]
  steps: { label: string; url?: string; code?: string }[]
  docsUrl: string
  signupUrl: string
  cost: string
  status?: 'connected' | 'partial' | 'missing'
}

const INTEGRATIONS: Integration[] = [
  // ── Required ───────────────────────────────────────────────────────────────
  {
    id: 'clerk',
    name: 'Clerk',
    category: 'required',
    tier: 'Auth',
    description: 'User authentication. Google + email sign-in, user management dashboard. Required — app will not load without this.',
    envVars: [
      { key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', hint: 'Starts with pk_test_ or pk_live_' },
      { key: 'CLERK_SECRET_KEY', hint: 'Starts with sk_test_ or sk_live_', secret: true },
    ],
    steps: [
      { label: 'Sign up at clerk.com (free)', url: 'https://clerk.com' },
      { label: 'Create a new application', url: 'https://dashboard.clerk.com' },
      { label: 'Go to API Keys in your app dashboard' },
      { label: 'Copy Publishable Key → NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY' },
      { label: 'Copy Secret Key → CLERK_SECRET_KEY' },
    ],
    docsUrl: 'https://clerk.com/docs/quickstarts/nextjs',
    signupUrl: 'https://clerk.com',
    cost: 'Free — 10k MAU',
  },
  {
    id: 'groq',
    name: 'Groq',
    category: 'required',
    tier: 'AI Script',
    description: 'LLM for script + storyboard generation. Uses llama-3.3-70b-versatile. Required for New Video to work.',
    envVars: [
      { key: 'GROQ_API_KEY', hint: 'Starts with gsk_', secret: true },
    ],
    steps: [
      { label: 'Sign up at console.groq.com (free)', url: 'https://console.groq.com' },
      { label: 'Go to API Keys → Create API Key' },
      { label: 'Copy key → GROQ_API_KEY' },
    ],
    docsUrl: 'https://console.groq.com/docs/quickstart',
    signupUrl: 'https://console.groq.com',
    cost: 'Free — generous rate limits',
  },

  // ── Recommended ────────────────────────────────────────────────────────────
  {
    id: 'supabase',
    name: 'Supabase',
    category: 'recommended',
    tier: 'Database',
    description: 'Postgres database. Stores projects, render jobs, video library. Without this, nothing is saved between sessions.',
    envVars: [
      { key: 'NEXT_PUBLIC_SUPABASE_URL', hint: 'https://xxxx.supabase.co' },
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', hint: 'Starts with eyJ...', secret: true },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', hint: 'Starts with eyJ... — server-side only', secret: true },
    ],
    steps: [
      { label: 'Create free project at supabase.com', url: 'https://supabase.com' },
      { label: 'Go to Project Settings → API' },
      { label: 'Copy Project URL → NEXT_PUBLIC_SUPABASE_URL' },
      { label: 'Copy anon public key → NEXT_PUBLIC_SUPABASE_ANON_KEY' },
      { label: 'Copy service_role key → SUPABASE_SERVICE_ROLE_KEY' },
      { label: 'Open SQL Editor and run migrations/001_initial_schema.sql', url: 'https://supabase.com/dashboard/project/_/sql' },
    ],
    docsUrl: 'https://supabase.com/docs/guides/getting-started/quickstarts/nextjs',
    signupUrl: 'https://supabase.com',
    cost: 'Free — 500MB DB, 1GB storage',
  },
  {
    id: 'r2',
    name: 'Cloudflare R2',
    category: 'recommended',
    tier: 'Storage',
    description: 'Object storage for rendered MP4s and generated images. Without this, videos are returned as base64 (no library, no persistent links).',
    envVars: [
      { key: 'R2_ACCOUNT_ID', hint: 'Cloudflare account ID (32-char hex)' },
      { key: 'R2_ACCESS_KEY_ID', hint: 'R2 API token access key', secret: true },
      { key: 'R2_SECRET_ACCESS_KEY', hint: 'R2 API token secret', secret: true },
      { key: 'R2_BUCKET_NAME', hint: 'e.g. viralos-media' },
    ],
    steps: [
      { label: 'Open Cloudflare dashboard', url: 'https://dash.cloudflare.com' },
      { label: 'Go to R2 → Create bucket named viralos-media' },
      { label: 'Go to R2 → Manage R2 API Tokens → Create Token (Object Read & Write)' },
      { label: 'Copy Account ID (right sidebar) → R2_ACCOUNT_ID' },
      { label: 'Copy Access Key ID → R2_ACCESS_KEY_ID' },
      { label: 'Copy Secret Access Key → R2_SECRET_ACCESS_KEY' },
    ],
    docsUrl: 'https://developers.cloudflare.com/r2/api/s3/tokens/',
    signupUrl: 'https://dash.cloudflare.com',
    cost: 'Free — 10GB storage, 1M requests/mo',
  },

  // ── Voice Tier 1 ───────────────────────────────────────────────────────────
  {
    id: 'piper',
    name: 'Piper TTS',
    category: 'recommended',
    tier: 'Voice · Tier 1',
    description: 'Free local TTS. Run via Docker. Without this, renders use silent audio. Kokoro docker image is Piper-compatible.',
    envVars: [
      { key: 'PIPER_API_URL', hint: 'http://localhost:8880 (or your hosted URL)' },
    ],
    steps: [
      { label: 'Install Docker Desktop', url: 'https://www.docker.com/products/docker-desktop/' },
      { label: 'Run in terminal:', code: 'docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.2' },
      { label: 'Set PIPER_API_URL=http://localhost:8880' },
      { label: 'Restart dev server' },
    ],
    docsUrl: 'https://github.com/remsky/Kokoro-FastAPI',
    signupUrl: 'https://www.docker.com/products/docker-desktop/',
    cost: 'Free — runs locally',
  },

  // ── Voice Tier 2 ───────────────────────────────────────────────────────────
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    category: 'optional',
    tier: 'Voice · Tier 2',
    description: 'High-quality AI voices. 10k characters/month free. Dramatically better than Piper for narration. Falls back to Piper if quota hit.',
    envVars: [
      { key: 'ELEVENLABS_API_KEY', hint: 'Starts with sk_...', secret: true },
    ],
    steps: [
      { label: 'Sign up free at elevenlabs.io', url: 'https://elevenlabs.io' },
      { label: 'Click profile icon → Profile + API Key' },
      { label: 'Copy API Key → ELEVENLABS_API_KEY' },
    ],
    docsUrl: 'https://elevenlabs.io/docs/api-reference/getting-started',
    signupUrl: 'https://elevenlabs.io',
    cost: 'Free — 10k chars/mo · Pro $5/mo',
  },
  {
    id: 'playht',
    name: 'PlayHT',
    category: 'optional',
    tier: 'Voice · Tier 2 fallback',
    description: 'AI voices. 12k characters/month free. Used automatically when ElevenLabs quota is exceeded. Can also be selected directly.',
    envVars: [
      { key: 'PLAYHT_API_KEY', hint: 'From play.ht API Access page', secret: true },
      { key: 'PLAYHT_USER_ID', hint: 'Your Play.ht user ID' },
    ],
    steps: [
      { label: 'Sign up free at play.ht', url: 'https://play.ht' },
      { label: 'Go to API Access page', url: 'https://play.ht/studio/api-access' },
      { label: 'Copy API Secret Key → PLAYHT_API_KEY' },
      { label: 'Copy User ID → PLAYHT_USER_ID' },
    ],
    docsUrl: 'https://docs.play.ht/reference/api-getting-started',
    signupUrl: 'https://play.ht',
    cost: 'Free — 12k chars/mo · Creator $31/mo',
  },

  // ── Render Queue ───────────────────────────────────────────────────────────
  {
    id: 'cf-queues',
    name: 'Cloudflare Queues',
    category: 'optional',
    tier: 'Render Queue',
    description: 'Async render dispatch. Eliminates the 2-minute HTTP timeout for longer videos. Without this, renders run synchronously (works fine for short videos).',
    envVars: [
      { key: 'CF_ACCOUNT_ID', hint: 'Cloudflare account ID' },
      { key: 'CF_API_TOKEN', hint: 'Token with Queues Write permission', secret: true },
      { key: 'RENDER_QUEUE_NAME', hint: 'viralos-render (default)' },
      { key: 'RENDER_WORKER_SECRET', hint: 'Random secret 32+ chars', secret: true },
      { key: 'NEXT_APP_URL', hint: 'https://your-app.pages.dev (or localhost:3000)' },
    ],
    steps: [
      { label: 'Install Wrangler CLI:', code: 'npm install -g wrangler && wrangler login' },
      { label: 'Create queue:', code: 'wrangler queues create viralos-render' },
      { label: 'Get Account ID from Cloudflare dashboard right sidebar → CF_ACCOUNT_ID' },
      { label: 'Create API token with Queues Write permission', url: 'https://dash.cloudflare.com/profile/api-tokens' },
      { label: 'Generate a random secret (32+ chars) → RENDER_WORKER_SECRET' },
      { label: 'Deploy worker:', code: 'cd worker && wrangler deploy --config wrangler.worker.toml' },
    ],
    docsUrl: 'https://developers.cloudflare.com/queues/get-started/',
    signupUrl: 'https://dash.cloudflare.com',
    cost: 'Free — 1M operations/mo',
  },
]

const CATEGORY_ORDER = ['required', 'recommended', 'optional'] as const

const CATEGORY_META = {
  required: { label: 'Required', color: '#ef4444', desc: 'App will not function without these' },
  recommended: { label: 'Recommended', color: '#f97316', desc: 'Core features — set these up first' },
  optional: { label: 'Optional', color: '#6b7280', desc: 'Quality upgrades and advanced features' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [open, setOpen] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'required' | 'recommended' | 'optional'>('all')
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  function toggleOpen(id: string) {
    setOpen(prev => prev === id ? null : id)
  }

  function copyCode(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1800)
    })
  }

  function toggleSecret(key: string) {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const filtered = INTEGRATIONS.filter(i => filter === 'all' || i.category === filter)

  const counts = {
    required: INTEGRATIONS.filter(i => i.category === 'required').length,
    recommended: INTEGRATIONS.filter(i => i.category === 'recommended').length,
    optional: INTEGRATIONS.filter(i => i.category === 'optional').length,
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Integrations</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
          Everything ViralOS needs to run. Set each env var in <code style={codeStyle}>.env.local</code> and restart the dev server.
        </p>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {CATEGORY_ORDER.map(cat => (
          <div
            key={cat}
            style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${filter === cat ? CATEGORY_META[cat].color : 'var(--border-default)'}`,
              borderRadius: 10,
              padding: '10px 16px',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
              flex: 1,
              minWidth: 140,
            }}
            onClick={() => setFilter(filter === cat ? 'all' : cat)}
          >
            <div style={{ fontSize: 11, color: CATEGORY_META[cat].color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              {CATEGORY_META[cat].label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{counts[cat]}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{CATEGORY_META[cat].desc}</div>
          </div>
        ))}
      </div>

      {/* Quick setup order */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '14px 18px', marginBottom: 28, fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommended setup order</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {['Clerk', 'Groq', 'Supabase', 'R2', 'Piper TTS', 'ElevenLabs'].map((name, i, arr) => (
            <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: 'var(--bg-raised)', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
                onClick={() => { setFilter('all'); setOpen(INTEGRATIONS.find(x => x.name === name)?.id ?? null) }}>
                {name}
              </span>
              {i < arr.length - 1 && <span style={{ color: 'var(--text-muted)' }}>→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Integration cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(integration => {
          const isOpen = open === integration.id
          const catColor = CATEGORY_META[integration.category].color

          return (
            <div
              key={integration.id}
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${isOpen ? catColor : 'var(--border-default)'}`,
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Card header — always visible */}
              <button
                onClick={() => toggleOpen(integration.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'inherit', textAlign: 'left',
                }}
              >
                {/* Category dot */}
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: catColor, flexShrink: 0 }} />

                {/* Name + tier */}
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{integration.name}</span>
                  <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-raised)', borderRadius: 5, padding: '2px 7px' }}>
                    {integration.tier}
                  </span>
                </span>

                {/* Cost badge */}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: integration.cost.startsWith('Free') ? '#22c55e' : 'var(--text-muted)' }}>
                    {integration.cost.split('·')[0].trim()}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}>{isOpen ? '▲' : '▼'}</span>
                </span>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border-default)' }}>

                  {/* Description */}
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '14px 0 18px', lineHeight: 1.6 }}>
                    {integration.description}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

                    {/* Setup steps */}
                    <div>
                      <div style={sectionLabel}>Setup steps</div>
                      <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {integration.steps.map((step, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {step.url ? (
                              <a href={step.url} target="_blank" rel="noreferrer"
                                style={{ color: 'var(--accent-400)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                                {step.label}
                              </a>
                            ) : step.label}
                            {step.code && (
                              <div
                                onClick={() => copyCode(step.code!, `step-${integration.id}-${i}`)}
                                style={{
                                  ...codeBlockStyle,
                                  cursor: 'pointer',
                                  marginTop: 4,
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}
                              >
                                <code style={{ fontSize: 11, fontFamily: 'monospace', color: '#86efac' }}>{step.code}</code>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                                  {copiedKey === `step-${integration.id}-${i}` ? '✓ copied' : 'copy'}
                                </span>
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>

                      {/* Links */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                        <a href={integration.signupUrl} target="_blank" rel="noreferrer"
                          style={{ ...linkBtnStyle, background: 'var(--accent-500)', color: 'white' }}>
                          Sign up →
                        </a>
                        <a href={integration.docsUrl} target="_blank" rel="noreferrer"
                          style={{ ...linkBtnStyle, background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
                          Docs ↗
                        </a>
                      </div>
                    </div>

                    {/* Env vars */}
                    <div>
                      <div style={sectionLabel}>Environment variables</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {integration.envVars.map(ev => (
                          <div key={ev.key} style={{ background: 'var(--bg-raised)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                              <code
                                style={{ fontSize: 11, fontFamily: 'monospace', color: '#86efac', cursor: 'pointer', flex: 1, wordBreak: 'break-all' }}
                                onClick={() => copyCode(ev.key, ev.key)}
                                title="Click to copy"
                              >
                                {ev.key}
                              </code>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                                {copiedKey === ev.key ? '✓' : 'copy'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {ev.secret && (
                                <span style={{ color: '#f59e0b', marginRight: 4 }}>🔑 secret ·</span>
                              )}
                              {ev.hint}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Paste reminder */}
                      <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Add to <code style={{ color: '#86efac', fontFamily: 'monospace' }}>.env.local</code> in your project root.<br />
                        <span style={{ color: 'var(--accent-400)' }}>Never commit this file.</span> It's in <code style={{ fontFamily: 'monospace' }}>.gitignore</code> by default.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 32, padding: '16px 18px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-default)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>After setting env vars</strong> — restart the dev server (<code style={{ fontFamily: 'monospace', color: '#86efac' }}>npm run dev</code>).
        Changes to <code style={{ fontFamily: 'monospace', color: '#86efac' }}>.env.local</code> are not picked up automatically.<br />
        For Cloudflare deployment, add vars in <strong>Pages → Settings → Environment Variables</strong> and redeploy.
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const codeStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 12,
  background: 'var(--bg-raised)',
  borderRadius: 4,
  padding: '1px 5px',
  color: '#86efac',
}

const codeBlockStyle: React.CSSProperties = {
  background: 'var(--bg-void)',
  borderRadius: 6,
  padding: '7px 10px',
  border: '1px solid var(--border-default)',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  marginBottom: 10,
}

const linkBtnStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 7,
  padding: '6px 14px',
  textDecoration: 'none',
  display: 'inline-block',
}
