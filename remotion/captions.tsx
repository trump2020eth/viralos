/**
 * ViralOS Caption Engine
 * Ported from legacy caption engine (TikTok v2, Reels Bold styles)
 *
 * Generates word-timed caption segments from narration text + duration.
 * Renders as React components inside Remotion composition.
 */

import React from 'react'
import { useCurrentFrame } from 'remotion'

export type CaptionStyle = 'tiktok-v2' | 'reels-bold' | 'none'

export interface CaptionSegment {
  word: string
  startFrame: number
  endFrame: number
}

/**
 * buildCaptionSegments()
 * Distributes words evenly across the scene duration.
 * In Step 7 (ElevenLabs), this will use actual word timestamps from TTS.
 */
export function buildCaptionSegments(
  text: string,
  fps: number,
  durationFrames: number
): CaptionSegment[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const framesPerWord = durationFrames / words.length

  return words.map((word, i) => ({
    word,
    startFrame: Math.round(i * framesPerWord),
    endFrame: Math.round((i + 1) * framesPerWord) - 1,
  }))
}

/**
 * getCurrentCaption()
 * Returns the active word and surrounding context for the current frame.
 * Shows 3 words at a time (prev, current highlighted, next) for readability.
 */
export function getCurrentCaption(
  segments: CaptionSegment[],
  frame: number
): { before: string; current: string; after: string } | null {
  const idx = segments.findIndex(
    (s) => frame >= s.startFrame && frame <= s.endFrame
  )
  if (idx === -1) return null

  const windowSize = 3 // words per caption group
  const groupStart = Math.floor(idx / windowSize) * windowSize
  const group = segments.slice(groupStart, groupStart + windowSize)
  const posInGroup = idx - groupStart

  const before = group.slice(0, posInGroup).map((s) => s.word).join(' ')
  const current = group[posInGroup]?.word ?? ''
  const after = group.slice(posInGroup + 1).map((s) => s.word).join(' ')

  return { before, current, after }
}

// ─── Caption React Components ─────────────────────────────────────────────────

interface CaptionOverlayProps {
  segments: CaptionSegment[]
  style: CaptionStyle
  videoWidth: number
  videoHeight: number
}

export function CaptionOverlay({
  segments,
  style,
  videoWidth,
  videoHeight,
}: CaptionOverlayProps): React.ReactElement | null {
  const frame = useCurrentFrame()

  if (style === 'none' || segments.length === 0) return null

  const caption = getCurrentCaption(segments, frame)
  if (!caption) return null

  if (style === 'tiktok-v2') {
    return (
      <TikTokV2Caption
        before={caption.before}
        current={caption.current}
        after={caption.after}
        videoWidth={videoWidth}
        videoHeight={videoHeight}
      />
    )
  }

  if (style === 'reels-bold') {
    return (
      <ReelsBoldCaption
        before={caption.before}
        current={caption.current}
        after={caption.after}
        videoWidth={videoWidth}
        videoHeight={videoHeight}
      />
    )
  }

  return null
}

// ─── TikTok v2 Style ──────────────────────────────────────────────────────────
// Centered, one highlighted word at a time, white + yellow highlight, drop shadow

function TikTokV2Caption({
  before,
  current,
  after,
  videoWidth,
  videoHeight,
}: {
  before: string
  current: string
  after: string
  videoWidth: number
  videoHeight: number
}) {
  const fontSize = Math.round(videoWidth * 0.052) // ~56px at 1080w
  const bottomOffset = Math.round(videoHeight * 0.18) // 18% from bottom

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: `0 ${Math.round(videoWidth * 0.06)}px`,
      }}
    >
      <div
        style={{
          fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif',
          fontSize,
          fontWeight: 900,
          lineHeight: 1.2,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
        }}
      >
        {before && (
          <span
            style={{
              color: '#ffffff',
              textShadow: '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000',
              marginRight: before ? '0.25em' : 0,
            }}
          >
            {before}{' '}
          </span>
        )}
        <span
          style={{
            color: '#FFE000', // TikTok yellow highlight
            textShadow: '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000',
            display: 'inline-block',
            transform: 'scale(1.08)',
            transformOrigin: 'center bottom',
          }}
        >
          {current}
        </span>
        {after && (
          <span
            style={{
              color: '#ffffff',
              textShadow: '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000',
              marginLeft: '0.25em',
            }}
          >
            {' '}{after}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Reels Bold Style ─────────────────────────────────────────────────────────
// Instagram Reels style: white pill background, bold black text, centered bottom

function ReelsBoldCaption({
  before,
  current,
  after,
  videoWidth,
  videoHeight,
}: {
  before: string
  current: string
  after: string
  videoWidth: number
  videoHeight: number
}) {
  const fontSize = Math.round(videoWidth * 0.044)
  const bottomOffset = Math.round(videoHeight * 0.15)
  const padding = Math.round(videoWidth * 0.016)
  const radius = Math.round(fontSize * 0.35)

  const text = [before, current, after].filter(Boolean).join(' ')

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: `0 ${Math.round(videoWidth * 0.08)}px`,
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: radius,
          padding: `${padding * 0.6}px ${padding * 1.4}px`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25em',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '85%',
        }}
      >
        {before && (
          <span
            style={{
              fontFamily: '"SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize,
              fontWeight: 700,
              color: '#1a1a1a',
              lineHeight: 1.25,
            }}
          >
            {before}
          </span>
        )}
        <span
          style={{
            fontFamily: '"SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize,
            fontWeight: 900,
            color: '#000000',
            lineHeight: 1.25,
            background: '#FFE000',
            padding: '0 0.2em',
            borderRadius: 4,
          }}
        >
          {current}
        </span>
        {after && (
          <span
            style={{
              fontFamily: '"SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize,
              fontWeight: 700,
              color: '#1a1a1a',
              lineHeight: 1.25,
            }}
          >
            {after}
          </span>
        )}
      </div>
    </div>
  )
}
