'use client'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { Kpi } from '@/lib/owner/types'

interface Props {
  kpis: Kpi[]
}

function fmtBs(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatValue(kpi: Kpi): string {
  switch (kpi.format) {
    case 'bs':
      return `Bs ${fmtBs(kpi.value)}`
    case 'usd':
      return `$ ${fmtBs(kpi.value)}`
    case 'pct':
      return `${kpi.value.toFixed(1)}%`
    case 'time':
      return `${String(kpi.value).padStart(2, '0')}:00`
    default:
      return String(Math.round(kpi.value))
  }
}

function VariationBadge({ kpi }: { kpi: Kpi }) {
  if (!kpi.variation) return null
  const { pct, direction } = kpi.variation
  const cls =
    direction === 'up'
      ? 'bg-emerald-100 text-emerald-700'
      : direction === 'down'
        ? 'bg-red-100 text-red-700'
        : 'bg-gray-100 text-gray-500'
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold ${cls}`}
    >
      <Icon size={10} />
      {pct >= 0 ? '+' : ''}
      {pct.toFixed(0)}%
    </span>
  )
}

export default function KpiGrid({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {kpis.map((k) => (
        <div key={k.id} className="card p-3.5">
          <div className="flex items-start justify-between gap-1.5 mb-1.5">
            <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide leading-tight">
              {k.label}
            </p>
            <VariationBadge kpi={k} />
          </div>
          <p className="text-[20px] font-extrabold text-gray-900 leading-tight">
            {formatValue(k)}
          </p>
          {k.sub && (
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">{k.sub}</p>
          )}
        </div>
      ))}
    </div>
  )
}
