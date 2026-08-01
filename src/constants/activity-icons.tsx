/**
 * Custom activity icon set (replaces Tabler icons for the Wellness module's activity library).
 * Tabler's icon set doesn't cover activities like Push-Ups, Sit-Ups, or 太极, and some available
 * ones (e.g. yoga) don't read clearly at small sizes, so this module owns hand-drawn stroke-based
 * SVGs instead. Each icon is `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"` so it
 * inherits color the same way Tabler icons did, and exposes the same `{ size, className }` props
 * so callers don't need to change how they render the resolved icon component. Each rendered
 * `<svg>` also carries the `tabler-icon` class so it keeps riding the Dynamic Type font-scale
 * transform in `src/index.css` (`02_tech_spec.md` F23) alongside the app's remaining Tabler icons.
 */
import type { ComponentType, ReactNode } from 'react'

export interface ActivityIconProps {
  size?: number
  className?: string
  stroke?: number
}

/** Wraps a set of inner SVG elements (paths/circles/rects) into a component matching the
 *  `{ size, className, stroke }` signature the app already calls activity icons with. */
function makeActivityIcon(
  children: (strokeWidth: number) => ReactNode,
): ComponentType<ActivityIconProps> {
  return function ActivityIcon({
    size = 24,
    className,
    stroke = 1.75,
  }: ActivityIconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={['tabler-icon', className].filter(Boolean).join(' ')}
      >
        {children(stroke)}
      </svg>
    )
  }
}

const IconBodyCombat = makeActivityIcon(() => (
  <>
    {/* Karate pose, adapted from Tabler's icon-tabler-karate */}
    <circle cx="17" cy="5" r="1.75" />
    <path d="M5 11l4.5 1l3 2.5" />
    <path d="M15 21v-8l3-5.5" />
    <path d="M10 6.5l4 2l4 1l4 3.5l-2 3.5" />
  </>
))

const IconBaduanjin = makeActivityIcon(() => (
  <>
    {/* Standing qigong reach: arms straight overhead, legs shoulder-width */}
    <circle cx="12" cy="5" r="1.75" />
    <path d="M12 6.75v7" />
    <path d="M12 8l-5-5" />
    <path d="M12 8l5-5" />
    <path d="M8 20l4-6.25l4 6.25" />
  </>
))

const IconTaichi = makeActivityIcon(() => (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a4.5 4.5 0 0 0 0 9a4.5 4.5 0 0 1 0 9" />
    <circle cx="12" cy="7.5" r="1" fill="currentColor" />
    <circle cx="12" cy="16.5" r="1" fill="currentColor" />
  </>
))

const IconStretching = makeActivityIcon(() => (
  <>
    {/* Adapted from Tabler's icon-tabler-stretching */}
    <circle cx="16" cy="5" r="1.75" />
    <path d="M5 20l5-0.5l1-2" />
    <path d="M18 20v-5h-5.5l2.5-6.5l-5.5 1l1.5 2" />
  </>
))

const IconYoga = makeActivityIcon(() => (
  <>
    {/* Warrior 2 (Virabhadrasana II): wide stance, front knee bent, arms extended to the sides */}
    <circle cx="8" cy="5" r="1.75" />
    <path d="M8 6.75v5" />
    <path d="M8 8.5h-6" />
    <path d="M8 8.5h6" />
    <path d="M8 11.75l-3 2.5v5.5" />
    <path d="M8 11.75l7.5 8" />
  </>
))

const IconPushUp = makeActivityIcon(() => (
  <>
    {/* Push-up position: body held low in a plank, one arm braced against the floor */}
    <circle cx="5" cy="15" r="1.75" />
    <path d="M2 20h20" />
    <path d="M6.5 16.5l7-1.5l6 4" />
    <path d="M9 15.7v4.3" />
  </>
))

const IconSitUp = makeActivityIcon(() => (
  <>
    {/* Sit-up: knee bent flat on the ground, torso curling up toward it */}
    <circle cx="11.5" cy="10" r="1.75" />
    <path d="M2 20h20" />
    <path d="M4 20l5-6l6 6" />
    <path d="M15 20l-3.5-8.5" />
    <path d="M11.5 13l-2 1" />
  </>
))

const IconWeights = makeActivityIcon(() => (
  <>
    <path d="M2 12h20" />
    <rect x="5" y="6" width="3" height="12" rx="1" />
    <rect x="16" y="6" width="3" height="12" rx="1" />
    <path d="M2 9v6M22 9v6" />
  </>
))

const IconSwimming = makeActivityIcon(() => (
  <>
    {/* Adapted from Tabler's icon-tabler-swimming */}
    <circle cx="16" cy="9" r="1.75" />
    <path d="M6 11l4-2l3.5 3l-1.5 2" />
    <path d="M3 16.75a2.4 2.4 0 0 0 1 .25a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 1-.25" />
  </>
))

const IconWalking = makeActivityIcon(() => (
  <>
    {/* Adapted from Tabler's icon-tabler-walk */}
    <circle cx="13" cy="4" r="1.75" />
    <path d="M7 21l3-4" />
    <path d="M16 21l-2-4l-3-3l1-6" />
    <path d="M6 12l2-3l4-1l3 3l3 1" />
  </>
))

const IconRunning = makeActivityIcon(() => (
  <>
    {/* Adapted from Tabler's icon-tabler-run */}
    <circle cx="13" cy="5" r="1.75" />
    <path d="M4 17l5 1l0.75-1.5" />
    <path d="M15 21v-4l-4-3l1-6" />
    <path d="M7 12v-3l5-1l3 3l3 1" />
  </>
))

/**
 * Maps the icon-key string stored in `activity.icon` to the component. Null/unknown falls
 * back to DEFAULT_ACTIVITY_ICON. Add new activity icons here as new keys, not in the seed
 * data or screens.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const ACTIVITY_ICONS: Record<string, ComponentType<ActivityIconProps>> = {
  bodycombat: IconBodyCombat,
  baduanjin: IconBaduanjin,
  taichi: IconTaichi,
  stretching: IconStretching,
  yoga: IconYoga,
  pushup: IconPushUp,
  situp: IconSitUp,
  weights: IconWeights,
  swimming: IconSwimming,
  walking: IconWalking,
  running: IconRunning,
}

export const DEFAULT_ACTIVITY_ICON: ComponentType<ActivityIconProps> = IconRunning

// eslint-disable-next-line react-refresh/only-export-components
export function resolveActivityIcon(
  name: string | null,
): ComponentType<ActivityIconProps> {
  return (name && ACTIVITY_ICONS[name]) || DEFAULT_ACTIVITY_ICON
}
