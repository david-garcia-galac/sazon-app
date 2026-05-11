'use client'
import type { OwnerRange, RangeKey } from '@/lib/owner/types'

interface Props {
  value: OwnerRange
  onChange: (r: OwnerRange) => void
  today: string
}

const OPTS: { key: RangeKey; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'personalizado', label: 'Personalizado' },
]

export default function RangeSelector({ value, onChange, today }: Props) {
  const select = (key: RangeKey) => {
    if (key === 'personalizado') {
      onChange({ ...value, key })
      return
    }
    onChange({ ...value, key })
  }

  return (
    <div className="card p-3 space-y-3">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {OPTS.map((o) => {
          const active = value.key === o.key
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => select(o.key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                active
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {value.key === 'personalizado' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            max={today}
            value={value.desde}
            onChange={(e) =>
              onChange({
                ...value,
                desde: e.target.value,
                hasta: value.hasta < e.target.value ? e.target.value : value.hasta,
              })
            }
            className="input-field text-sm"
          />
          <input
            type="date"
            max={today}
            value={value.hasta}
            onChange={(e) =>
              onChange({
                ...value,
                hasta: e.target.value,
                desde: value.desde > e.target.value ? e.target.value : value.desde,
              })
            }
            className="input-field text-sm"
          />
        </div>
      )}
    </div>
  )
}
