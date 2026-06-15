import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { execSync, spawnSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import ws from 'ws'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { global: { fetch }, realtime: { transport: ws } }
)

const jobId       = process.env.JOB_ID
const userId      = process.env.USER_ID
const format      = process.env.FORMAT || '9:16'
const outDir      = '/tmp/viralos-render'

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
console.log(`\n🎬 Starting render for job ${jobId}\n`)

// ── 1. Fetch payload from Supabase ────────────────────────────────────────────
console.log('📦 Fetching script payload...')
const { data: row, error: fetchError } = await supabase
  .from('render_payloads')
  .select('script, caption_style, voice, image_engine, format')
  .eq('job_id', jobId)
  .single()

if (fetchError || !row) {
  console.error('Failed to fetch payload:', fetchError?.message)
  process.exit(1)
}

const script      = row.script
const captionStyle = row.caption_style || 'tiktok-v2'
const voice       = row.voice          || 'kokoro-en-f'
const imageEngine = row.image_engine   || 'pollinations'
const videoFormat = row.format         || format

console.log(`✓ Got script: ${script.scenes?.length ?? 0} scenes, voice=${voice}, engine=${imageEngine}`)

// ── 2. Generate images ────────────────────────────────────────────────────────
console.log('\n🖼  Generating images...')

const [w, h] = videoFormat === '16:9' ? [1920, 1080]
             : videoFormat === '1:1'  ? [1080, 1080]
             :                          [1080, 1920]

async function generateImage(prompt, seed) {
  const encoded = encodeURIComponent(`${prompt} cinematic, photorealistic, 8k, dramatic lighting`)
  const token = process.env.POLLINATIONS_API_TOKEN ? `&token=${process.env.POLLINATIONS_API_TOKEN}` : ''

  for (const url of [
    `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&nologo=true&model=flux&seed=${seed}${token}`,
    `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&nologo=true&seed=${seed}${token}`,
  ]) {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok) return url
    } catch {}
  }
  // Placeholder SVG as data URL fallback
  const hue = (seed * 47) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="hsl(${hue},30%,15%)"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const imageUrls = await Promise.all(
  script.scenes.map((scene, i) => generateImage(scene.image_prompt, i + 1))
)
console.log(`✓ Images ready`)

// ── 3. Generate TTS audio ─────────────────────────────────────────────────────
console.log('\n🔊 Generating audio...')

async function generateAudio(text, sceneNum) {
  // Try ElevenLabs
  const elKey = process.env.ELEVENLABS_API_KEY
  if (elKey && !voice.startsWith('piper-') && !voice.startsWith('kokoro-')) {
    const voiceId = voice.startsWith('el-') ? voice.replace('el-', '') : '21m00Tcm4TlvDq8ikWAM'
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: 'eleven_turbo_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      })
      if (res.ok) {
        const buf = await res.arrayBuffer()
        return { audioBase64: Buffer.from(buf).toString('base64'), mimeType: 'audio/mpeg', durationSeconds: estimateDuration(text) }
      }
    } catch(e) { console.warn(`[tts] ElevenLabs failed scene ${sceneNum}:`, e.message) }
  }

  // Try Piper/Kokoro
  const piperUrl = process.env.PIPER_API_URL || process.env.KOKORO_API_URL
  if (piperUrl) {
    try {
      const res = await fetch(`${piperUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'piper', input: text, voice: 'en_US-libritts_r-medium', speed: 1.0, response_format: 'wav' }),
      })
      if (res.ok) {
        const buf = await res.arrayBuffer()
        const durationSeconds = Math.max((buf.byteLength - 44) / (24000 * 2), estimateDuration(text))
        return { audioBase64: Buffer.from(buf).toString('base64'), mimeType: 'audio/wav', durationSeconds }
      }
    } catch(e) { console.warn(`[tts] Piper failed scene ${sceneNum}:`, e.message) }
  }

  // Silent fallback WAV
  return generateSilentWav(text)
}

function estimateDuration(text) {
  return Math.max(text.split(/\s+/).filter(Boolean).length / 2.8, 1.0)
}

function generateSilentWav(text) {
  const durationSeconds = estimateDuration(text)
  const sampleRate = 24000
  const numSamples = Math.round(sampleRate * durationSeconds)
  const dataSize = numSamples * 2
  const buf = Buffer.alloc(44 + dataSize, 0)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(dataSize, 40)
  return { audioBase64: buf.toString('base64'), mimeType: 'audio/wav', durationSeconds }
}

const audioResults = await Promise.all(
  script.scenes.map((scene, i) => generateAudio(scene.narration, i + 1))
)
console.log(`✓ Audio ready`)

// ── 4. Build scene assets JSON for Remotion ───────────────────────────────────
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

// ── 5. Render with Remotion ───────────────────────────────────────────────────
console.log('\n🎞  Rendering with Remotion...')

const compositionId = `ViralOS-${videoFormat.replace(':', '-')}`
const outputPath    = join(outDir, `${jobId}.mp4`)

// Use --props file path (avoids shell escaping issues with large base64 blobs in --props='...')
const cmd = [
  'npx', 'remotion', 'render',
  'remotion/Root.tsx',
  compositionId,
  outputPath,
  `--width=${w}`,
  `--height=${h}`,
  `--props=${propsPath}`,
  '--log=verbose',
  ...(process.env.CHROME_EXECUTABLE_PATH ? [`--browser-executable=${process.env.CHROME_EXECUTABLE_PATH}`] : []),
]

const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', cwd: process.cwd() })
if (result.status !== 0) {
  console.error('Remotion render failed')
  process.exit(1)
}
console.log(`✓ Rendered → ${outputPath}`)

// ── 6. Upload to R2 ───────────────────────────────────────────────────────────
console.log('\n☁️  Uploading to R2...')

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const key        = `renders/${userId}/${jobId}.mp4`
const fileBuffer = readFileSync(outputPath)

await s3.send(new PutObjectCommand({
  Bucket:      process.env.R2_BUCKET_NAME,
  Key:         key,
  Body:        fileBuffer,
  ContentType: 'video/mp4',
}))

const videoUrl = `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${key}`
console.log(`✓ Uploaded → ${videoUrl}`)

// ── 7. Mark job done in Supabase ──────────────────────────────────────────────
console.log('\n✅ Marking job complete...')

const totalDuration = sceneAssets.reduce((s, a) => s + a.audioDurationSeconds, 0)

const { error: updateError } = await supabase
  .from('render_jobs')
  .update({
    status:           'done',
    r2_url:           videoUrl,
    r2_key:           key,
    duration_seconds: Math.round(totalDuration),
    scene_count:      sceneAssets.length,
    completed_at:     new Date().toISOString(),
  })
  .eq('job_id', jobId)

if (updateError) {
  console.error('Failed to update job:', updateError.message)
  process.exit(1)
}

console.log(`\n🎉 Job ${jobId} complete! (${sceneAssets.length} scenes, ${Math.round(totalDuration)}s)\n`)
