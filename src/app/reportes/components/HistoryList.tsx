'use client'
import { ExternalLink, Trash2 } from 'lucide-react'
import { REPORT_TYPE_LABELS, type ReportHistoryItem } from '@/lib/reportes/types'

interface Props {
  items: ReportHistoryItem[]
  onRemove: (id: string) => void
}

export default function HistoryList({ items, onRemove }: Props) {
  if (!items.length) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Todavía no enviaste reportes.</p>
      </div>
    )
  }
  return (
    <div className="card p-2">
      <ul className="divide-y divide-gray-100">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-2 px-2 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">
                {REPORT_TYPE_LABELS[it.config.type]}{' '}
                <span className="text-gray-400 font-normal">
                  · {it.config.desde}
                  {it.config.desde !== it.config.hasta ? ` → ${it.config.hasta}` : ''}
                </span>
              </p>
              <p className="text-xs text-gray-500 truncate">
                {new Date(it.createdAt).toLocaleString('es-VE')}
                {it.phone && <> · 📱 +{it.phone}</>}
              </p>
              {it.url && (
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-orange-600 font-semibold mt-1 active:opacity-70"
                >
                  Ver PDF <ExternalLink size={11} />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(it.id)}
              aria-label="Eliminar del historial"
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
