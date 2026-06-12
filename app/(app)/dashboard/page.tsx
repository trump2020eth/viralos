import { auth, currentUser } from '@clerk/nextjs/server'
import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase'

async function getDashboardStats(userId: string) {
  // Graceful fallback if Supabase not configured
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return null
  }

  try {
    const db = getSupabaseAdmin()

    const [projectsRes, rendersRes] = await Promise.all([
      db.from('projects').select('id, status, format, created_at').eq('clerk_user_id', userId),
      db.from('render_jobs').select('id, status, duration_seconds, r2_key').eq('clerk_user_id', userId).eq('status', 'done'),
    ])

    const projects = projectsRes.data || []
    const renders  = rendersRes.data || []

    const totalDuration = renders.reduce((s: number, r: any) => s + (r.duration_seconds || 0), 0)

    return {
      videosCreated: projects.length,
      rendersComplete: renders.length,
      totalDurationSeconds: Math.round(totalDuration),
      storageUsedMb: renders.length * 8, // rough estimate ~8MB/video
    }
  } catch {
    return null
  }
}

async function getRecentProjects(userId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return []
  }
  try {
    const db = getSupabaseAdmin()
    const { data } = await db
      .from('projects')
      .select('id, title, status, format, created_at, render_jobs(status, duration_seconds, r2_url)')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4)
    return data || []
  } catch {
    return []
  }
}

export default async function DashboardPage() {
  const { userId } = await auth()
  const user = await currentUser()
  const firstName = user?.firstName || 'Creator'

  // Sync user to Supabase (fire and forget — non-blocking)
  // We do this server-side to avoid a client-side fetch on every load
  if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const db = getSupabaseAdmin()
      await db.from('users').upsert(
        {
          clerk_user_id: userId,
          email: user?.emailAddresses?.[0]?.emailAddress ?? null,
          display_name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clerk_user_id' }
      )
    } catch {
      // Non-fatal
    }
  }

  const [stats, recentProjects] = await Promise.all([
    userId ? getDashboardStats(userId) : Promise.resolve(null),
    userId ? getRecentProjects(userId) : Promise.resolve([]),
  ])

  const STATS = stats
    ? [
        { label: 'Videos Created',   value: String(stats.videosCreated),  delta: stats.videosCreated ? 'Keep creating →' : 'Start generating →' },
        { label: 'Renders Complete', value: String(stats.rendersComplete), delta: 'Real MP4 via Remotion' },
        { label: 'Total Runtime',    value: stats.totalDurationSeconds ? `${stats.totalDurationSeconds}s` : '0s', delta: 'Combined video duration' },
        { label: 'Storage Used',     value: stats.storageUsedMb ? `~${stats.storageUsedMb}MB` : '0 MB', delta: 'Cloudflare R2 · 10GB free' },
      ]
    : [
        { label: 'Videos Created',   value: '—', delta: 'Connect Supabase to track stats' },
        { label: 'Renders Complete', value: '—', delta: 'Add SUPABASE vars in .env.local' },
        { label: 'Total Runtime',    value: '—', delta: 'Step 4 complete' },
        { label: 'Storage Used',     value: '—', delta: 'R2 · 10GB free' },
      ]

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Welcome back, {firstName}</h1>
        <p className="page-sub">Your AI content engine — build once, publish everywhere.</p>
      </div>

      {/* Quick actions */}
      <div className="quick-actions">
        <Link href="/new-project" className="btn btn-accent">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Video
        </Link>
        <Link href="/library" className="btn btn-ghost">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M19 11H5M19 11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2M19 11V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>
          </svg>
          View Library
        </Link>
      </div>

      {/* Stats */}
      <div className="stats-row">
        {STATS.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-delta">{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Build progress */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">Build Progress</div>
          <span className="badge badge-rendering">Phase 1</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { step: '1', label: 'App shell + Clerk auth',            done: true },
            { step: '2', label: 'Groq script generation (server-side)', done: true },
            { step: '3', label: 'Remotion video renderer — real MP4s', done: true },
            { step: '4', label: 'Supabase schema + R2 storage',      done: true, current: true },
            { step: '5', label: 'Cloudflare Queue — async renders',  done: false },
          ].map(item => (
            <div key={item.step} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: 'var(--r-sm)',
              background: item.done ? 'rgba(34,197,94,0.06)' : 'var(--bg-raised)',
              border: `1px solid ${item.done ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
            }}>
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: item.done ? 'var(--success)' : 'var(--bg-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: '700',
                color: item.done ? 'white' : 'var(--text-muted)',
                flexShrink: 0,
              }}>
                {item.done ? '✓' : item.step}
              </div>
              <span style={{
                fontSize: '13.5px',
                color: item.done ? 'var(--success)' : 'var(--text-secondary)',
                fontWeight: item.done ? '600' : '400',
              }}>
                {item.label}
              </span>
              {item.current && (
                <span className="badge badge-done" style={{ marginLeft: 'auto' }}>Just done</span>
              )}
              {!item.done && item.step === '5' && (
                <span className="badge badge-pending" style={{ marginLeft: 'auto' }}>Next</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent videos */}
      <div className="section-row">
        <div className="section-title">Recent Videos</div>
        <Link href="/library" className="btn btn-ghost btn-sm">View all</Link>
      </div>

      {recentProjects.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
            </svg>
            <div className="empty-title">No videos yet</div>
            <div className="empty-sub">Generate your first AI video to get started. Takes about 60 seconds.</div>
            <Link href="/new-project" className="btn btn-primary" style={{ marginTop: '8px' }}>
              Create first video →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid-auto">
          {(recentProjects as any[]).map((project: any) => (
            <div className="video-card" key={project.id}>
              <div className={`video-thumbnail ${project.format === '16:9' ? 'video-thumbnail-16-9' : ''}`}>
                <div className="thumb-placeholder">
                  <svg className="thumb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
                  </svg>
                  {project.status}
                </div>
              </div>
              <div className="video-meta">
                <div className="video-title">{project.title}</div>
                <div className="video-info">
                  <span className={`badge badge-${project.status === 'done' ? 'done' : project.status === 'rendering' ? 'rendering' : 'pending'}`}>
                    {project.status}
                  </span>
                  <span>{project.format}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
