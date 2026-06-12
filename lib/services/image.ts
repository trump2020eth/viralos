/**
 * ViralOS Image Generation Service
 * Abstract provider layer — swap implementation here only.
 *
 * Providers (selectable per-render):
 *   pollinations     — Free, no key. Baseline quality.
 *   flux-schnell     — Replicate FLUX Schnell. ~$0.003/img. REPLICATE_API_TOKEN required.
 *   flux-dev         — Replicate FLUX Dev. ~$0.025/img. REPLICATE_API_TOKEN required.
 *   ideogram         — Ideogram v2. Free tier. IDEOGRAM_API_KEY required.
 *
 * generateImage() is the ONLY function the rest of the app calls.
 * Never call providers directly outside this file.
 */

export type ImageEngine = 'pollinations' | 'flux-schnell' | 'flux-dev' | 'ideogram'

export interface ImageGenerationParams {
  prompt: string
  width: number
  height: number
  seed?: number
  engine?: ImageEngine
}

export interface ImageGenerationResult {
  url: string
  provider: string
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateImage(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const engine = params.engine ?? 'pollinations'

  switch (engine) {
    case 'flux-schnell':
      return generateImageReplicate(params, 'black-forest-labs/flux-schnell')
    case 'flux-dev':
      return generateImageReplicate(params, 'black-forest-labs/flux-dev')
    case 'ideogram':
      return generateImageIdeogram(params)
    case 'pollinations':
    default:
      return generateImagePollinations(params)
  }
}

// ─── Pollinations ─────────────────────────────────────────────────────────────
// Free, no key. As of mid-2026 Pollinations gates some models (notably
// `model=flux`) behind a paid tier and returns HTTP 402 Payment Required for
// unauthenticated requests. Since this is the default engine and previously
// had NO fallback, a 402 here used to throw and take down the entire render
// (every scene's Promise.all rejects). Now:
//   1. Try `model=flux` (best quality, may 402 without a token)
//   2. Retry with no `model` param (Pollinations' free default model)
//   3. If both fail, return a generated placeholder image (data URL) so the
//      render still completes — the user gets a video with placeholder
//      visuals instead of a hard failure.

async function generateImagePollinations(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const { prompt, width, height, seed } = params
  const encoded = encodeURIComponent(
    `${prompt} cinematic, photorealistic, 8k, dramatic lighting, film grain`
  )
  const seedParam = seed != null ? `&seed=${seed}` : ''
  const token = process.env.POLLINATIONS_API_TOKEN ? `&token=${process.env.POLLINATIONS_API_TOKEN}` : ''

  // Attempt 1: flux model (best quality, may require a token/paid tier)
  const fluxUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&model=flux${seedParam}${token}`
  try {
    const check = await fetch(fluxUrl, { method: 'HEAD' })
    if (check.ok) return { url: fluxUrl, provider: 'pollinations' }
    console.warn(`[image] Pollinations (flux) returned ${check.status} — trying default model`)
  } catch (e) {
    console.warn('[image] Pollinations (flux) request failed — trying default model:', e)
  }

  // Attempt 2: default model (no `model=` param) — Pollinations' free tier
  const defaultUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true${seedParam}${token}`
  try {
    const check = await fetch(defaultUrl, { method: 'HEAD' })
    if (check.ok) return { url: defaultUrl, provider: 'pollinations' }
    console.warn(`[image] Pollinations (default) returned ${check.status} — using placeholder`)
  } catch (e) {
    console.warn('[image] Pollinations (default) request failed — using placeholder:', e)
  }

  // Attempt 3: placeholder so the render still completes
  return { url: generatePlaceholderImage(width, height, seed), provider: 'placeholder' }
}

// ─── Placeholder ──────────────────────────────────────────────────────────────
// Last-resort image when every external provider fails. A simple gradient
// SVG encoded as a data URL — Remotion's <Img> can render data URLs directly.

function generatePlaceholderImage(width: number, height: number, seed?: number): string {
  const hue = ((seed ?? 1) * 47) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},45%,22%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 60) % 360},45%,10%)"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
</svg>`
  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

// ─── Replicate (FLUX Schnell + FLUX Dev) ──────────────────────────────────────
// Requires REPLICATE_API_TOKEN env var.
// Sign up: https://replicate.com — $5 free credit on first sign-up (~250 renders at Schnell pricing).
// FLUX Schnell: black-forest-labs/flux-schnell  ~$0.003/image  fastest
// FLUX Dev:     black-forest-labs/flux-dev       ~$0.025/image  highest quality

async function generateImageReplicate(
  params: ImageGenerationParams,
  model: string
): Promise<ImageGenerationResult> {
  const apiToken = process.env.REPLICATE_API_TOKEN
  if (!apiToken) {
    console.warn(`[image] REPLICATE_API_TOKEN not set — falling back to Pollinations`)
    return generateImagePollinations(params)
  }

  const { prompt, width, height, seed } = params

  // Replicate predictions API — returns a prediction object, then we poll for completion
  const createRes = await fetch('https://api.replicate.com/v1/models/' + model + '/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      Prefer: 'wait', // wait up to 60s for result inline — avoids polling round-trips
    },
    body: JSON.stringify({
      input: {
        prompt: `${prompt} cinematic, photorealistic, film grain, dramatic lighting`,
        width,
        height,
        num_outputs: 1,
        ...(seed != null ? { seed } : {}),
        // flux-schnell specific — ignored by flux-dev
        num_inference_steps: model.includes('schnell') ? 4 : 28,
        output_format: 'webp',
        output_quality: 90,
      },
    }),
  })

  if (!createRes.ok) {
    const errText = await createRes.text()
    console.error(`[image] Replicate error ${createRes.status}:`, errText)
    console.warn('[image] Falling back to Pollinations')
    return generateImagePollinations(params)
  }

  const prediction = await createRes.json()

  // With Prefer: wait the output is usually already there
  if (prediction.output?.[0]) {
    return { url: prediction.output[0], provider: model }
  }

  // Poll if not yet complete (max 90s)
  const predictionId = prediction.id
  if (!predictionId) {
    console.warn('[image] Replicate returned no prediction ID — falling back')
    return generateImagePollinations(params)
  }

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    const pollData = await pollRes.json()

    if (pollData.status === 'succeeded' && pollData.output?.[0]) {
      return { url: pollData.output[0], provider: model }
    }
    if (pollData.status === 'failed' || pollData.status === 'canceled') {
      console.error('[image] Replicate prediction failed:', pollData.error)
      break
    }
  }

  console.warn('[image] Replicate timed out — falling back to Pollinations')
  return generateImagePollinations(params)
}

// ─── Ideogram v2 ──────────────────────────────────────────────────────────────
// Requires IDEOGRAM_API_KEY env var.
// Sign up: https://ideogram.ai — free tier with monthly credits.
// Strong on cinematic/stylized imagery. Good for Documentary, History Channel templates.

async function generateImageIdeogram(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const apiKey = process.env.IDEOGRAM_API_KEY
  if (!apiKey) {
    console.warn('[image] IDEOGRAM_API_KEY not set — falling back to Pollinations')
    return generateImagePollinations(params)
  }

  const { prompt, width, height, seed } = params

  // Map to nearest Ideogram supported aspect ratio
  const aspectRatio = getIdeogramAspectRatio(width, height)

  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_request: {
        prompt: `${prompt} cinematic, photorealistic, dramatic lighting, high detail`,
        aspect_ratio: aspectRatio,
        model: 'V_2',
        magic_prompt_option: 'AUTO',
        ...(seed != null ? { seed } : {}),
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[image] Ideogram error ${res.status}:`, errText)
    console.warn('[image] Falling back to Pollinations')
    return generateImagePollinations(params)
  }

  const data = await res.json()
  const imageUrl = data?.data?.[0]?.url

  if (!imageUrl) {
    console.warn('[image] Ideogram returned no image URL — falling back')
    return generateImagePollinations(params)
  }

  return { url: imageUrl, provider: 'ideogram' }
}

function getIdeogramAspectRatio(width: number, height: number): string {
  const ratio = width / height
  if (ratio < 0.6) return 'ASPECT_9_16'   // 1080x1920
  if (ratio > 1.6) return 'ASPECT_16_9'   // 1920x1080
  return 'ASPECT_1_1'                      // 1080x1080
}
