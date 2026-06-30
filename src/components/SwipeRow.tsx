import { useRef, useState, type ReactNode } from 'react'

const REVEAL = 80 // px of red Delete action revealed when open

interface SwipeRowProps {
  children: ReactNode
  onDelete: () => void
}

/**
 * Swipe-left to reveal a Delete action (mouse + touch + pen via Pointer Events). The
 * revealed control is a real focusable button, so it (and a parent ⋯ menu) keep the action
 * operable without the gesture. `touch-action: pan-y pinch-zoom` keeps vertical scrolling and
 * pinch-zoom with the page (the swipe is horizontal, so the browser still hands it to JS); omitting
 * `pinch-zoom` would silently disable zoom over every row (see F21 in docs/02_tech_spec.md).
 */
export function SwipeRow({ children, onDelete }: SwipeRowProps) {
  const [offset, setOffset] = useState(0) // ≤ 0
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const active = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY, base: offset }
    active.current = false
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (!active.current) {
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return // not yet a horizontal swipe
      active.current = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setOffset(Math.min(0, Math.max(-REVEAL, start.current.base + dx)))
  }
  function onPointerUp() {
    if (active.current) setOffset(offset < -REVEAL / 2 ? -REVEAL : 0)
    setDragging(false)
    active.current = false
    start.current = null
  }

  return (
    <div className="relative overflow-hidden" style={{ touchAction: 'pan-y pinch-zoom' }}>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-delete text-sm font-medium text-white"
      >
        Delete
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${offset}px)` }}
        className={`relative bg-surface ${dragging ? '' : 'transition-transform duration-150 ease-out motion-reduce:transition-none'}`}
      >
        {children}
      </div>
    </div>
  )
}
