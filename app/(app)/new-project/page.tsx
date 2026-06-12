'use client'

import { useState } from 'react'
import type { GenerateResponse, SceneDirector } from '@/app/api/generate/route'
import { VOICE_CATALOG, getVoicesByTier } from '@/lib/services/voice'
import { TEMPLATES, getTemplate, type ViralTemplate } from '@/lib/templates'

const NICHES = [
  { value: 'money-psychology', label: '💰 Money Psychology' },
  { value: 'productivity', label: '⚡ Productivity' },
  { value: 'health-fitness', label: '💪 Health & Fitness' },
  { value: 'relationships', label: '❤️ Relationships' },
  { value: 'business', label: '📈 Business' },
  { value: 'philosophy', label: '🧠 Philosophy' },
  { value: 'tech-ai', label: '🤖 Tech & AI' },
  { value: 'true-crime', label: '🔍 True Crime' },
  { value: 'history', label: '📜 History' },
  { value: 'science', label: '🔬 Science' },
  { value: 'custom', label: '✏️ Custom topic' },
]

const FORMATS = [
  { value: '9:16', label: 'TikTok / Reels', desc: 'Vertical · 1080×1920' },
  { value: '16:9', label: 'YouTube', desc: 'Widescreen · 1920×1080' },
  { value: '1:1', label: 'Square', desc: 'Instagram feed · 1080×1080' },
]

const DURATIONS = [
  { value: '30', label: '30s', desc: 'Hook-only' },
  { value: '60', label: '60s', desc: 'Story arc' },
  { value: '90', label: '90s', desc: 'Deep dive' },
]

const ARC_BEAT_LABELS: Record<string, string> = {
  hook: '🎣 Hook',
  setup: '🏗️ Setup',
  tension: '⚡ Tension',
  turn: '🔄 Turn',
  revelation: '💡 Revelation',
  payoff: '🏆 Payoff',
  cta: '📣 CTA',
  expansion_1: '📖 Expansion',
  expansion_2: '📖 Deep Context',
  deep_dive: '🔬 Deep Dive',
}

export default function NewProjectPage() {
  const [templateId, setTemplateId] = useState('tiktok-story')
  const [niche, setNiche] = useState('money-psychology')
  const [format, setFormat] = useState<'9:16' | '16:9' | '1:1'>('9:16')
  const [duration, setDuration] = useState<'30' | '60' | '90'>('60')
  const [customTopic, setCustomTopic] = useState('')
  const [tone, setTone] = useState('engaging')
  const [captionStyle, setCaptionStyle] = useState('tiktok-v2')
  const [voice, setVoice] = useState('kokoro-en-f')
  const [imageEngine, setImageEngine] = useState('pollinations')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null) // Supabase project UUID
  const [expandedScene, setExpandedScene] = useState<number | null>(null)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState('')
  const [renderProgress, setRenderProgress] = useState<string>('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [renderJobId, setRenderJobId] = useState<string | null>(null)
  const [renderAsync, setRenderAsync] = useState(false)
  // Voice tier state
  const [byokProvider, setByokProvider] = useState<'elevenlabs' | 'playht'>('elevenlabs')
  const [byokApiKey, setByokApiKey] = useState('')
  const [byokUserId, setByokUserId] = useState('')
  const [showByok, setShowByok] = useState(false)

  const isCustom = niche === 'custom'

  function handleSelectTemplate(id: string) {
    const tmpl = getTemplate(id)
    if (!tmpl) return
    setTemplateId(id)
    setFormat(tmpl.defaultFormat)
    setDuration(tmpl.defaultDuration)
    setVoice(tmpl.defaultVoice)
    setCaptionStyle(tmpl.captionStyle)
    // Set tone from template — strip the long description, keep first word cluster
    const shortTone = tmpl.tone.split('—')[0].trim().split(',')[0].trim()
    setTone(shortTone)
  }

  async function handleGenerate() {
    setError('')
    setResult(null)
    setProjectId(null)
    setLoading(true)
    setExpandedScene(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          customTopic: isCustom ? customTopic.trim() : undefined,
          format,
          duration,
          tone,
          captionStyle,
          voice,
          imageEngine,
          templateId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `API error ${res.status}`)
      }

      setResult(data)
      setExpandedScene(1)

      // Save project to Supabase (non-blocking — UI proceeds regardless)
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: data,
          niche,
          format,
          duration,
          tone,
          captionStyle,
          voice,
          imageEngine,
        }),
      })
        .then(r => r.json())
        .then(d => {
          if (d?.project?.id) setProjectId(d.project.id)
        })
        .catch(() => {
          // Supabase not configured — local-only mode
        })
    } catch (e: any) {
      setError(e.message || 'Generation failed. Check your setup.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setResult(null)
    setProjectId(null)
    setError('')
    setExpandedScene(null)
    setVideoUrl(null)
    setRenderError('')
    setRenderProgress('')
    setRenderJobId(null)
    setRenderAsync(false)
  }

  /**
   * handleRender — Step 5 upgrade
   * Dispatches to /api/render/queue instead of /api/render directly.
   *
   * Two paths:
   *   async=true  → CF Queue accepted the job → poll /api/render/status/[jobId]
   *   async=false → CF Queue not configured → sync render completed inline
   *
   * Graceful degradation: if queue route fails, falls back to original /api/render.
   */
  async function handleRender() {
    if (!result) return
    setRendering(true)
    setRenderError('')
    setRenderProgress('Dispatching render job…')
    setVideoUrl(null)
    setRenderJobId(null)
    setRenderAsync(false)

    try {
      const res = await fetch('/api/render/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: result,
          captionStyle,
          voice,
          imageEngine,
          projectId: projectId || undefined,
          ...(showByok && byokApiKey ? { byokProvider, byokApiKey, byokUserId: byokUserId || undefined } : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Queue route failed entirely — try legacy /api/render as last resort
        return await handleRenderLegacy()
      }

      if (data.status === 'error') {
        throw new Error(data.error || 'Render failed')
      }

      // ── Sync fallback: queue not configured, render completed inline ─────
      if (!data.async) {
        if (data.outputUrl) {
          setVideoUrl(data.outputUrl)
          setRenderProgress('')
        } else {
          throw new Error(data.error || 'Sync render returned no output')
        }
        return
      }

      // ── Async path: job queued → start polling ────────────────────────────
      const jobId = data.jobId
      setRenderJobId(jobId)
      setRenderAsync(true)
      setRenderProgress('Job queued — waiting for worker…')

      await pollRenderStatus(jobId)

    } catch (e: any) {
      setRenderError(e.message || 'Render failed. Check server logs.')
      setRenderProgress('')
    } finally {
      setRendering(false)
    }
  }

  /**
   * pollRenderStatus()
   * Polls /api/render/status/[jobId] every 3s until done or error.
   * Updates renderProgress with elapsed time + current status.
   * Max wait: 5 minutes (100 × 3s).
   */
  async function pollRenderStatus(jobId: string) {
    const maxPolls  = 100
    const interval  = 3000 // 3s

    for (let i = 0; i < maxPolls; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, interval))

      try {
        const statusRes = await fetch(`/api/render/status/${jobId}`)
        const statusData = await statusRes.json()

        const elapsed = statusData.elapsedSeconds || (i + 1) * 3
        const elapsedLabel = elapsed < 60
          ? `${elapsed}s`
          : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`

        switch (statusData.status) {
          case 'queued':
            setRenderProgress(`Queued — ${elapsedLabel} elapsed…`)
            break

          case 'rendering':
            setRenderProgress(`Rendering — ${elapsedLabel} elapsed…`)
            break

          case 'done':
            if (statusData.outputUrl) {
              setVideoUrl(statusData.outputUrl)
              setRenderProgress('')
            } else {
              throw new Error('Render complete but no output URL returned')
            }
            return

          case 'error':
            throw new Error(statusData.error || 'Render job failed')

          case 'unknown':
            // Supabase not configured — show generic progress
            setRenderProgress(`Rendering — ${elapsedLabel} elapsed…`)
            break
        }
      } catch (pollErr: any) {
        // If it's a terminal error (not a transient network blip), rethrow
        if (pollErr.message !== 'Failed to fetch') {
          throw pollErr
        }
        setRenderProgress('Network error — retrying…')
      }
    }

    throw new Error('Render timed out after 5 minutes. Check the Library tab.')
  }

  /**
   * handleRenderLegacy()
   * Last-resort fallback to original synchronous /api/render route.
   * Preserves Step 3/4 behaviour if /api/render/queue is unavailable.
   */
  async function handleRenderLegacy() {
    setRenderProgress('Generating voices + images…')
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: result,
        captionStyle,
        voice,
        imageEngine,
        projectId: projectId || undefined,
        ...(showByok && byokApiKey ? { byokProvider, byokApiKey, byokUserId: byokUserId || undefined } : {}),
      }),
    })

    setRenderProgress('Compositing video…')
    const data = await res.json()

    if (!res.ok || data.status === 'error') {
      throw new Error(data.error || `Render failed: ${res.status}`)
    }

    setVideoUrl(data.outputUrl)
    setRenderProgress('')
  }

  // ─── Script results view ──────────────────────────────────────────────────
  if (result) {
    return (
      <>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title" style={{ maxWidth: '700px' }}>{result.title}</h1>
            <p className="page-sub">
              {result.scenes.length} scenes · {result.total_duration}s · {result.format} · {result.tone}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button className="btn btn-ghost" onClick={handleReset}>
              ← New script
            </button>
            <button
              className="btn btn-accent"
              onClick={handleRender}
              disabled={rendering}
              style={{ opacity: rendering ? 0.7 : 1 }}
            >
              {rendering ? (
                <>
                  <div className="spinner" style={{ width: '14px', height: '14px' }} />
                  {renderProgress || 'Rendering…'}
                </>
              ) : videoUrl ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download MP4
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Render Video
                </>
              )}
            </button>
            {videoUrl && (
              <a
                href={videoUrl}
                download={`${result?.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'viralos-video'}.mp4`}
                className="btn btn-accent"
                style={{ textDecoration: 'none' }}
              >
                ↓ Save MP4
              </a>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>

          {/* Left: scenes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Story arc summary */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">7-Beat Story Arc</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(result.story_arc).map(([key, value]) => {
                  const beatNum = parseInt(key.split('_')[1])
                  const beatName = key.replace(`beat_${beatNum}_`, '')
                  return (
                    <div key={key} style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '10px',
                      borderRadius: 'var(--r-sm)',
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'rgba(124,58,237,0.2)',
                        border: '1px solid rgba(124,58,237,0.4)',
                        color: 'var(--brand-300)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '700',
                        flexShrink: 0,
                      }}>{beatNum}</div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                          {beatName.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                          {value}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Scenes */}
            <div className="card-title" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Scenes
            </div>
            {result.scenes.map((scene) => (
              <SceneCard
                key={scene.scene_number}
                scene={scene}
                expanded={expandedScene === scene.scene_number}
                onToggle={() =>
                  setExpandedScene(
                    expandedScene === scene.scene_number ? null : scene.scene_number
                  )
                }
              />
            ))}
          </div>

          {/* Right: characters + metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '84px' }}>

            {/* Characters */}
            {result.characters && result.characters.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: '12px' }}>Characters</div>
                {result.characters.map((char, i) => (
                  <div key={i} style={{
                    padding: '10px',
                    background: 'var(--bg-raised)',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border)',
                    marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {char.name}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 7px',
                        borderRadius: '999px',
                        background: 'rgba(124,58,237,0.15)',
                        color: 'var(--brand-300)',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                      }}>
                        {char.role}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                      {char.visual_identity}
                    </p>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Scenes: {char.appears_in_scenes.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Video output */}
            {videoUrl && (
              <div className="card">
                <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px', fontSize: '12px' }}>
                  ✅ Video ready
                </div>
                <video
                  src={videoUrl}
                  controls
                  style={{
                    width: '100%',
                    borderRadius: 'var(--r-sm)',
                    background: '#000',
                    display: 'block',
                  }}
                />
                <a
                  href={videoUrl}
                  download={`${result.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'viralos'}.mp4`}
                  className="btn btn-accent"
                  style={{ marginTop: '10px', textDecoration: 'none', display: 'flex', justifyContent: 'center', fontSize: '13px' }}
                >
                  ↓ Download MP4
                </a>
              </div>
            )}

            {renderError && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--r-sm)',
                padding: '10px 12px',
                fontSize: '12px',
                color: 'var(--error)',
              }}>
                {renderError}
              </div>
            )}

            {/* Render pipeline status */}
            <div className="card" style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Pipeline status
              </div>
              {[
                { label: 'Script',  status: 'done',                                                          note: 'Groq · llama-3.3-70b' },
                { label: 'Queue',   status: rendering && renderAsync ? 'active' : videoUrl ? 'done' : rendering ? 'active' : 'ready', note: renderAsync ? 'CF Queue' : 'Sync' },
                { label: 'Voice',   status: rendering ? 'active' : videoUrl ? 'done' : 'ready',              note: voice.startsWith('el-') ? 'ElevenLabs' : voice.startsWith('playht-') ? 'PlayHT' : 'Piper TTS' },
                { label: 'Images',  status: rendering ? 'active' : videoUrl ? 'done' : 'ready',              note: imageEngine === 'flux-schnell' ? 'FLUX Schnell' : imageEngine === 'flux-dev' ? 'FLUX Dev' : imageEngine === 'ideogram' ? 'Ideogram v2' : 'Pollinations' },
                { label: 'Render',  status: rendering ? 'active' : videoUrl ? 'done' : 'ready',              note: 'Remotion OSS' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: item.status === 'done' ? 'var(--success)' : item.status === 'active' ? 'var(--warning)' : 'var(--brand-400)',
                    flexShrink: 0,
                    boxShadow: item.status === 'active' ? '0 0 6px var(--warning)' : 'none',
                  }} />
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{item.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{item.note}</span>
                </div>
              ))}
              {renderJobId && (
                <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                  job: {renderJobId}
                </div>
              )}
            </div>

            {/* Copy narration */}
            <button
              className="btn btn-ghost"
              style={{ fontSize: '12px', justifyContent: 'center' }}
              onClick={() => {
                const narration = result.scenes
                  .map((s) => `[Scene ${s.scene_number}]\n${s.narration}`)
                  .join('\n\n')
                navigator.clipboard.writeText(narration)
              }}
            >
              Copy all narration
            </button>
          </div>
        </div>
      </>
    )
  }

  // ─── Config form view ─────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">New Video</h1>
        <p className="page-sub">Configure your video and let the AI engine do the rest.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

        {/* Left: main config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Template selector — primary */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Template</div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Controls script structure, pacing, visuals, voice, and captions</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--r-sm)',
                    border: `1px solid ${templateId === t.id ? 'var(--brand-400)' : 'var(--border)'}`,
                    background: templateId === t.id ? 'rgba(124,58,237,0.12)' : 'var(--bg-raised)',
                    color: templateId === t.id ? 'var(--brand-300)' : 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: templateId === t.id ? '600' : '400',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{t.emoji}</span>
                  <span>{t.label}</span>
                  <span style={{ fontSize: '10px', opacity: 0.6, fontWeight: 400, lineHeight: '1.4' }}>{t.description}</span>
                </button>
              ))}
            </div>
            {/* Template details strip */}
            {(() => {
              const tmpl = getTemplate(templateId)
              if (!tmpl) return null
              return (
                <div style={{
                  marginTop: '12px', padding: '10px 12px',
                  background: 'rgba(124,58,237,0.06)',
                  border: '1px solid rgba(124,58,237,0.15)',
                  borderRadius: 'var(--r-sm)',
                  display: 'flex', gap: '16px', flexWrap: 'wrap',
                  fontSize: '11px', color: 'var(--text-muted)',
                }}>
                  <span>📐 {tmpl.defaultFormat}</span>
                  <span>⏱ {tmpl.defaultDuration}s default</span>
                  <span>🎞 {tmpl.beats.length} beats</span>
                  <span>🎨 {tmpl.captionStyle}</span>
                  <span style={{ flex: 1, minWidth: '200px', fontStyle: 'italic', opacity: 0.7 }}>"{tmpl.tone.split('—')[0].trim()}"</span>
                </div>
              )
            })()}
          </div>

          {/* Niche / Topic */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Topic / Niche</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
              {NICHES.map(n => (
                <button
                  key={n.value}
                  onClick={() => setNiche(n.value)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--r-sm)',
                    border: `1px solid ${niche === n.value ? 'var(--brand-400)' : 'var(--border)'}`,
                    background: niche === n.value ? 'rgba(124,58,237,0.12)' : 'var(--bg-raised)',
                    color: niche === n.value ? 'var(--brand-300)' : 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: niche === n.value ? '600' : '400',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                  }}
                >
                  {n.label}
                </button>
              ))}
            </div>
            {isCustom && (
              <div className="field" style={{ marginTop: '16px' }}>
                <label className="field-label">Your custom topic</label>
                <input
                  className="input"
                  placeholder="e.g. The psychology of procrastination..."
                  value={customTopic}
                  onChange={e => setCustomTopic(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Format + Duration */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Format & Duration</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="field">
                <label className="field-label">Aspect ratio</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {FORMATS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setFormat(f.value as any)}
                      style={{
                        flex: 1, padding: '12px',
                        borderRadius: 'var(--r-sm)',
                        border: `1px solid ${format === f.value ? 'var(--brand-400)' : 'var(--border)'}`,
                        background: format === f.value ? 'rgba(124,58,237,0.12)' : 'var(--bg-raised)',
                        color: format === f.value ? 'var(--brand-300)' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '2px' }}>{f.value}</div>
                      <div style={{ fontSize: '11px' }}>{f.label}</div>
                      <div style={{ fontSize: '10px', opacity: 0.6 }}>{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="field-label">Duration</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {DURATIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value as any)}
                      style={{
                        flex: 1, padding: '12px',
                        borderRadius: 'var(--r-sm)',
                        border: `1px solid ${duration === d.value ? 'var(--brand-400)' : 'var(--border)'}`,
                        background: duration === d.value ? 'rgba(124,58,237,0.12)' : 'var(--bg-raised)',
                        color: duration === d.value ? 'var(--brand-300)' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '2px' }}>{d.label}</div>
                      <div style={{ fontSize: '11px' }}>{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Voice & Style */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Voice & Style</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label className="field-label">Tone</label>
                <select className="input" value={tone} onChange={e => setTone(e.target.value)}>
                  <option value="engaging">Engaging</option>
                  <option value="authoritative">Authoritative</option>
                  <option value="conversational">Conversational</option>
                  <option value="dramatic">Dramatic</option>
                  <option value="educational">Educational</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Caption style</label>
                <select className="input" value={captionStyle} onChange={e => setCaptionStyle(e.target.value)}>
                  <option value="tiktok-v2">TikTok v2</option>
                  <option value="reels-bold">Reels Bold</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">
                  Voice
                  <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.5, fontWeight: 400 }}>
                    {voice.startsWith('el-') || voice.startsWith('playht-') ? '✨ Quality' : '⚡ Free'}
                    {showByok ? ' · BYOK' : ''}
                  </span>
                </label>
                <select className="input" value={voice} onChange={e => setVoice(e.target.value)}>
                  <optgroup label="⚡ Tier 1 — Piper TTS (Free, instant)">
                    {getVoicesByTier(1).map(v => (
                      <option key={v.id} value={v.id}>{v.label} — {v.accent} {v.gender === 'F' ? '♀' : '♂'}</option>
                    ))}
                  </optgroup>
                  <optgroup label="✨ Tier 2 — ElevenLabs (Free 10k chars/mo)">
                    {getVoicesByTier(2).filter(v => v.provider === 'elevenlabs').map(v => (
                      <option key={v.id} value={v.id}>{v.label} — {v.previewDescription}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🎙 Tier 2 — PlayHT (Free 12k chars/mo)">
                    {getVoicesByTier(2).filter(v => v.provider === 'playht').map(v => (
                      <option key={v.id} value={v.id}>{v.label} — {v.previewDescription}</option>
                    ))}
                  </optgroup>
                </select>
                {/* Tier 2 note */}
                {(voice.startsWith('el-') || voice.startsWith('playht-')) && (
                  <p style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                    Requires <code>ELEVENLABS_API_KEY</code>{voice.startsWith('playht-') ? ' or PLAYHT_API_KEY + PLAYHT_USER_ID' : ''} in .env.local — falls back to Piper if not set.
                  </p>
                )}
                {/* Tier 3 BYOK toggle */}
                <button
                  type="button"
                  onClick={() => setShowByok(b => !b)}
                  style={{ fontSize: 11, opacity: 0.6, marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', textDecoration: 'underline' }}
                >
                  {showByok ? '▲ Hide' : '🔑 Use your own API key (Tier 3)'}
                </button>
                {showByok && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <select className="input" value={byokProvider} onChange={e => setByokProvider(e.target.value as 'elevenlabs' | 'playht')}>
                      <option value="elevenlabs">ElevenLabs</option>
                      <option value="playht">PlayHT</option>
                    </select>
                    <input
                      className="input"
                      type="password"
                      placeholder={byokProvider === 'elevenlabs' ? 'ElevenLabs API key (xi-api-key)' : 'PlayHT API key'}
                      value={byokApiKey}
                      onChange={e => setByokApiKey(e.target.value)}
                    />
                    {byokProvider === 'playht' && (
                      <input
                        className="input"
                        type="text"
                        placeholder="PlayHT User ID"
                        value={byokUserId}
                        onChange={e => setByokUserId(e.target.value)}
                      />
                    )}
                    <p style={{ fontSize: 11, opacity: 0.5 }}>Key used for this render only — never stored.</p>
                  </div>
                )}
              </div>
              <div className="field">
                <label className="field-label">Image engine</label>
                <select className="input" value={imageEngine} onChange={e => setImageEngine(e.target.value)}>
                  <option value="pollinations">⚡ Pollinations — Free, no key (baseline)</option>
                  <option value="flux-schnell">🚀 FLUX Schnell — ~$0.003/img · Best free start (REPLICATE_API_TOKEN)</option>
                  <option value="flux-dev">✨ FLUX Dev — ~$0.025/img · Highest quality (REPLICATE_API_TOKEN)</option>
                  <option value="ideogram">🎨 Ideogram v2 — Free tier · Great cinematic style (IDEOGRAM_API_KEY)</option>
                </select>
                {imageEngine === 'flux-schnell' || imageEngine === 'flux-dev' ? (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Requires <code>REPLICATE_API_TOKEN</code> in .env.local —{' '}
                    <a href="https://replicate.com" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-300)' }}>
                      sign up free ($5 credit)
                    </a>. Falls back to Pollinations if not set.
                  </p>
                ) : imageEngine === 'ideogram' ? (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Requires <code>IDEOGRAM_API_KEY</code> in .env.local —{' '}
                    <a href="https://ideogram.ai" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-300)' }}>
                      sign up free (monthly credits)
                    </a>. Falls back to Pollinations if not set.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Right: preview + CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '84px' }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: '16px' }}>Preview</div>

            <div style={{
              background: 'var(--bg-raised)',
              borderRadius: 'var(--r-md)',
              aspectRatio: format === '9:16' ? '9/16' : format === '1:1' ? '1/1' : '16/9',
              maxHeight: '260px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: '12px', gap: '8px',
              marginBottom: '16px',
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
              </svg>
              Preview after generation
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {[
                ['Template', `${getTemplate(templateId)?.emoji ?? ''} ${getTemplate(templateId)?.label ?? templateId}`],
                ['Topic', NICHES.find(n => n.value === niche)?.label || niche],
                ['Format', `${format} · ${FORMATS.find(f => f.value === format)?.label}`],
                ['Duration', `${duration}s`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{v}</span>
                </div>
              ))}
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--r-sm)',
                padding: '10px 12px',
                fontSize: '12px',
                color: 'var(--error)',
                marginBottom: '12px',
              }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-accent"
              onClick={handleGenerate}
              disabled={loading || (isCustom && !customTopic.trim())}
              style={{
                width: '100%', justifyContent: 'center',
                opacity: loading ? 0.7 : 1, fontSize: '14px', padding: '12px',
              }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '14px', height: '14px' }} />
                  Generating script…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Generate Video
                </>
              )}
            </button>

            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px', lineHeight: '1.5' }}>
              Script + story arc live · Rendering in Step 3
            </p>
          </div>

          <div className="card" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '12px' }}>Active stack</div>
            {[
              ['Script', 'Groq · llama-3.3-70b', true],
              ['Voice', voice.startsWith('el-') ? 'ElevenLabs' : voice.startsWith('playht-') ? 'PlayHT' : 'Piper TTS', false],
              ['Images', 'Pollinations', false],
              ['Render', 'Remotion OSS', false],
            ].map(([k, v, active]) => (
              <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{k as string}</span>
                <span style={{ color: active ? 'var(--success)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  {v as string}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Scene card component ─────────────────────────────────────────────────────

function SceneCard({
  scene,
  expanded,
  onToggle,
}: {
  scene: SceneDirector
  expanded: boolean
  onToggle: () => void
}) {
  const beatLabel = ARC_BEAT_LABELS[scene.arc_beat] ?? scene.arc_beat

  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'border-color 0.15s', borderColor: expanded ? 'var(--brand-400)' : 'var(--border)' }}
      onClick={onToggle}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: expanded ? 'rgba(124,58,237,0.25)' : 'var(--bg-raised)',
          border: `1px solid ${expanded ? 'var(--brand-400)' : 'var(--border)'}`,
          color: expanded ? 'var(--brand-300)' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: '700', flexShrink: 0,
        }}>
          {scene.scene_number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: '999px',
              background: 'rgba(124,58,237,0.12)',
              color: 'var(--brand-300)',
              fontWeight: '600',
            }}>
              {beatLabel}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {scene.duration_seconds}s · {scene.emotion}
            </span>
          </div>
          <p style={{
            fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.6',
            margin: 0,
            overflow: expanded ? 'visible' : 'hidden',
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: 'vertical',
          } as any}>
            {scene.narration}
          </p>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '16px', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ↓
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            {[
              ['Environment', scene.environment],
              ['Lighting', scene.lighting],
              ['Camera', scene.camera_movement],
              ['Visual goal', scene.visual_objective],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
                  {label}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Image prompt */}
          <div style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            padding: '12px',
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              Image prompt
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, fontFamily: 'var(--font-mono)' }}>
              {scene.image_prompt}
            </p>
            <button
              className="btn btn-ghost"
              style={{ marginTop: '8px', fontSize: '11px', padding: '4px 10px' }}
              onClick={() => navigator.clipboard.writeText(scene.image_prompt)}
            >
              Copy prompt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
