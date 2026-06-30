import { useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { foldZh } from '../lib/zh-fold'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  /** Existing tags to autocomplete against (already-picked ones are filtered out). */
  suggestions?: string[]
  placeholder?: string
}

/**
 * A free-form tag editor: committed tags render as removable chips, with a text input that commits
 * on **Enter** or **comma** and removes the last chip on **Backspace** when empty. A filtered
 * suggestion dropdown commits on click. Case-insensitive dedupe; trims and drops empties. Reused by
 * the Quotes Entry form (and the M5 Library facet).
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add a tag…',
}: TagInputProps) {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)

  const commit = (raw: string) => {
    const tag = raw.trim()
    if (!tag) return
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setInput('')
      return
    }
    onChange([...value, tag])
    setInput('')
  }

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag))

  const q = foldZh(input.trim())
  const matches = suggestions.filter(
    (s) =>
      !value.some((t) => t.toLowerCase() === s.toLowerCase()) &&
      (q === '' || foldZh(s).includes(q)),
  )

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(input)
    } else if (e.key === 'Backspace' && input === '') {
      const last = value[value.length - 1]
      if (last !== undefined) remove(last)
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-input bg-input px-2 py-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-pill bg-track px-2 py-0.5 text-label text-text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`Remove ${tag}`}
              className="text-text-tertiary"
            >
              <IconX size={13} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-field text-text-primary placeholder:text-text-secondary focus:outline-none"
        />
      </div>

      {focused && matches.length > 0 && (
        <div className="absolute left-0 z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-card border border-border bg-surface text-body shadow-lg">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              // Keep input focused so the click registers before blur hides the menu.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(s)}
              className="block w-full px-3 py-2 text-left text-text-primary active:bg-input/40"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
