import {
  IconBed,
  IconBowlChopsticks,
  IconBrandShopee,
  IconCamera,
  IconCategory,
  IconTrain,
  type IconProps,
} from '@tabler/icons-react'
import type { ComponentType } from 'react'
import type { StopType } from '../constants/travel'

/** Stop-type → Tabler icon. Travel=train, Visit=camera, Eat=bowl-chopsticks, Shop=brand-shopee,
 *  Stay=bed, Other=category. Used in the Edit-Trip itinerary stop rows in place of the type text. */
const STOP_TYPE_ICONS: Record<StopType, ComponentType<IconProps>> = {
  travel: IconTrain,
  visit: IconCamera,
  eat: IconBowlChopsticks,
  shop: IconBrandShopee,
  stay: IconBed,
  other: IconCategory,
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
  const Icon = STOP_TYPE_ICONS[type as StopType] ?? IconCategory
  return <Icon size={size} className={className} />
}
