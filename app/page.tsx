import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="wordmark">ViralOS<span> AI</span></div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/sign-in" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/sign-up" className="btn btn-primary btn-sm">Start free →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-eyebrow">AI Video Engine · Phase 1</div>
        <h1 className="hero-title">
          Make videos that<br />
          <span className="gradient">actually go viral</span>
        </h1>
        <p className="hero-sub">
          Cinematic AI videos with real MP4 output, synced captions, Ken Burns motion,
          and voice narration — generated in under 60 seconds.
        </p>
        <div className="hero-cta-row">
          <Link href="/sign-up" className="btn btn-accent btn-lg">
            Create your first video →
          </Link>
          <Link href="/sign-in" className="btn btn-ghost btn-lg">
            Sign in
          </Link>
        </div>

        {/* Proof points */}
        <div className="hero-proof">
          {[
            ['< 60s', 'Render time'],
            ['9:16 + 16:9', 'Aspect ratios'],
            ['7-beat', 'Story engine'],
            ['Free', 'To start'],
          ].map(([num, label]) => (
            <div className="proof-item" key={label}>
              <div className="proof-num">{num}</div>
              <div className="proof-label">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
