/**
 * ViralOS Remotion Root
 * Registers all compositions for the Remotion bundler and renderer.
 */

import React from 'react'
import { Composition, registerRoot } from 'remotion'
import {
  ViralOSComposition,
  getVideoDimensions,
  FPS,
  type ViralOSCompositionProps,
} from './compositions/ViralOSComposition'

// Default props for the Remotion Studio preview
const defaultProps: ViralOSCompositionProps = {
  format: '9:16',
  title: 'ViralOS Preview',
  scenes: [
    {
      sceneNumber: 1,
      narration: 'This is a preview scene. Generate a real video from the app.',
      cameraMove: 'wide_reveal',
      emotion: 'neutral',
      imageUrl: 'https://image.pollinations.ai/prompt/cinematic%20preview%20scene%20dark%20dramatic%20lighting?width=1080&height=1920&nologo=true',
      audioBase64: '',
      audioDurationSeconds: 5,
      captionStyle: 'tiktok-v2',
    },
  ],
}

export function RemotionRoot() {
  const { width: w9_16, height: h9_16 } = getVideoDimensions('9:16')
  const { width: w16_9, height: h16_9 } = getVideoDimensions('16:9')
  const { width: w1_1, height: h1_1 } = getVideoDimensions('1:1')

  return (
    <>
      <Composition
        id="ViralOS-9-16"
        component={ViralOSComposition}
        durationInFrames={FPS * 60}
        fps={FPS}
        width={w9_16}
        height={h9_16}
        defaultProps={{ ...defaultProps, format: '9:16' }}
        calculateMetadata={({ props }) => {
          const p = props as ViralOSCompositionProps
          return { durationInFrames: p.scenes.reduce((sum: number, s) => sum + Math.round(s.audioDurationSeconds * FPS), 0) || FPS * 60 }
        }}
      />
      <Composition
        id="ViralOS-16-9"
        component={ViralOSComposition}
        durationInFrames={FPS * 60}
        fps={FPS}
        width={w16_9}
        height={h16_9}
        defaultProps={{ ...defaultProps, format: '16:9' }}
        calculateMetadata={({ props }) => {
          const p = props as ViralOSCompositionProps
          return { durationInFrames: p.scenes.reduce((sum: number, s) => sum + Math.round(s.audioDurationSeconds * FPS), 0) || FPS * 60 }
        }}
      />
      <Composition
        id="ViralOS-1-1"
        component={ViralOSComposition}
        durationInFrames={FPS * 60}
        fps={FPS}
        width={w1_1}
        height={h1_1}
        defaultProps={{ ...defaultProps, format: '1:1' }}
        calculateMetadata={({ props }) => {
          const p = props as ViralOSCompositionProps
          return { durationInFrames: p.scenes.reduce((sum: number, s) => sum + Math.round(s.audioDurationSeconds * FPS), 0) || FPS * 60 }
        }}
      />
    </>
  )
}

// /api/render/run passes this file directly to @remotion/bundler's bundle()
// as the entryPoint. Remotion requires that entry point to call
// registerRoot() — without it, bundle() throws:
//   "this file does not contain registerRoot"
// RemotionRoot was exported here but never registered. This call fixes that.
registerRoot(RemotionRoot)
