/**
 * Utilidades de WhatsApp:
 *  - Normalización/validación del número (código país + número).
 *  - Construcción del deep link `wa.me/...` con mensaje y URL del PDF.
 *
 * El envío real (Cloud API) vive en /api/whatsapp/route.ts. Estas utilidades
 * son seguras de usar en cliente y servidor (no usan window).
 */

export interface PhoneCheck {
  ok: boolean
  e164: string // p.ej. "584141234567" (sin "+")
  error?: string
}

/**
 * Valida y normaliza un número en formato E.164 (sin el "+").
 * Acepta `+58414...`, `0058414...`, `58 414 ...`, `(0414) ...`, etc.
 * No conoce planes de numeración por país; solo asegura que queden 7..15 dígitos.
 */
export function normalizePhone(input: string): PhoneCheck {
  const raw = String(input ?? '').trim()
  if (!raw) return { ok: false, e164: '', error: 'Indicá el número' }

  // Quita todo lo que no sea dígito ni "+" para detectar el "00" de prefijo internacional.
  let s = raw.replace(/[^\d+]/g, '')
  if (s.startsWith('+')) s = s.slice(1)
  else if (s.startsWith('00')) s = s.slice(2)

  // Solo dígitos.
  s = s.replace(/\D/g, '')

  if (s.length < 7) return { ok: false, e164: '', error: 'Número demasiado corto' }
  if (s.length > 15) return { ok: false, e164: '', error: 'Número demasiado largo' }

  return { ok: true, e164: s }
}

/**
 * Arma la URL `https://wa.me/<e164>?text=<msg>`.
 * Si el mensaje incluye un URL del PDF, WhatsApp muestra preview con descarga.
 */
export function buildWaMeUrl(opts: {
  phoneE164: string
  message: string
  pdfUrl?: string
}): string {
  const { phoneE164, message, pdfUrl } = opts
  const parts = [message?.trim() || '', pdfUrl?.trim() || ''].filter(Boolean)
  const text = parts.join('\n\n')
  return `https://wa.me/${phoneE164}?text=${encodeURIComponent(text)}`
}
