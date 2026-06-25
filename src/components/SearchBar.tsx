import { IconBarcode, IconSearch } from '@tabler/icons-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onScan?: () => void
  /** Applied to the root — pass `min-w-0 flex-1` to fill a flex row next to a Filter icon. */
  className?: string
}

/** Magnifier + input, with an optional barcode-scan button (Add Food). */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search',
  onScan,
  className = '',
}: SearchBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex flex-1 items-center gap-2 rounded-input bg-input px-3 py-2">
        <IconSearch size={18} className="shrink-0 text-text-secondary" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      </div>
      {onScan && (
        <button
          onClick={onScan}
          aria-label="Scan barcode"
          className="flex size-10 shrink-0 items-center justify-center rounded-input bg-input text-text-secondary"
        >
          <IconBarcode size={20} />
        </button>
      )}
    </div>
  )
}
