import { IconDownload, IconUpload } from '@tabler/icons-react'

interface ImportExportRowProps {
  importLabel: string
  onImport: () => void
  exportLabel: string
  onExport: () => void
  /** True while the export is being built (disables the button + swaps its label). */
  exporting?: boolean
  /** e.g. nothing to export yet — disables the Export button without touching Import. */
  exportDisabled?: boolean
}

/**
 * One "Import X" / "Export X" button pair, side by side, sharing the section's hairline border.
 * Used by every module's Settings screen Import section (gated behind the same
 * `*_importer_enabled` toggle that already gates Import). Export always builds and downloads the
 * file client-side — the resulting CSV/JSON re-imports unchanged via the paired Import button.
 */
export function ImportExportRow({
  importLabel,
  onImport,
  exportLabel,
  onExport,
  exporting = false,
  exportDisabled = false,
}: ImportExportRowProps) {
  return (
    <div className="flex w-full border-b border-border last:border-b-0">
      <button
        onClick={onImport}
        className="flex flex-1 items-center gap-2 px-4 py-2 text-body text-accent active:bg-input/40"
      >
        <IconUpload size={18} /> {importLabel}
      </button>
      <button
        onClick={onExport}
        disabled={exporting || exportDisabled}
        className="flex flex-1 items-center gap-2 border-l border-border px-4 py-2 text-body text-accent active:bg-input/40 disabled:opacity-50"
      >
        <IconDownload size={18} /> {exporting ? 'Exporting…' : exportLabel}
      </button>
    </div>
  )
}
