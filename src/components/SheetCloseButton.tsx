import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'

/**
 * Shared `X` close button for a routed `Sheet`'s header. Closes via `navigate(-1)`, same as the
 * scrim/Esc handlers in `Sheet.tsx` — so every routed sheet dismisses identically without each
 * screen re-typing the button.
 */
export function SheetCloseButton() {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(-1)} aria-label="Close">
      <IconX size={22} className="text-text-secondary" />
    </button>
  )
}
