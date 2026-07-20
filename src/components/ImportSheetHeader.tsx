import { ScreenHeaderTitle } from './ScreenHeaderTitle'

interface ImportSheetHeaderProps {
  title: string
}

/**
 * Header for the Import*Sheet screens (CSV/JSON import flows), all launched from a module's
 * Settings screen. Thin wrapper over `ScreenHeaderTitle` — always a back chevron, no actions;
 * saves each Import sheet from repeating `icon="back"`.
 */
export function ImportSheetHeader({ title }: ImportSheetHeaderProps) {
  return <ScreenHeaderTitle title={title} icon="back" />
}
