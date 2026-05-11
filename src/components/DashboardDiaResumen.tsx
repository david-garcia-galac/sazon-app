'use client'

import type { ReactNode } from 'react'
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

type IngresoTab = 'bs' | 'usd' | 'conc'

type BarItem = {
  label: string
  short: string
  raw: number
  display: string
  tone: string
  fill: string
}

function fmtDiaTitulo(iso: string): string {
  const [y, m, day] = iso.split('-').map(Number)
  if (!y || !m || !day) return iso
  const d = new Date(y, m - 1, day)
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })
}

function Bars({ items, footnote }: { items: BarItem[]; footnote: ReactNode }) {
  const allZero = items.every(i => i.raw === 0)
  const max = Math.max(...items.map(i => i.raw), 1e-6)
  const W = 320
  const H = 124
  const padL = 6
  const padR = 6
  const padT = 8
  const padB = 36
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const n = items.length
  const gap = 6
  const barW = (innerW - gap * (n - 1)) / n

  if (allZero) {
    return (
      <div className="rounded-2xl border border-orange-100 bg-gradient-to-b from-white to-orange-50/40 p-6 shadow-sm flex flex-col items-center gap-2 text-center">
        <p className="text-3xl">📭</p>
        <p className="text-sm font-semibold text-gray-500">Sin registros para esta fecha</p>
        <p className="text-xs text-gray-400">Registrá un ingreso o seleccioná otro día</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-orange-100 bg-gradient-to-b from-white to-orange-50/40 p-3 shadow-sm">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto max-h-40"
        role="img"
        aria-label="Resumen del día en barras"
      >
        {items.map((it, i) => {
          const x = padL + i * (barW + gap)
          const h = innerH * (it.raw / max)
          const y = padT + innerH - h
          const shortLbl = it.display.length > 12 ? `${it.display.slice(0, 11)}…` : it.display
          return (
            <g key={it.short}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 0)}
                rx={6}
                className={it.fill}
              />
              <text
                x={x + barW / 2}
                y={H - 10}
                textAnchor="middle"
                className="fill-gray-600"
                style={{ fontSize: '9px', fontWeight: 600 }}
              >
                {it.short}
              </text>
              {it.raw > 0 && h > 14 && (
                <text
                  x={x + barW / 2}
                  y={y + h / 2 + 3}
                  textAnchor="middle"
                  className="fill-white"
                  style={{ fontSize: '7.5px', fontWeight: 700 }}
                >
                  {shortLbl}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <ul className="mt-2 space-y-1.5 text-xs border-t border-orange-100/80 pt-2">
        {items.map(it => (
          <li key={it.short} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0 text-gray-600">
              <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${it.tone}`} />
              <span className="truncate">{it.label}</span>
            </span>
            <span className="font-semibold text-brand-brown whitespace-nowrap tabular-nums">
              {it.display}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-xs text-gray-500">{footnote}</div>
    </div>
  )
}

export function DashboardDiaResumen({
  fechaValue,
  onFechaChange,
  ingTab,
  detalle,
  agg,
}: {
  fechaValue: string
  onFechaChange: (iso: string) => void
  ingTab: IngresoTab
  detalle: PeriodoDetalleIngresos
  agg: DiaAgg
}) {
  const cap = hoyFn()
  const esHoy = fechaValue === cap
  const d = detalle

  let chartBody: React.ReactNode
  let lineaVentasSaldo: React.ReactNode

  if (ingTab === 'bs') {
    lineaVentasSaldo = (
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
        <span>
          <strong className="text-brand-brown">Ventas (Bs)</strong>{' '}
          <span className="tabular-nums font-semibold">{d.bs.ventas}</span>
        </span>
        {(d.usd.ventas > 0 || d.usd.totalUsd > 0) && (
          <span>
            <strong className="text-emerald-700">USD efectivo</strong>{' '}
            <span className="tabular-nums font-semibold">{formatUSD(d.usd.totalUsd)}</span>
            <span className="text-gray-500"> ({d.usd.ventas} venta{d.usd.ventas === 1 ? '' : 's'})</span>
          </span>
        )}
        <span>
          <strong className="text-green-700">Bolívares cobrados (Bs)</strong>{' '}
          <span className="tabular-nums">{formatBs(d.bs.total)}</span>
        </span>
        <span>
          <strong className={agg.saldo >= 0 ? 'text-green-700' : 'text-red-700'}>Saldo</strong>{' '}
          <span className="tabular-nums">{formatBs(agg.saldo)}</span>
        </span>
      </div>
    )
    chartBody = (
      <Bars
        items={[
          {
            label: 'Efectivo Bs',
            short: 'Efect.',
            raw: d.bs.efectivo,
            display: formatBs(d.bs.efectivo),
            tone: 'bg-amber-400',
            fill: 'fill-amber-400',
          },
          {
            label: 'Pago móvil',
            short: 'P.móv.',
            raw: d.bs.pago_movil,
            display: formatBs(d.bs.pago_movil),
            tone: 'bg-orange-500',
            fill: 'fill-orange-500',
          },
          {
            label: 'Transferencia',
            short: 'Transf.',
            raw: d.bs.transferencia,
            display: formatBs(d.bs.transferencia),
            tone: 'bg-amber-800',
            fill: 'fill-amber-800',
          },
          {
            label: 'USD efectivo (equiv. Bs)',
            short: '$→Bs',
            raw: d.usd.equivBs,
            display: formatBs(d.usd.equivBs),
            tone: 'bg-emerald-500',
            fill: 'fill-emerald-600',
          },
          {
            label: 'Egresos (Bs)',
            short: 'Egres.',
            raw: agg.egresos,
            display: formatBs(agg.egresos),
            tone: 'bg-red-400',
            fill: 'fill-red-400',
          },
        ]}
        footnote={<p>Ingresos: bolívares por forma de pago, equivalente del efectivo USD y egresos del día.</p>}
      />
    )
  } else if (ingTab === 'usd') {
    lineaVentasSaldo = (
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
        <span>
          <strong className="text-emerald-700">Efectivo USD</strong>{' '}
          <span className="tabular-nums font-semibold">{formatUSD(d.usd.totalUsd)}</span>
        </span>
        <span>
          <strong className="text-brand-brown">Ventas USD</strong>{' '}
          <span className="tabular-nums font-semibold">{d.usd.ventas}</span>
        </span>
        <span>
          <strong className="text-green-700">Saldo (Bs equiv.)</strong>{' '}
          <span className="tabular-nums">{formatBs(agg.saldo)}</span>
        </span>
      </div>
    )
    chartBody = (
      <Bars
        items={[
          {
            label: 'Equiv. registrado en Bs',
            short: 'Equiv.Bs',
            raw: d.usd.equivBs,
            display: formatBs(d.usd.equivBs),
            tone: 'bg-orange-500',
            fill: 'fill-orange-500',
          },
          {
            label: 'Egresos (Bs)',
            short: 'Egres.',
            raw: agg.egresos,
            display: formatBs(agg.egresos),
            tone: 'bg-red-400',
            fill: 'fill-red-400',
          },
        ]}
        footnote={<p>Barras en bolívares: equivalente registrado por ventas USD y egresos. El total USD figura arriba.</p>}
      />
    )
  } else {
    lineaVentasSaldo = (
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
        <span>
          <strong className="text-brand-brown">Movimientos</strong>{' '}
          <span className="tabular-nums font-semibold">{d.conciliacion.ventasTotal}</span>
        </span>
        <span>
          <strong className="text-green-900">USD efectivo</strong>{' '}
          <span className="tabular-nums">{formatUSD(d.conciliacion.totalDivisaUsd)}</span>
        </span>
        <span>
          <strong className={agg.saldo >= 0 ? 'text-green-700' : 'text-red-700'}>Saldo (Bs equiv.)</strong>{' '}
          <span className="tabular-nums">{formatBs(agg.saldo)}</span>
        </span>
      </div>
    )
    chartBody = (
      <Bars
        items={[
          {
            label: 'Ingresos en bolívares',
            short: 'Bs cobr.',
            raw: d.conciliacion.ingresosBolivares,
            display: formatBs(d.conciliacion.ingresosBolivares),
            tone: 'bg-amber-400',
            fill: 'fill-amber-500',
          },
          {
            label: 'Dólares en Bs (equiv.)',
            short: '$→Bs',
            raw: d.conciliacion.bolivaresEquivUsd,
            display: formatBs(d.conciliacion.bolivaresEquivUsd),
            tone: 'bg-orange-500',
            fill: 'fill-orange-500',
          },
          {
            label: 'Total unificado (Bs)',
            short: 'Total',
            raw: d.conciliacion.totalBolivares,
            display: formatBs(d.conciliacion.totalBolivares),
            tone: 'bg-green-600',
            fill: 'fill-green-600',
          },
          {
            label: 'Egresos (Bs)',
            short: 'Egres.',
            raw: agg.egresos,
            display: formatBs(agg.egresos),
            tone: 'bg-red-400',
            fill: 'fill-red-400',
          },
        ]}
        footnote={<p>Conciliación del día: bolívares cobrados, equivalente USD en Bs y total frente a egresos.</p>}
      />
    )
  }

  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="section-title mb-0">
          📅 {esHoy ? 'Hoy' : 'Día'} — <span className="capitalize font-semibold">{fmtDiaTitulo(fechaValue)}</span>
        </h2>
        <label className="flex flex-col gap-0.5 text-xs text-gray-600 shrink-0">
          <span className="font-medium text-brand-brown">Fecha</span>
          <input
            type="date"
            max={cap}
            value={fechaValue}
            onChange={e => onFechaChange(e.target.value)}
            className="rounded-xl border-2 border-orange-200 px-2 py-1.5 text-sm text-brand-brown bg-white shadow-sm"
          />
        </label>
      </div>

      <div className="mt-3">{chartBody}</div>
      {lineaVentasSaldo}
    </section>
  )
}
