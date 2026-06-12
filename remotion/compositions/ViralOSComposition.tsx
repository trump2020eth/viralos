/**
 * ViralOS Remotion Composition
 *
 * Renders a complete ViralOS video from a GenerateResponse + scene assets.
 * Architecture: one <Sequence> per scene, each with Ken Burns image + audio + captions.
 *
 * Ported from: buildTimeline(), getCameraMove(), parseCameraMovement(), caption engine
 */

import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion'
import { getKenBurnsFrame, parseCameraMovement } from './kenburns'
import { buildCaptionSegments, CaptionOverlay, type CaptionStyle } from './captions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SceneAsset {
  sceneNumber: number
  narration: string
  cameraMove: string
  emotion: string
  imageUrl: string
  audioBase64: string
  audioDurationSeconds: number
  captionStyle: CaptionStyle
}

export interface ViralOSCompositionProps {
  scenes: SceneAsset[]
  format: '9:16' | '16:9' | '1:1'
  title: string
}

// ─── Scene Component ──────────────────────────────────────────────────────────

function SceneRenderer({
  scene,
  durationFrames,
}: {
  scene: SceneAsset
  durationFrames: number
}) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const kb = getKenBurnsFrame(scene.cameraMove, frame, durationFrames)

  // Transition: fade in first 8 frames, fade out last 8 frames
  const fadeInFrames = 8
  const fadeOutFrames = 8
  const opacity = interpolate(
    frame,
    [0, fadeInFrames, durationFrames - fadeOutFrames, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.ease }
  )

  // Build caption segments for this scene
  const captionSegments = buildCaptionSegments(
    scene.narration,
    fps,
    durationFrames
  )

  // Audio data URL from base64
  const audioSrc = `data:audio/wav;base64,${scene.audioBase64}`

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Ken Burns image layer */}
      <AbsoluteFill
        style={{
          transform: `scale(${kb.scale}) translate(${kb.translateX}%, ${kb.translateY}%)`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        <Img
          src={scene.imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      {/* Cinematic gradient vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom caption gradient */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 35%)',
          pointerEvents: 'none',
        }}
      />

      {/* Audio track */}
      <Audio src={audioSrc} />

      {/* Caption overlay */}
      <CaptionOverlay
        segments={captionSegments}
        style={scene.captionStyle}
        videoWidth={width}
        videoHeight={height}
      />
    </AbsoluteFill>
  )
}

// ─── Main Composition ─────────────────────────────────────────────────────────

export function ViralOSComposition({ scenes, format, title }: ViralOSCompositionProps) {
  const { fps } = useVideoConfig()

  // Calculate frame durations per scene from audio duration
  const sceneDurations = scenes.map((scene) => ({
    scene,
    durationFrames: Math.round(scene.audioDurationSeconds * fps),
  }))

  // Build timeline: cumulative start frames
  let offset = 0
  const timeline = sceneDurations.map(({ scene, durationFrames }) => {
    const entry = { scene, durationFrames, from: offset }
    offset += durationFrames
    return entry
  })

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {timeline.map(({ scene, durationFrames, from }) => (
        <Sequence
          key={scene.sceneNumber}
          from={from}
          durationInFrames={durationFrames}
          name={`Scene ${scene.sceneNumber}`}
        >
          <SceneRenderer scene={scene} durationFrames={durationFrames} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

// ─── Dimension resolver ───────────────────────────────────────────────────────

export function getVideoDimensions(format: '9:16' | '16:9' | '1:1'): {
  width: number
  height: number
} {
  switch (format) {
    case '9:16': return { width: 1080, height: 1920 }
    case '16:9': return { width: 1920, height: 1080 }
    case '1:1':  return { width: 1080, height: 1080 }
  }
}

export const FPS = 30
