/**
 * Medical Dashboard (module index) — trend charts for tracked tests, latest values by category,
 * and a reports timeline. M1 ships the scaffold; the dashboard body lands in M4. The biometric
 * lock gate (M6) will wrap module entry.
 */
export function MedicalDashboard() {
  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <h1 className="text-lg font-medium text-text-primary">Medical</h1>
      <p className="text-sm text-text-secondary">
        Trends and latest results will appear here once you add a report.
      </p>
    </div>
  )
}
