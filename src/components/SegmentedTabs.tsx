interface SegmentedTabsProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** `input`-track segmented control; active segment = light `fill` pill with dark text. */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: SegmentedTabsProps<T>) {
  return (
    <div className="flex gap-1 rounded-pill bg-input p-1">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-pill px-3 py-1.5 text-[13px] font-medium transition-colors ${
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
