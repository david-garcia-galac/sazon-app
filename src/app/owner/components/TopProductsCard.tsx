'use client'
import { useState } from 'react'
import { Coffee, UtensilsCrossed, BarChart3 } from 'lucide-react'
import type { TopProduct } from '@/lib/owner/types'

interface Props {
  topDesayuno: TopProduct[]
  topAlmuerzo: TopProduct[]
  topMargen: TopProduct[]
}

type Tab = 'desayuno' | 'almuerzo' | 'margen'

export default function TopProductsCard({ topDesayuno, topAlmuerzo, topMargen }: Props) {
  const [tab, setTab] = useState<Tab>('desayuno')

  const list =
    tab === 'desayuno' ? topDesayuno : tab === 'almuerzo' ? topAlmuerzo : topMargen
  const isMargen = tab === 'margen'
  const maxBar = Math.max(1, ...list.map((p) => (isMargen ? p.margenIndex : p.pctOrdenes)))

  const btn = (active: boolean) =>
    `flex-1 py-2 px-2 text-[11px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
      active ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
    }`

  return (
    <div className="card p-4">
      <p className="section-title">Top productos</p>
      <div className="flex gap-1.5 mb-3">
        <button type="button" className={btn(tab === 'desayuno')} onClick={() => setTab('desayuno')}>
          <Coffee size={12} /> Desayuno
        </button>
        <button type="button" className={btn(tab === 'almuerzo')} onClick={() => setTab('almuerzo')}>
          <UtensilsCrossed size={12} /> Almuerzo
        </button>
        <button type="button" className={btn(tab === 'margen')} onClick={() => setTab('margen')}>
          <BarChart3 size={12} /> Margen
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">Sin datos en el rango.</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((p, i) => {
            const v = isMargen ? p.margenIndex : p.pctOrdenes
            return (
              <li key={`${p.nombre}-${i}`} className="text-[13px]">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="font-semibold text-gray-800 truncate">
                    <span className="text-gray-400 mr-1">{i + 1}.</span>
                    {p.nombre}
                  </span>
                  <span className="font-bold text-orange-600 shrink-0">
                    {v.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-orange-400 rounded-full"
                    style={{ width: `${Math.min(100, (v / maxBar) * 100)}%` }}
                  />
                </div>
                <p className="text-[10.5px] text-gray-400 mt-0.5">
                  {p.ordenes} órdenes · Bs{' '}
                  {new Intl.NumberFormat('es-VE', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(p.ingresoBs)}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
