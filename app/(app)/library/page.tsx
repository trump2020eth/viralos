'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface RenderJob {
  id: string
  job_id: string
  status: string
  duration_seconds: number | null
  r2_url: string | null
  r2_key: string | null
  completed_at: string | null
}

interface Project {
  id: string
  title: string
  niche: string | null
  format: '9:16' | '16:9' | '1:1'
  duration_target: number | null
  status: 'draft' | 'rendering' | 'done' | 'error'
  caption_style: string | null
  voice: string | null
  created_at: string
  updated_at: string
  render_jobs: RenderJob[]
}

const FILTERS = ['All', 'Done', 'Rendering', 'Draft', 'Error']
const SORTS   = ['Newest', 'Oldest']

// R2 URLs expire after 7 days. Refresh if completed_at is older than 6 days.
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000

async function refreshExpiredUrl(r2Key: string): Promise<string | null> {
  try {
    const res = await fetch('/api/videos/refresh-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ r2Key }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.url || null
  } catch {
    return null
  }
}

export default function LibraryPage() {
  const [projects, setProjects]   = useState<Project[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState('All')
  const [sort, setSort]           = useState('Newest')
  // Track refreshed URLs: { [r2Key]: freshUrl }
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>({})

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || `API error ${res.status}`)
      }
      const data = await res.json()
      const fetched: Project[] = data.projects || []
      setProjects(fetched)

      // Check for expired R2 URLs and refresh them silently
      for (const project of fetched) {
        const latestRender = getLatestRender(project)
        if (!latestRender?.r2_key || !latestRender?.r2_url || !latestRender.completed_at) continue

        const age = Date.now() - new Date(latestRender.completed_at).getTime()
        if (age > SIX_DAYS_MS) {
          // URL may be expired — refresh in background
          refreshExpiredUrl(latestRender.r2_key).then(freshUrl => {
            if (freshUrl) {
              setRefreshedUrls(prev => ({ ...prev, [latestRender.r2_key!]: freshUrl }))
            }
          })
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load library')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const filtered = projects
    .filter(p => filter === 'All' || p.status === filter.toLowerCase())
    .sort((a, b) => {
      if (sort === 'Newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

  function getLatestRender(project: Project): RenderJob | null {
    if (!project.render_jobs?.length) return null
    return project.render_jobs.sort(
      (a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
    )[0]
  }

  function getVideoUrl(render: RenderJob): string | null {
    // Use refreshed URL if available, otherwise fall back to stored URL
    if (render.r2_key && refreshedUrls[render.r2_key]) {
      return refreshedUrls[render.r2_key]
    }
    return render.r2_url
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Library</h1>
        <p className="page-sub">All your generated videos, renders, and drafts.</p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--r-sm)',
                border: `1px solid ${filter === f ? 'var(--brand-400)' : 'var(--border)'}`,
                background: filter === f ? 'rgba(124,58,237,0.12)' : 'var(--bg-surface)',
                color: filter === f ? 'var(--brand-300)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: filter === f ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sort:</span>
          <select
            className="input"
            style={{ width: 'auto', padding: '6px 28px 6px 10px', fontSize: '12px' }}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            {SORTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <Link href="/new-project" className="btn btn-primary btn-sm">
            + New Video
          </Link>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading library…</div>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
            <span style={{ fontSize: '13px', color: '#f87171' }}>{error}</span>
            <button onClick={fetchProjects} className="btn btn-ghost btn-sm">Retry</button>
          </div>
          {error.includes('Supabase') || error.includes('Database') ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to .env.local to enable the library.
            </p>
          ) : null}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 11H5M19 11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2M19 11V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>
            </svg>
            <div className="empty-title">
              {filter === 'All' ? 'No videos yet' : `No ${filter.toLowerCase()} videos`}
            </div>
            <div className="empty-sub">
              {filter === 'All'
                ? 'Generate your first video and it will appear here automatically.'
                : 'Switch filters or generate a new video.'}
            </div>
            <Link href="/new-project" className="btn btn-primary" style={{ marginTop: '8px' }}>
              Create first video →
            </Link>
          </div>
        </div>
      )}

      {/* Video grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid-auto">
          {filtered.map((project) => {
            const latestRender = getLatestRender(project)
            const videoUrl = latestRender ? getVideoUrl(latestRender) : null
            const hasVideo = project.status === 'done' && !!videoUrl
            const isRendering = project.status === 'rendering'

            return (
              <div className="video-card" key={project.id}>
                {/* Thumbnail */}
                <div className={`video-thumbnail ${project.format === '16:9' ? 'video-thumbnail-16-9' : ''}`}>
                  {hasVideo ? (
                    <video
                      src={videoUrl!}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      muted
                      playsInline
                      onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                      onMouseLeave={e => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0 }}
                    />
                  ) : (
                    <div className="thumb-placeholder">
                      <svg className="thumb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
                      </svg>
                      {isRendering ? 'Rendering…' : project.status === 'draft' ? 'Draft' : 'No preview'}
                    </div>
                  )}

                  {/* Download button overlay */}
                  {hasVideo && (
                    <a
                      href={videoUrl!}
                      download={`${project.title}.mp4`}
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      ↓ MP4
                    </a>
                  )}
                </div>

                {/* Meta */}
                <div className="video-meta">
                  <div className="video-title">{project.title}</div>
                  <div className="video-info">
                    <span className={`badge badge-${project.status === 'done' ? 'done' : project.status === 'rendering' ? 'rendering' : project.status === 'error' ? 'error' : 'pending'}`}>
                      {project.status}
                    </span>
                    <span>
                      {latestRender?.duration_seconds
                        ? `${latestRender.duration_seconds}s · `
                        : ''}
                      {project.format}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
