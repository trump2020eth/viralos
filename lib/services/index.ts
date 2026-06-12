/**
 * ViralOS Provider Abstraction Layer
 *
 * Import all AI service functions from here.
 * Never import from individual provider files directly.
 * Never call AI providers (Groq, Pollinations, Kokoro, etc.) directly from UI or API routes.
 *
 * To swap a provider: edit the corresponding service file only.
 * Zero changes required in API routes, components, or business logic.
 */

export { generateImage } from './image'
export type { ImageGenerationParams, ImageGenerationResult } from './image'

export { generateVoice } from './voice'
export type { VoiceGenerationParams, VoiceGenerationResult } from './voice'

export { renderFinalVideo, generateSceneVideo } from './video'
export type { RenderParams, RenderResult, SceneVideoParams } from './video'

export { uploadVideo, getVideoUrl } from './storage'
