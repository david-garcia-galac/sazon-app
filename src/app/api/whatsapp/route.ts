/**
 * Envío de mensajes por WhatsApp.
 *
 * Modos de operación:
 *
 *  1. Cloud API oficial (producción): si están seteadas
 *       WHATSAPP_PHONE_NUMBER_ID  (ID del número emisor, p.ej. "1234567890")
 *       WHATSAPP_TOKEN            (Bearer token de Meta)
 *     entonces este endpoint POSTea a graph.facebook.com y manda
 *     un mensaje de texto + (opcional) un mensaje tipo "document" con el PDF.
 *
 *  2. Modo dev / sin token configurado: devuelve {ok:false, fallback:'walink'}
 *     y el cliente abre wa.me con el mensaje + link al PDF.
 *
 * Importante:
 *  - Para que la Cloud API entregue al destinatario por primera vez (fuera de la
 *    ventana de 24 h), Meta exige usar una *template* aprobada. En este endpoint
 *    intentamos un mensaje de texto: si Meta lo rechaza, devolvemos el error tal
 *    cual para que el usuario sepa qué pasó, y el front cae a wa.me automáticamente.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logDbFail, logDbOk } from '@/lib/logger'
import { normalizePhone, buildWaMeUrl } from '@/lib/reportes/whatsapp'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
}

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { ...NO_STORE, ...(init?.headers ?? {}) },
  })
}

interface SendBody {
  phone: string
  message: string
  pdfUrl?: string
  filename?: string
}

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number }
}

interface SendResult {
  ok: boolean
  messageId?: string
  error?: string
}

async function postGraph(payload: Record<string, unknown>): Promise<SendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  if (!phoneNumberId || !token) return { ok: false, error: 'missing_credentials' }

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphErrorBody
    return { ok: false, error: body.error?.message ?? `HTTP ${res.status}` }
  }

  const data = (await res.json()) as { messages?: Array<{ id: string }> }
  return { ok: true, messageId: data.messages?.[0]?.id ?? '' }
}

function sendCloudApiText(phone: string, text: string): Promise<SendResult> {
  return postGraph({
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { preview_url: true, body: text },
  })
}

function sendCloudApiDocument(
  phone: string,
  pdfUrl: string,
  filename: string,
  caption?: string
): Promise<SendResult> {
  return postGraph({
    messaging_product: 'whatsapp',
    to: phone,
    type: 'document',
    document: {
      link: pdfUrl,
      filename,
      caption: caption?.slice(0, 1024),
    },
  })
}

export async function POST(req: NextRequest) {
  let body: SendBody
  try {
    body = (await req.json()) as SendBody
  } catch {
    return jsonNoStore({ error: 'JSON inválido' }, { status: 400 })
  }

  const check = normalizePhone(body.phone ?? '')
  if (!check.ok) {
    logDbFail('whatsapp', 'send', new Error(check.error ?? 'phone inválido'), {
      phone: body.phone,
    })
    return jsonNoStore({ error: check.error ?? 'Teléfono inválido' }, { status: 400 })
  }

  const message = (body.message ?? '').toString().slice(0, 4000)
  const pdfUrl = typeof body.pdfUrl === 'string' ? body.pdfUrl : undefined
  const filename = typeof body.filename === 'string' ? body.filename : 'reporte.pdf'

  const hasCreds = !!process.env.WHATSAPP_PHONE_NUMBER_ID && !!process.env.WHATSAPP_TOKEN

  // Modo dev / sin credenciales → fallback a deep link.
  if (!hasCreds) {
    const walink = buildWaMeUrl({ phoneE164: check.e164, message, pdfUrl })
    logDbOk('whatsapp', 'send.fallback-walink', {
      phone: check.e164,
      hasPdf: !!pdfUrl,
    })
    return jsonNoStore({ ok: false, fallback: 'walink', walink })
  }

  // Cloud API real: primero texto (con preview del link), luego documento si hay PDF.
  const textResult = await sendCloudApiText(
    check.e164,
    [message, pdfUrl].filter(Boolean).join('\n\n')
  )

  if (!textResult.ok) {
    logDbFail('whatsapp', 'send.text', new Error(textResult.error ?? 'text fail'), {
      phone: check.e164,
    })
    const walink = buildWaMeUrl({ phoneE164: check.e164, message, pdfUrl })
    return jsonNoStore({
      ok: false,
      fallback: 'walink',
      walink,
      error: textResult.error,
    })
  }

  let docResult: SendResult | null = null
  if (pdfUrl) {
    docResult = await sendCloudApiDocument(check.e164, pdfUrl, filename, message)
    if (!docResult.ok) {
      logDbFail('whatsapp', 'send.document', new Error(docResult.error ?? 'doc fail'), {
        phone: check.e164,
        pdfUrl,
      })
    }
  }

  logDbOk('whatsapp', 'send', {
    phone: check.e164,
    textId: textResult.messageId,
    docId: docResult?.ok ? docResult.messageId : undefined,
    docError: docResult && !docResult.ok ? docResult.error : undefined,
  })

  return jsonNoStore({
    ok: true,
    textId: textResult.messageId,
    docId: docResult?.ok ? docResult.messageId : undefined,
    docError: docResult && !docResult.ok ? docResult.error : undefined,
  })
}
