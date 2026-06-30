import { netEnergy } from '../lib/energy'

interface EnergyBalanceCardProps {
  consumed: number
  bmr: number
  activity: number
}

function Row({ label, value, sign }: { label: string; value: number; sign?: '−' }) {
  return (
    <div className="flex items-center justify-between py-1 text-body">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary">
        {sign}
        {Math.round(value)} kcal
      </span>
    </div>
  )
}

/** Consumed · BMR · Activity · bold Net = Consumed − BMR − Activity. */
export function EnergyBalanceCard({ consumed, bmr, activity }: EnergyBalanceCardProps) {
  const net = netEnergy({ consumed, bmr, activity })
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <h2 className="mb-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
        Energy Balance
      </h2>
      <Row label="Consumed" value={consumed} />
      <Row label="BMR" value={bmr} sign="−" />
      <Row label="Activity" value={activity} sign="−" />
      <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-body font-semibold">
        <span className="text-text-primary">Net</span>
        <span className={net < 0 ? 'text-accent' : 'text-text-primary'}>
          {Math.round(net)} kcal
        </span>
      </div>
    </div>
  )
}
