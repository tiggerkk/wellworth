import { useRef, useState, type ReactNode } from 'react'
import { IconGripVertical } from '@tabler/icons-react'

interface ReorderGridProps {
  /** Current order of cell ids (linear, left→right then top→down). */
  ids: string[]
  /** Called with the new order when a drag drops on a different slot. */
  onReorder: (next: string[]) => void
  /** Cell body for an id (truncated to one line so cells are uniform-height). */
  renderLabel: (id: string) => ReactNode
  /** Accessible label for a cell's drag handle. */
  handleLabel?: (id: string) => string
  /** Optional trailing control for a cell (e.g. a visibility Toggle). */
  renderTrailing?: (id: string) => ReactNode
}

interface DragState {
  index: number
  target: number
  dx: number
  dy: number
}

/**
 * A 2-up (two-column) pointer-drag reorderable grid — the grid-aware sibling of `ReorderList`
 * (which is 1-D and shared by several other sheets, so it stays untouched). Same in-house Pointer
 * Events pattern as `ReorderList`/`SwipeRow` (mouse + touch + pen, no dnd dependency).
 *
 * Cells lay out in `grid-cols-2`, so the linear `ids` order maps to the Home hub's reading order
 * (left→right, top→down) — a cell's position in the grid is its hub position.
 *
 * Interaction tradeoff: instead of a full 2-D reflow animation (fiddly + jumpy on touch), the dragged
 * cell floats under the finger and the destination slot is outlined; the array commits on release. The
 * target slot is the cell whose center is nearest the pointer, measured from rects cached at drag start
 * (the non-dragged cells don't move, so those rects stay valid for the whole drag).
 */
export function ReorderGrid({
  ids,
  onReorder,
  renderLabel,
  handleLabel,
  renderTrailing,
}: ReorderGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const start = useRef({ x: 0, y: 0 })
  const centers = useRef<{ x: number; y: number }[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)

  function down(e: React.PointerEvent, index: number) {
    const cells = Array.from(containerRef.current?.children ?? []) as HTMLElement[]
    centers.current = cells.map((c) => {
      const r = c.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
    start.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ index, target: index, dx: 0, dy: 0 })
  }

  function move(e: React.PointerEvent) {
    setDrag((d) => {
      if (!d) return d
      let target = d.index
      let best = Infinity
      for (let i = 0; i < centers.current.length; i++) {
        const c = centers.current[i]!
        const dist = (e.clientX - c.x) ** 2 + (e.clientY - c.y) ** 2
        if (dist < best) {
          best = dist
          target = i
        }
      }
      return {
        ...d,
        dx: e.clientX - start.current.x,
        dy: e.clientY - start.current.y,
        target,
      }
    })
  }

  function up() {
    if (drag && drag.target !== drag.index) {
      const next = [...ids]
      const [moved] = next.splice(drag.index, 1)
      next.splice(drag.target, 0, moved!)
      onReorder(next)
    }
    setDrag(null)
  }

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-2">
      {ids.map((id, i) => {
        const dragging = drag?.index === i
        const isTarget = drag != null && drag.target === i && drag.index !== i
        const style = dragging
          ? {
              transform: `translate(${drag.dx}px, ${drag.dy}px)`,
              zIndex: 10,
              position: 'relative' as const,
            }
          : undefined

        return (
          <div
            key={id}
            style={style}
            className={`flex items-center gap-2 rounded-card border bg-surface px-2 py-2.5 ${
              dragging
                ? 'border-border shadow-lg'
                : isTarget
                  ? 'border-accent'
                  : 'border-border'
            }`}
          >
            <div className="min-w-0 flex-1 truncate text-body text-text-primary">
              {renderLabel(id)}
            </div>
            {renderTrailing && <div className="shrink-0">{renderTrailing(id)}</div>}
            <button
              type="button"
              aria-label={handleLabel ? handleLabel(id) : 'Drag to reorder'}
              onPointerDown={(e) => down(e, i)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              style={{ touchAction: 'none' }}
              className="-mr-1 shrink-0 cursor-grab p-1 text-text-tertiary active:cursor-grabbing"
            >
              <IconGripVertical size={18} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
