'use client'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { OrderMixSummary } from '@/lib/owner/types'

interface Props {
  mix: OrderMixSummary
}

const COLORS = ['#f97316', '#fb923c'] // desayuno, almuerzo

export default function OrderMixChart({ mix }: Props) {
  const data = [
    { name: 'Desayuno', value: mix.totalDesayuno },
    { name: 'Almuerzo', value: mix.totalAlmuerzo },
  ]

  return (
    <div className="card p-4 space-y-5">
      <div>
        <p className="section-title">Distribución de órdenes</p>
        <div className="flex items-center gap-3">
          <div className="w-28 h-28 relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={32}
                  outerRadius={50}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, n: string) => [String(v), n]}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                Total
              </span>
              <span className="text-base font-extrabold text-gray-800">
                {mix.totalDesayuno + mix.totalAlmuerzo}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <Legend label="Desayuno" pct={mix.pctDesayuno} count={mix.totalDesayuno} color={COLORS[0]} />
            <Legend label="Almuerzo" pct={mix.pctAlmuerzo} count={mix.totalAlmuerzo} color={COLORS[1]} />
          </div>
        </div>
      </div>

      <div>
        <p className="section-title">Evolución últimos 14 días</p>
        <div className="h-32 -ml-2">
          <ResponsiveContainer>
            <AreaChart data={mix.evolucion} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <Tooltip
                formatter={(v: number, k: string) => [String(v), k === 'desayuno' ? 'Desayuno' : 'Almuerzo']}
                labelFormatter={(l: string) => l}
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="desayuno"
                stackId="1"
                stroke={COLORS[0]}
                fill={COLORS[0]}
                fillOpacity={0.6}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="almuerzo"
                stackId="1"
                stroke={COLORS[1]}
                fill={COLORS[1]}
                fillOpacity={0.45}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function Legend({
  label,
  pct,
  count,
  color,
}: {
  label: string
  pct: number
  count: number
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span className="text-sm font-bold text-gray-800">
        {pct.toFixed(1)}%{' '}
        <span className="text-[11px] text-gray-400 font-medium">({count})</span>
      </span>
    </div>
  )
}
