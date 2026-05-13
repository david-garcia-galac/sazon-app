'use client'

import { formatBs, formatUSD, hoy as hoyFn } from '@/lib/constants'

export type PeriodoDetalleIngresos = {
  bs: {
    total: number
    efectivo: number
    pago_movil: number
    transferencia: number
    ventas: number
  }
  usd: { totalUsd: number; equivBs: number; ventas: number }
  conciliacion: {
    ingresosBolivares: number
    bolivaresEquivUsd: number
    totalBolivares: number
    totalDivisaUsd: number
    ventasTotal: number
  }
}

export type DiaAgg = {
  egresos: number
  saldo: number
}

// ── Donut chart ───────────────────────────────────────────────────────────────

interface DonutSegment {
  value: number
  color: string
  gradId: string
  label: string
  display: string
}

function polarXY(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(cx: number, cy: number, R: number, ri: number, a0: number, a1: number) {
  const s  = polarXY(cx, cy, R,  a0)
  const e  = polarXY(cx, cy, R,  a1)
  const si = polarXY(cx, cy, ri, a0)
  const ei = polarXY(cx, cy, ri, a1)
  const lg = a1 - a0 > Math.PI ? 1 : 0
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${lg} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${ri} ${ri} 0 ${lg} 0 ${si.x} ${si.y} Z`
}

function DonutChart({ segments, center }: { segments: DonutSegment[]; center: string }) {
  const total = segments.reduce((s, g) => s + g.value, 0)
  const cx = 90, cy = 90, R = 78, ri = 50
  let angle = -Math.PI / 2

  const slices = segments
    .filter(s => s.value > 0)
    .map(s => {
      const span = total > 0 ? (s.value / total) * 2 * Math.PI : 0
      // avoid SVG full-circle degenerate path
      const clamp = span >= 2 * Math.PI - 0.001 ? 2 * Math.PI - 0.002 : span
      const path = { d: arcPath(cx, cy, R, ri, angle, angle + clamp), seg: s }
      angle += span
      return path
    })

  return (
    <svg viewBox="0 0 180 180" className="w-44 h-44 flex-shrink-0 drop-shadow-md">
      <defs>
        {segments.map(s => (
          <radialGradient key={s.gradId} id={s.gradId} cx="35%" cy="35%" r="65%">
            <stop offset="0%"   stopColor={s.color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={s.color} stopOpacity="1"   />
          </radialGradient>
        ))}
        <filter id="donut-shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.18" />
        </filter>
      </defs>

      {total === 0 ? (
        <circle cx={cx} cy={cy} r={R} fill="#F3F4F6" />
      ) : (
        <g filter="url(#donut-shadow)">
          {slices.map(({ d, seg }) => (
            <path key={seg.gradId} d={d} fill={`url(#${seg.gradId})`} />
          ))}
        </g>
      )}

      {/* Hole */}
      <circle cx={cx} cy={cy} r={ri - 1} fill="white" />

      {/* Center label */}
      <text
        x={cx} y={cy - 5}
        textAnchor="middle"
        fill="#1F2937"
        style={{ fontSize: '10.5px', fontWeight: 800 }}
      >
        {center}
      </text>
      <text
        x={cx} y={cy + 10}
        textAnchor="middle"
        fill="#9CA3AF"
        style={{ fontSize: '8px' }}
      >
        total Bs
      </text>
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDia(iso: string): string {
  const [y, m, day] = iso.split('-').map(Number)
  if (!y || !m || !day) return iso
  return new Date(y, m - 1, day).toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'short',
  })
}

function shortBs(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' M Bs'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.', ',') + ' k Bs'
  return formatBs(n)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardDiaResumen({
  fechaValue,
  onFechaChange,
  detalle,
  agg,
}: {
  fechaValue: string
  onFechaChange: (iso: string) => void
  detalle: PeriodoDetalleIngresos
  agg: DiaAgg
}) {
  const cap    = hoyFn()
  const esHoy  = fechaValue === cap
  const d      = detalle
  const pos    = (d.bs.total - agg.egresos) >= 0

  const totalEquiv  = d.bs.total   // pure Bs income (USD shown separately)
  const totalVentas = d.bs.ventas + d.usd.ventas
  const bsSaldo     = d.bs.total - agg.egresos

  const segments: DonutSegment[] = [
    {
      value: d.bs.efectivo,
      color: '#F59E0B',
      gradId: 'grad-efect',
      label: 'Efectivo Bs',
      display: formatBs(d.bs.efectivo),
    },
    {
      value: d.bs.pago_movil,
      color: '#F97316',
      gradId: 'grad-movil',
      label: 'Pago Móvil',
      display: formatBs(d.bs.pago_movil),
    },
    {
      value: d.bs.transferencia,
      color: '#6366F1',
      gradId: 'grad-pdv',
      label: 'Punto de Venta',
      display: formatBs(d.bs.transferencia),
    },
    {
      value: d.usd.totalUsd,
      color: '#10B981',
      gradId: 'grad-usd',
      label: 'Divisas USD',
      display: formatUSD(d.usd.totalUsd),
    },
  ]

  const hayDatos = totalEquiv > 0 || d.usd.totalUsd > 0

  return (
    <section className="space-y-3">

      {/* Date row */}
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0 capitalize">
          {esHoy ? '📅 Hoy' : `📅 ${fmtDia(fechaValue)}`}
        </h2>
        <label className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-[10px] font-medium text-brand-brown">Fecha</span>
          <input
            type="date"
            max={cap}
            value={fechaValue}
            onChange={e => onFechaChange(e.target.value)}
            className="rounded-xl border-2 border-orange-200 px-2 py-1 text-xs text-brand-brown bg-white shadow-sm"
          />
        </label>
      </div>

      {/* ── Hero saldo ── */}
      <div
        className={`rounded-2xl p-5 shadow-lg ${
          pos
            ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600'
            : 'bg-gradient-to-br from-red-400 via-rose-500 to-red-600'
        }`}
      >
        <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1.5">
          Saldo del día
        </p>
        <p className="text-white font-black leading-none tabular-nums"
           style={{ fontSize: 'clamp(1.9rem, 8vw, 2.6rem)' }}>
          {formatBs(bsSaldo)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-white/15 rounded-xl px-3 py-2">
            <p className="text-white/60 text-[9px] uppercase tracking-wide font-semibold">Ingresos Bs</p>
            <p className="text-white font-bold text-sm tabular-nums">{shortBs(d.bs.total)}</p>
            {d.usd.totalUsd > 0 && (
              <p className="text-white/70 text-[9px] tabular-nums font-semibold">+ {formatUSD(d.usd.totalUsd)} USD</p>
            )}
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-2">
            <p className="text-white/60 text-[9px] uppercase tracking-wide font-semibold">Egresos</p>
            <p className="text-white font-bold text-sm tabular-nums">{shortBs(agg.egresos)}</p>
          </div>
        </div>
      </div>

      {!hayDatos && (
        <div className="rounded-2xl border border-orange-100 bg-gradient-to-b from-white to-orange-50/40 p-6 shadow-sm flex flex-col items-center gap-2 text-center">
          <p className="text-3xl">📭</p>
          <p className="text-sm font-semibold text-gray-500">Sin registros para esta fecha</p>
          <p className="text-xs text-gray-400">Registrá un ingreso o seleccioná otro día</p>
        </div>
      )}

      {/* ── Donut: todos los ingresos del día ── */}
      {hayDatos && (
        <div className="card p-4">
          <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-3">
            Ingresos del día · {totalVentas} venta{totalVentas !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-4">
            <DonutChart
              segments={segments}
              center={shortBs(d.bs.total).replace(' Bs', '')}
            />
            <div className="flex-1 space-y-2.5 min-w-0">
              {segments.filter(s => s.value > 0).map(seg => (
                <div key={seg.gradId} className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: seg.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-700 leading-tight">{seg.label}</p>
                    <p className="text-[10px] text-gray-400 tabular-nums truncate">{seg.display}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
