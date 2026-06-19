import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function dbGet(table, filters, select = '*') {
  const params = Object.entries(filters).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}&select=${select}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  })
  if (!res.ok) throw new Error(`DB GET ${table} failed: ${await res.text()}`)
  const rows = await res.json()
  return rows[0] || null
}

async function dbPatch(table, filters, data) {
  const params = Object.entries(filters).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`DB PATCH ${table} failed: ${await res.text()}`)
}

const jobId  = process.env.JOB_ID
const userId = process.env.USER_ID
const format = process.env.FORMAT || '9:16'
const outDir = '/tmp/viralos-render'

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
console.log(`\n🎬 Starting render for job ${jobId}\n`)

// ── 1. Fetch payload ──────────────────────────────────────────────────────────
console.log('📦 Fetching script payload...')
const row = await dbGet('render_payloads', { job_id: jobId }, 'script,caption_style,voice,image_engine,format')
if (!row) { console.error('No payload found for job', jobId); process.exit(1) }

const script       = row.script
const captionStyle = row.caption_style || 'tiktok-v2'
const voice        = row.voice         || 'kokoro-en-f'
const imageEngine  = row.image_engine  || 'pollinations'
const videoFormat  = row.format        || format

console.log(`✓ Got script: ${script.scenes?.length ?? 0} scenes, voice=${voice}, engine=${imageEngine}`)

// ── 2. Generate images ────────────────────────────────────────────────────────
console.log('\n🖼  Generating images...')

const [w, h] = videoFormat === '16:9' ? [1920, 1080] : videoFormat === '1:1' ? [1080, 1080] : [1080, 1920]

async function generateImage(prompt, seed, index) {
  const encoded = encodeURIComponent(`${prompt} cinematic, photorealistic, 8k, dramatic lighting`)
  const token = process.env.POLLINATIONS_API_TOKEN ? `&token=${process.env.POLLINATIONS_API_TOKEN}` : ''
  const urls = [
    `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&nologo=true&model=flux&seed=${seed}${token}`,
    `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&nologo=true&seed=${seed}${token}`,
  ]

  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000))
        const r = await fetch(url)
        if (!r.ok) continue
        const buf = await r.arrayBuffer()
        if (buf.byteLength < 1000) continue // skip empty/error responses
        // FIX: save to disk so Remotion loads it as a local file, not a remote URL
        const imgPath = join(outDir, `scene-${index}.jpg`)
        writeFileSync(imgPath, Buffer.from(buf))
        console.log(`  ✓ Scene ${index} image saved (${Math.round(buf.byteLength / 1024)}KB)`)
        return `file://${imgPath}`
      } catch(e) { console.warn(`  Image fetch attempt ${attempt + 1} failed for scene ${index}:`, e.message) }
    }
  }

  // Fallback: solid color SVG saved to disk
  console.warn(`  ⚠ Using fallback color for scene ${index}`)
  const hue = (seed * 47) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="hsl(${hue},30%,15%)"/><text x="50%" y="50%" fill="white" font-size="48" text-anchor="middle" dominant-baseline="middle">Scene ${index}</text></svg>`
  const svgPath = join(outDir, `scene-${index}.svg`)
  writeFileSync(svgPath, svg)
  return `file://${svgPath}`
}

const imageUrls = await Promise.all(script.scenes.map((scene, i) => generateImage(scene.image_prompt, i + 1, i + 1)))
console.log('✓ Images ready')

// ── 3. Generate audio ─────────────────────────────────────────────────────────
console.log('\n🔊 Generating audio...')

function estimateDuration(text) { return Math.max(text.split(/\s+/).filter(Boolean).length / 2.8, 1.0) }

function silentWav(text) {
  const dur = estimateDuration(text), sr = 24000, n = Math.round(sr * dur), ds = n * 2
  const b = Buffer.alloc(44 + ds, 0)
  b.write('RIFF',0); b.writeUInt32LE(36+ds,4); b.write('WAVE',8); b.write('fmt ',12)
  b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(sr,24)
  b.writeUInt32LE(sr*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(ds,40)
  return { audioBase64: b.toString('base64'), mimeType: 'audio/wav', durationSeconds: dur }
}

async function generateAudio(text, sceneNum) {
  const elKey = process.env.ELEVENLABS_API_KEY
  if (elKey && voice.startsWith('el-')) {
    const voiceId = voice.replace('el-', '')
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: 'eleven_turbo_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      })
      if (r.ok) { const buf = await r.arrayBuffer(); return { audioBase64: Buffer.from(buf).toString('base64'), mimeType: 'audio/mpeg', durationSeconds: estimateDuration(text) } }
    } catch(e) { console.warn(`[tts] ElevenLabs failed scene ${sceneNum}:`, e.message) }
  }
  const piperUrl = process.env.PIPER_API_URL || process.env.KOKORO_API_URL
  if (piperUrl) {
    try {
      const r = await fetch(`${piperUrl}/v1/audio/speech`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'piper', input: text, voice: 'en_US-libritts_r-medium', speed: 1.0, response_format: 'wav' }),
      })
      if (r.ok) { const buf = await r.arrayBuffer(); return { audioBase64: Buffer.from(buf).toString('base64'), mimeType: 'audio/wav', durationSeconds: Math.max((buf.byteLength-44)/(24000*2), estimateDuration(text)) } }
    } catch(e) { console.warn(`[tts] Piper failed scene ${sceneNum}:`, e.message) }
  }
  console.warn(`[tts] Using silent fallback for scene ${sceneNum}`)
  return silentWav(text)
}

const audioResults = await Promise.all(script.scenes.map((scene, i) => generateAudio(scene.narration, i + 1)))
console.log('✓ Audio ready')

// ── 4. Build props for Remotion ───────────────────────────────────────────────
const sceneAssets = script.scenes.map((scene, i) => ({
  sceneNumber:          scene.scene_number,
  narration:            scene.narration,
  cameraMove:           scene.camera_movement,
  emotion:              scene.emotion || 'neutral',
  imageUrl:             imageUrls[i],
  audioBase64:          audioResults[i].audioBase64,
  audioDurationSeconds: audioResults[i].durationSeconds,
  captionStyle,
}))

const propsPath = join(outDir, 'props.json')
writeFileSync(propsPath, JSON.stringify({ scenes: sceneAssets, format: videoFormat, title: script.title || '' }))

// ── 5. Remotion render ────────────────────────────────────────────────────────
console.log('\n🎞  Rendering with Remotion...')

const compositionId = `ViralOS-${videoFormat.replace(':', '-')}`
const outputPath    = join(outDir, `${jobId}.mp4`)

const result = spawnSync(
  'node_modules/.bin/remotion',
  ['render', 'remotion/Root.tsx', compositionId, outputPath, `--width=${w}`, `--height=${h}`, `--props=${propsPath}`, '--log=verbose',
    ...(process.env.CHROME_EXECUTABLE_PATH ? [`--browser-executable=${process.env.CHROME_EXECUTABLE_PATH}`] : [])],
  { stdio: 'inherit', cwd: process.cwd() }
)
if (result.status !== 0) { console.error('Remotion render failed'); process.exit(1) }
console.log(`✓ Rendered → ${outputPath}`)

// ── 6. Upload to R2 with presigned URL ───────────────────────────────────────
console.log('\n☁️  Uploading to R2...')

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
})

// Use videos/ prefix to match storage.ts and the refresh-url security check
const key        = `videos/${userId}/${jobId}.mp4`
const fileBuffer = readFileSync(outputPath)
await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: fileBuffer, ContentType: 'video/mp4' }))

// Generate 7-day presigned URL so the browser can actually play it
const signedUrl = await getSignedUrl(
  s3,
  new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
  { expiresIn: 60 * 60 * 24 * 7 }
)
console.log(`✓ Uploaded → ${key}`)

// ── 7. Mark done ──────────────────────────────────────────────────────────────
console.log('\n✅ Marking job complete...')
const totalDuration = sceneAssets.reduce((s, a) => s + a.audioDurationSeconds, 0)
await dbPatch('render_jobs', { job_id: jobId }, {
  status: 'done', r2_url: signedUrl, r2_key: key,
  duration_seconds: Math.round(totalDuration), scene_count: sceneAssets.length,
  completed_at: new Date().toISOString(),
})

console.log(`\n🎉 Job ${jobId} complete! (${sceneAssets.length} scenes, ${Math.round(totalDuration)}s)\n`)
