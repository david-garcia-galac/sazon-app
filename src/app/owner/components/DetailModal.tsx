'use client'
import { Modal } from '@/components/ui'
import type { OwnerAlert } from '@/lib/owner/types'

interface Props {
  alert: OwnerAlert | null
  onClose: () => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-bold text-gray-800">{value}</span>
    </div>
  )
}

export default function DetailModal({ alert, onClose }: Props) {
  return (
    <Modal open={!!alert} onClose={onClose} title={alert?.title ?? 'Detalle'}>
      {alert && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">{alert.detail}</p>
          {alert.context && (
            <div className="card p-3 bg-gray-50">
              {Object.entries(alert.context).map(([k, v]) => (
                <Field
                  key={k}
                  label={k}
                  value={
                    typeof v === 'number'
                      ? Number.isInteger(v)
                        ? String(v)
                        : v.toFixed(2)
                      : String(v)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
