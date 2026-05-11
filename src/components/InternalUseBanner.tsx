'use client'
import { useEffect, useState } from 'react'
import { Info, X } from 'lucide-react'

/**
 * Banner informativo descartable. La preferencia "cerrado" se persiste por
 * versión: si querés que vuelva a aparecer (ej. cambió la redacción legal),
 * incrementá `storageVersion` y todos los usuarios lo verán de nuevo.
 */
interface InternalUseBannerProps {
  message: string
  /** Identificador único para esta clase de aviso (no incluye la versión). */
  storageKey?: string
  /** Bump para forzar re-aparición. */
  storageVersion?: number
}

export default function InternalUseBanner({
  message,
  storageKey = 'sazon.banner.disclaimer',
  storageVersion = 1,
}: InternalUseBannerProps) {
  const fullKey = `${storageKey}.v${storageVersion}`

  // Empezamos cerrado en SSR y reabrimos en cliente: evita parpadeo al hidratar.
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const dismissed = window.localStorage.getItem(fullKey) === '1'
      setOpen(!dismissed)
    } catch {
      setOpen(true)
    }
  }, [fullKey])

  if (!mounted || !open) return null

  const dismiss = () => {
    setOpen(false)
    try {
      window.localStorage.setItem(fullKey, '1')
    } catch {
      // localStorage bloqueado (modo incógnito estricto): no es crítico.
    }
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 fade-in-up"
    >
      <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
      <p className="flex-1 text-[12.5px] leading-snug text-amber-900 font-medium">
        {message}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar aviso"
        className="p-1 rounded-lg text-amber-700/70 hover:bg-amber-100 active:scale-90 transition-all shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

/** Texto canónico del disclaimer; mantenelo aquí para que login y dashboard usen la misma fuente. */
export const DISCLAIMER_INTERNO =
  'Este sistema es exclusivamente para control administrativo interno y no posee validez para la emisión de documentos fiscales.'
