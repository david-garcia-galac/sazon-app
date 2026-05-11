'use client'
import { useMemo } from 'react'
import { DIAS_SEMANA, type HeatmapCell } from '@/lib/owner/types'

interface Props {
  cells: HeatmapCell[]
}

/**
 * Heatmap propio (sin lib): grilla 7×11 (Lun..Dom × 06..16) con escala naranja.
 * Lib de heatmap externa pesa demasiado para un solo gráfico.
 */
export default function HourlyHeatmap({ cells }: Props) {
  const horas = useMemo(() => {
    const set = new Set<number>()
    for (const c of cells) set.add(c.hora)
    return Array.from(set).sort((a, b) => a - b)
  }, [cells])

  const get = (dow: number, hora: number) =>
    cells.find((c) => c.diaSemana === dow && c.hora === hora)

  const colorFor = (i: number) => {
    if (i <= 0) return '#f3f4f6'
    // Escala perceptual entre #fde7d3 y #c2410c
    const c1 = [253, 231, 211]
    const c2 = [194, 65, 12]
    const t = Math.min(1, i)
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t)
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t)
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t)
    return `rgb(${r},${g},${b})`
  }

  return (
    <div className="card p-4">
      <p className="section-title">Calor de ventas (día × hora)</p>
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="text-[10px] border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th className="text-left text-gray-400 font-medium pr-1.5"></th>
              {horas.map((h) => (
                <th key={h} className="text-gray-400 font-semibold w-8">
                  {h}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIAS_SEMANA.map((d, dow) => (
              <tr key={d}>
                <td className="text-gray-500 font-semibold pr-2 whitespace-nowrap">{d}</td>
                {horas.map((h) => {
                  const c = get(dow, h)
                  const intensity = c?.intensidad ?? 0
                  return (
                    <td key={h}>
                      <div
                        title={`${d} ${h}:00 → ${c?.ordenes ?? 0} órdenes · Bs ${Math.round(c?.ingresoBs ?? 0).toLocaleString('es-VE')}`}
                        className="w-8 h-7 rounded-md border border-black/5"
                        style={{ background: colorFor(intensity) }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
        <span>Menos</span>
        <div className="flex">
          {[0.1, 0.25, 0.4, 0.6, 0.8, 1].map((i) => (
            <span
              key={i}
              className="w-4 h-3 first:rounded-l-md last:rounded-r-md border border-black/5"
              style={{ background: colorFor(i) }}
            />
          ))}
        </div>
        <span>Más</span>
      </div>
    </div>
  )
}
