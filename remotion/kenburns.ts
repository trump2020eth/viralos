/**
 * ViralOS Ken Burns Engine
 * Ported from legacy getCameraMove() + parseCameraMovement()
 *
 * Converts named camera move vocabulary into Remotion CSS transform interpolations.
 * Each move returns { scale, translateX, translateY } at frame t within durationFrames.
 */

export type KenBurnsMove =
  | 'wide_reveal'
  | 'intimacy_push'
  | 'reveal_pan'
  | 'tension_creep'
  | 'hero_rise'
  | 'memory_drift'
  | 'chaos_shake'
  | 'clarity_lock'
  | 'perspective_shift'
  | 'emotional_hold'

export interface KenBurnsFrame {
  scale: number
  translateX: number // percent
  translateY: number // percent
}

/**
 * lerp — linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * easeInOut — smooth acceleration/deceleration
 */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

/**
 * easeOut — decelerating motion
 */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2)
}

/**
 * getKenBurnsFrame()
 * Returns CSS transform values for a given frame within a scene.
 *
 * @param move - Named camera move from the vocabulary
 * @param frame - Current frame number (0-based)
 * @param durationFrames - Total frames for this scene
 */
export function getKenBurnsFrame(
  move: string,
  frame: number,
  durationFrames: number
): KenBurnsFrame {
  const t = Math.min(frame / Math.max(durationFrames - 1, 1), 1)
  const te = easeInOut(t)
  const to = easeOut(t)

  // Parse named move or fall back to clarity_lock
  const parsed = parseCameraMovement(move)

  switch (parsed) {
    // Slow zoom-out from center, revealing full environment (hook beat)
    case 'wide_reveal':
      return {
        scale: lerp(1.15, 1.0, te),
        translateX: 0,
        translateY: 0,
      }

    // Slow dolly-in toward subject face, tightening frame (intimacy)
    case 'intimacy_push':
      return {
        scale: lerp(1.0, 1.2, te),
        translateX: 0,
        translateY: lerp(0, -3, te),
      }

    // Lateral pan left-to-right revealing scene elements (revelation)
    case 'reveal_pan':
      return {
        scale: 1.08,
        translateX: lerp(-5, 5, te),
        translateY: 0,
      }

    // Imperceptible slow zoom-in building unease (setup/tension)
    case 'tension_creep':
      return {
        scale: lerp(1.0, 1.08, te),
        translateX: lerp(0, 1, te),
        translateY: lerp(0, 1, te),
      }

    // Low angle tilt-up, subject grows in frame (payoff/hero)
    case 'hero_rise':
      return {
        scale: lerp(1.05, 1.15, te),
        translateX: 0,
        translateY: lerp(5, -3, te),
      }

    // Gentle drift right with soft rack focus simulation (memory/nostalgia)
    case 'memory_drift':
      return {
        scale: lerp(1.06, 1.1, te),
        translateX: lerp(-3, 3, te),
        translateY: lerp(1, -1, te),
      }

    // Subtle handheld wobble, energy and urgency (chaos/tension)
    case 'chaos_shake': {
      // Deterministic pseudo-random wobble using frame number
      const wobbleX = Math.sin(frame * 0.8) * 1.2 + Math.sin(frame * 1.3) * 0.6
      const wobbleY = Math.cos(frame * 0.9) * 0.8 + Math.cos(frame * 1.7) * 0.4
      return {
        scale: lerp(1.04, 1.08, te) + Math.sin(frame * 2.1) * 0.005,
        translateX: wobbleX,
        translateY: wobbleY,
      }
    }

    // Locked-off static shot, truth and certainty (CTA)
    case 'clarity_lock':
      return {
        scale: 1.0,
        translateX: 0,
        translateY: 0,
      }

    // Rotate 15° while zooming out — reframing reality (turn beat)
    // Implemented as zoom-out + diagonal push (CSS rotation handled in component)
    case 'perspective_shift':
      return {
        scale: lerp(1.12, 1.0, to),
        translateX: lerp(-4, 0, te),
        translateY: lerp(3, 0, te),
      }

    // Ultra-slow zoom-in 5% over full duration, meditative (emotional hold)
    case 'emotional_hold':
      return {
        scale: lerp(1.0, 1.05, t), // linear — no easing for ultra-slow feel
        translateX: 0,
        translateY: lerp(0, -2, t),
      }

    default:
      return { scale: 1.0, translateX: 0, translateY: 0 }
  }
}

/**
 * parseCameraMovement()
 * Maps free-text camera descriptions to named vocabulary.
 * Ported from legacy parseCameraMovement().
 */
export function parseCameraMovement(text: string): KenBurnsMove {
  if (!text) return 'clarity_lock'
  const t = text.toLowerCase()

  if (t.includes('wide_reveal') || (t.includes('zoom') && t.includes('out') && t.includes('reveal'))) return 'wide_reveal'
  if (t.includes('intimacy_push') || (t.includes('dolly') && t.includes('in')) || (t.includes('zoom') && t.includes('face'))) return 'intimacy_push'
  if (t.includes('reveal_pan') || t.includes('lateral pan') || (t.includes('pan') && t.includes('left'))) return 'reveal_pan'
  if (t.includes('tension_creep') || (t.includes('zoom') && t.includes('unease'))) return 'tension_creep'
  if (t.includes('hero_rise') || t.includes('tilt-up') || t.includes('tilt up') || t.includes('low angle')) return 'hero_rise'
  if (t.includes('memory_drift') || t.includes('drift') || t.includes('rack focus')) return 'memory_drift'
  if (t.includes('chaos_shake') || t.includes('handheld') || t.includes('wobble') || t.includes('shake')) return 'chaos_shake'
  if (t.includes('clarity_lock') || t.includes('locked') || t.includes('static')) return 'clarity_lock'
  if (t.includes('perspective_shift') || t.includes('reframe') || t.includes('pivot')) return 'perspective_shift'
  if (t.includes('emotional_hold') || (t.includes('slow') && t.includes('meditation'))) return 'emotional_hold'

  // Fallback: parse generic directions
  if (t.includes('zoom in') || t.includes('push in')) return 'intimacy_push'
  if (t.includes('zoom out') || t.includes('pull back')) return 'wide_reveal'
  if (t.includes('pan')) return 'reveal_pan'
  if (t.includes('tilt')) return 'hero_rise'

  return 'clarity_lock'
}
