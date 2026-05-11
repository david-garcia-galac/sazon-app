'use client'
import { useMemo, useState } from 'react'
import { Send, Loader2, Phone, MessageSquare } from 'lucide-react'
import { buildReportPdf } from '@/lib/reportes/pdf'
import { addHistory } from '@/lib/reportes/history'
import {
  REPORT_RANGE_LABELS,
  REPORT_TYPE_LABELS,
  type ReportData,
  type ReportHistoryItem,
} from '@/lib/reportes/types'
import { normalizePhone, buildWaMeUrl } from '@/lib/reportes/whatsapp'

interface Props {
  data: ReportData
  onSent?: (item: ReportHistoryItem) => void
  onShowToast: (msg: string, type?: 'success' | 'error') => void
}

type Phase = 'idle' | 'building' | 'uploading' | 'sending' | 'done'

export default function WhatsAppSender({ data, onSent, onShowToast }: Props) {
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(
    `📊 Reporte ${REPORT_TYPE_LABELS[data.config.type]} ` +
      `(${REPORT_RANGE_LABELS[data.config.range]}) — ` +
      `${data.config.desde === data.config.hasta ? data.config.desde : `${data.config.desde} → ${data.config.hasta}`}`
  )
  const [phase, setPhase] = useState<Phase>('idle')

  const phoneCheck = useMemo(() => normalizePhone(phone), [phone])
  const busy = phase !== 'idle' && phase !== 'done'

  const send = async () => {
    if (!phoneCheck.ok) {
      onShowToast(phoneCheck.error ?? 'Teléfono inválido', 'error')
      return
    }

    try {
      // 1) Construimos el PDF en el cliente
      setPhase('building')
      const { blob, filename } = buildReportPdf(data)

      // 2) Subimos el PDF a Cloudinary
      setPhase('uploading')
      const form = new FormData()
      form.append('file', new File([blob], filename, { type: 'application/pdf' }))
      form.append('filename', filename)
      const upRes = await fetch('/api/reportes/upload', {
        method: 'POST',
        body: form,
        cache: 'no-store',
      })
      const upJson = (await upRes.json().catch(() => ({}))) as {
        url?: string
        error?: string
      }
      if (!upRes.ok || !upJson.url) {
        throw new Error(upJson.error ?? 'No se pudo subir el PDF')
      }
      const pdfUrl = upJson.url

      // 3) Pedimos al backend que envíe (si hay creds) o nos devuelva el deep link
      setPhase('sending')
      const sendRes = await fetch('/api/whatsapp', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneCheck.e164,
          message,
          pdfUrl,
          filename,
        }),
      })
      const sendJson = (await sendRes.json().catch(() => ({}))) as {
        ok?: boolean
        fallback?: string
        walink?: string
        textId?: string
        docId?: string
        error?: string
        docError?: string
      }

      // 4) Persistimos al historial
      const histItem: ReportHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        config: data.config,
        filename,
        url: pdfUrl,
        phone: phoneCheck.e164,
        message,
      }
      addHistory(histItem)
      onSent?.(histItem)

      // 5) Decidimos el siguiente paso visible
      if (sendJson.ok) {
        onShowToast('Reporte enviado por WhatsApp ✓')
        if (sendJson.docError) {
          onShowToast(
            `Texto enviado, documento falló: ${sendJson.docError}`,
            'error'
          )
        }
      } else if (sendJson.fallback === 'walink' && sendJson.walink) {
        window.open(sendJson.walink, '_blank', 'noopener,noreferrer')
        onShowToast('Abriendo WhatsApp con el link al PDF ✓')
      } else {
        // Último recurso: armamos el wa.me localmente.
        const walink = buildWaMeUrl({
          phoneE164: phoneCheck.e164,
          message,
          pdfUrl,
        })
        window.open(walink, '_blank', 'noopener,noreferrer')
        onShowToast(sendJson.error ?? 'Abriendo WhatsApp', 'error')
      }

      setPhase('done')
      setTimeout(() => setPhase('idle'), 800)
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Error al enviar', 'error')
      setPhase('idle')
    }
  }

  const btnLabel: Record<Phase, string> = {
    idle: 'Enviar por WhatsApp',
    building: 'Generando PDF…',
    uploading: 'Subiendo PDF…',
    sending: 'Enviando…',
    done: 'Listo ✓',
  }

  return (
    <div className="card p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Phone size={15} className="text-orange-500" />
          <label className="label mb-0">Número con código de país</label>
        </div>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+58 414 1234567"
          className="input-field"
        />
        {phone && !phoneCheck.ok && (
          <p className="text-xs text-red-500 mt-1.5">{phoneCheck.error}</p>
        )}
        {phone && phoneCheck.ok && (
          <p className="text-xs text-gray-400 mt-1.5">→ {phoneCheck.e164}</p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <MessageSquare size={15} className="text-orange-500" />
          <label className="label mb-0">Mensaje (opcional)</label>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="input-field resize-none"
          placeholder="Hola Amparo, te paso el reporte del día…"
        />
      </div>

      <button
        type="button"
        onClick={send}
        disabled={busy || !phoneCheck.ok}
        className="btn-primary w-full py-4 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Send size={18} />
        )}
        {btnLabel[phase]}
      </button>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Si no hay credenciales de WhatsApp Cloud API configuradas, se abrirá tu
        WhatsApp con el chat de ese número y el link al PDF listo para enviar.
      </p>
    </div>
  )
}
