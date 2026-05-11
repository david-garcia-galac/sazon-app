'use client'
import { AlertTriangle, Info, AlertOctagon, ChevronRight } from 'lucide-react'
import type { OwnerAlert } from '@/lib/owner/types'

interface Props {
  alerts: OwnerAlert[]
  onSeeDetail: (alert: OwnerAlert) => void
}

const SEVERITY_STYLE: Record<
  OwnerAlert['severity'],
  { wrap: string; pill: string; Icon: typeof AlertTriangle }
> = {
  info: {
    wrap: 'bg-blue-50 border-blue-100',
    pill: 'text-blue-600',
    Icon: Info,
  },
  warning: {
    wrap: 'bg-amber-50 border-amber-100',
    pill: 'text-amber-700',
    Icon: AlertTriangle,
  },
  critical: {
    wrap: 'bg-red-50 border-red-100',
    pill: 'text-red-700',
    Icon: AlertOctagon,
  },
}

export default function AlertsList({ alerts, onSeeDetail }: Props) {
  if (!alerts.length) {
    return (
      <div className="card p-4">
        <p className="section-title">Alertas</p>
        <p className="text-sm text-gray-400">Sin alertas activas. Todo bajo control ✓</p>
      </div>
    )
  }
  return (
    <div className="card p-4">
      <p className="section-title">Alertas activas ({alerts.length})</p>
      <ul className="space-y-2.5">
        {alerts.map((a) => {
          const s = SEVERITY_STYLE[a.severity]
          return (
            <li
              key={a.id}
              className={`rounded-2xl border ${s.wrap} p-3 flex items-start gap-2.5`}
            >
              <s.Icon size={16} className={`${s.pill} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-800 leading-tight">
                  {a.title}
                </p>
                <p className="text-[11.5px] text-gray-600 mt-1 leading-snug">
                  {a.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSeeDetail(a)}
                className="text-[11px] font-bold text-orange-600 inline-flex items-center gap-0.5 shrink-0 active:opacity-70"
              >
                Detalle <ChevronRight size={12} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
