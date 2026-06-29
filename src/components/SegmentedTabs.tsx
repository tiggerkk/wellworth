interface SegmentedTabsProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** 'compact' (default) or 'field' — sized so the track's total height matches `.field-control`
   *  (py-1 inside the p-1 track + 15px text), so it lines up with form inputs on an entry screen. */
  size?: 'compact' | 'field'
}

/** `input`-track segmented control; active segment = light `fill` pill with dark text. */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  size = 'compact',
}: SegmentedTabsProps<T>) {
  const btnSize = size === 'field' ? 'py-1 text-[15px]' : 'py-1.5 text-[13px]'
  return (
    <div className="flex gap-1 rounded-pill bg-input p-1">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-pill px-3 ${btnSize} font-medium transition-colors ${
              active ? 'bg-fill text-bg' : 'text-text-secondary'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
