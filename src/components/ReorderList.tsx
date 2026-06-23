import { useRef, useState, type ReactNode } from 'react'
import { IconGripVertical } from '@tabler/icons-react'

interface ReorderListProps {
  /** Current order of row ids. */
  ids: string[]
  /** Called with the new order when a drag drops at a different position. */
  onReorder: (next: string[]) => void
  /** Row body for an id (truncated to one line so rows are uniform-height). */
  renderLabel: (id: string) => ReactNode
  /** Accessible label for a row's drag handle. */
  handleLabel?: (id: string) => string
}

interface DragState {
  index: number
  target: number
  dy: number
  rowH: number
}

/**
 * A pointer-drag reorderable list (mouse + touch + pen via Pointer Events; no dnd dependency —
 * consistent with `SwipeRow`'s in-house pointer pattern). Drag the **handle** to move a row; the
 * rows it passes shift to open a gap, and it commits on release. Assumes **uniform row height**
 * (rows truncate to one line) so the target slot is `round(dragΔ / rowHeight)` — simple and robust.
 * `touch-action: none` is on the handle only, so touching a row body still scrolls the page.
 */
export function ReorderList({
  ids,
  onReorder,
  renderLabel,
  handleLabel,
}: ReorderListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const [drag, setDrag] = useState<DragState | null>(null)

  function down(e: React.PointerEvent, index: number) {
    const first = containerRef.current?.children[0] as HTMLElement | undefined
    const rowH = first ? first.getBoundingClientRect().height : 44
    startY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ index, target: index, dy: 0, rowH })
  }

  function move(e: React.PointerEvent) {
    setDrag((d) => {
      if (!d) return d
      const dy = e.clientY - startY.current
      const target = Math.max(
        0,
        Math.min(ids.length - 1, d.index + Math.round(dy / d.rowH)),
      )
      return { ...d, dy, target }
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
    <div
      ref={containerRef}
      className="overflow-hidden rounded-card border border-border bg-surface"
    >
      {ids.map((id, i) => {
        let translateY = 0
        let dragging = false
        if (drag) {
          if (i === drag.index) {
            dragging = true
            translateY = drag.dy
          } else if (drag.index < drag.target && i > drag.index && i <= drag.target) {
            translateY = -drag.rowH
          } else if (drag.index > drag.target && i < drag.index && i >= drag.target) {
            translateY = drag.rowH
          }
        }
        return (
          <div
            key={id}
            style={{
              transform: `translateY(${translateY}px)`,
              transition: dragging ? 'none' : 'transform 150ms ease',
              zIndex: dragging ? 10 : undefined,
              position: 'relative',
            }}
            className={`flex items-center gap-2 border-b border-border bg-surface px-3 py-2.5 last:border-b-0 ${
              dragging ? 'shadow-lg' : ''
            }`}
          >
            <button
              type="button"
              aria-label={handleLabel ? handleLabel(id) : 'Drag to reorder'}
              onPointerDown={(e) => down(e, i)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              style={{ touchAction: 'none' }}
              className="-ml-1 shrink-0 cursor-grab p-1 text-text-tertiary active:cursor-grabbing"
            >
              <IconGripVertical size={18} />
            </button>
            <div className="min-w-0 flex-1 truncate text-[15px] text-text-primary">
              {renderLabel(id)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
