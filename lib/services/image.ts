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
// Free, no key. Falls back gracefully if unreachable.

async function generateImagePollinations(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const { prompt, width, height, seed } = params
  const encoded = encodeURIComponent(
    `${prompt} cinematic, photorealistic, 8k, dramatic lighting, film grain`
  )
  const seedParam = seed != null ? `&seed=${seed}` : ''
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&model=flux${seedParam}`

  const check = await fetch(url, { method: 'HEAD' })
  if (!check.ok) throw new Error(`Pollinations returned ${check.status}`)

  return { url, provider: 'pollinations' }
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
