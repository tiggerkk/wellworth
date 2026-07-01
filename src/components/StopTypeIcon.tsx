import {
  IconBed,
  IconBowlChopsticks,
  IconBrandShopee,
  IconCamera,
  IconMapPin,
  IconPlaneTilt,
  type IconProps,
} from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { STOP_TYPE_COLORS, type StopType } from '../constants/travel'

/** Stop-type → Tabler icon. Travel=plane-tilt, Visit=camera, Eat=bowl-chopsticks, Shop=brand-shopee,
 *  Stay=bed, Other=map-pin. Used in the Edit-Trip itinerary stop rows in place of the type text. */
const STOP_TYPE_ICONS: Record<StopType, ComponentType<IconProps>> = {
  travel: IconPlaneTilt,
  visit: IconCamera,
  eat: IconBowlChopsticks,
  shop: IconBrandShopee,
  stay: IconBed,
  other: IconMapPin,
}

export function StopTypeIcon({
  type,
  size = 16,
  className,
}: {
  type: string
  size?: number
  className?: string
}) {
  const key = (STOP_TYPE_ICONS[type as StopType] ? type : 'other') as StopType
  const Icon = STOP_TYPE_ICONS[key]
  // Tint per kind via `currentColor` (a design-token CSS var); callers pass layout classes only.
  return (
    <Icon size={size} className={className} style={{ color: STOP_TYPE_COLORS[key] }} />
  )
}
