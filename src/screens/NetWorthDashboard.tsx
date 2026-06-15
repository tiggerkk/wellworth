/**
 * Net Worth Dashboard — placeholder (Phase 2 M2). The real dashboard (current total,
 * trends, by-asset-type) is built in M5; the data layer + Monthly Entry land in M3–M4.
 */
export function NetWorthDashboard() {
  return (
    <div className="pb-4">
      <header className="sticky top-0 z-10 bg-bg/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-medium text-text-primary">Net Worth</h1>
      </header>
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-text-secondary">Net Worth is coming soon.</p>
        <p className="mt-1 text-xs text-text-tertiary">
          Monthly entry, FX conversion, and trend graphs are being built.
        </p>
      </div>
    </div>
  )
}
