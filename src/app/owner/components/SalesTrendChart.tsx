'use client'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SalesTrendPoint, WeekCompareSeries } from '@/lib/owner/types'

interface Props {
  trend: SalesTrendPoint[]
  compare: WeekCompareSeries[]
}

function compactBs(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

export default function SalesTrendChart({ trend, compare }: Props) {
  return (
    <div className="card p-4 space-y-5">
      <div>
        <p className="section-title">Ventas últimos 30 días</p>
        <div className="h-44 -ml-2">
          <ResponsiveContainer>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis
                dataKey="fecha"
                tickFormatter={(v: string) => v.slice(5)}
                fontSize={10}
                stroke="#9ca3af"
                interval={4}
              />
              <YAxis fontSize={10} stroke="#9ca3af" tickFormatter={compactBs} width={45} />
              <Tooltip
                formatter={(v: number) => [`Bs ${Number(v).toFixed(0)}`, 'Total']}
                labelFormatter={(l: string) => `Fecha: ${l}`}
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="section-title">Semana actual vs anterior</p>
        <div className="h-40 -ml-2">
          <ResponsiveContainer>
            <LineChart data={compare} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="diaLabel" fontSize={11} stroke="#9ca3af" />
              <YAxis fontSize={10} stroke="#9ca3af" tickFormatter={compactBs} width={45} />
              <Tooltip
                formatter={(v: number) => `Bs ${Number(v).toFixed(0)}`}
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="estaSemana"
                name="Esta semana"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="semanaAnterior"
                name="Semana anterior"
                stroke="#9ca3af"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-orange-500 rounded-full" /> Esta semana
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-gray-400 rounded-full" /> Semana anterior
          </span>
        </div>
      </div>
    </div>
  )
}
