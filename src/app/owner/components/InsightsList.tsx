'use client'
import { Lightbulb } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { OwnerInsight } from '@/lib/owner/types'

interface Props {
  insights: OwnerInsight[]
}

export default function InsightsList({ insights }: Props) {
  const router = useRouter()
  if (!insights.length) return null

  const onAction = (id: string) => {
    if (id === 'reporte-semanal') router.push('/reportes')
  }

  return (
    <div className="card p-4">
      <p className="section-title">Sugerencias accionables</p>
      <ul className="space-y-3">
        {insights.map((i) => (
          <li key={i.id} className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
              <Lightbulb size={16} className="text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-800 leading-tight">
                {i.title}
              </p>
              <p className="text-[11.5px] text-gray-600 mt-1 leading-snug">
                {i.body}
              </p>
              {i.actionLabel && (
                <button
                  type="button"
                  onClick={() => onAction(i.id)}
                  className="text-[11px] font-bold text-orange-600 mt-1.5 active:opacity-70"
                >
                  {i.actionLabel} →
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
