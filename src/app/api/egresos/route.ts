import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureEgresosTable } from '@/lib/db'
import { logDbFail, logDbOk } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
}

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) },
  })
}

function badRequest(error: string) {
  return jsonNoStore({ error }, { status: 400 })
}

type EgresoRow = {
  fecha: string
  categoria: string
  proveedor: string | null
  descripcion: string | null
  monto: number
  moneda: string
  tasa: number | null
  monto_bs: number | null
  forma_pago: string
  foto_url: string | null
  foto_public_id: string | null
  proveedor_id: string | null
}

function str(v: unknown, max = 2000): string | null {
  if (v == null) return null
  const s = typeof v === 'string' ? v.trim() : String(v).trim()
  return s.length ? s.slice(0, max) : null
}

function normalize(body: Record<string, unknown>): NextResponse | { id: string; row: EgresoRow } {
  const id = body.id != null ? String(body.id) : ''
  if (!id) return badRequest('ID requerido')

  const fechaRaw = str(body.fecha, 40)
  // Acepta "YYYY-MM-DD" o ISO timestamp completo "YYYY-MM-DDTHH:..."
  const fechaMatch = fechaRaw?.match(/^(\d{4}-\d{2}-\d{2})/)
  const fecha = fechaMatch?.[1] ?? null
  if (!fecha) return badRequest('Fecha no válida')

  const categoria = str(body.categoria, 128)
  if (!categoria) return badRequest('Categoría requerida')

  const monto = Number(body.monto)
  if (!Number.isFinite(monto) || monto <= 0) return badRequest('Monto no válido')

  const moneda = body.moneda === 'USD' ? 'USD' : 'BS'

  let monto_bs: number | null = null
  let tasa: number | null = null
  if (moneda === 'USD') {
    tasa = Number(body.tasa)
    const bsComputed = Number(body.monto_bs)
    if (!Number.isFinite(tasa) || tasa <= 0) return badRequest('Indicá la tasa (Bs/USD)')
    monto_bs = Number.isFinite(bsComputed) && bsComputed > 0 ? bsComputed : monto * tasa
    if (!Number.isFinite(monto_bs) || monto_bs <= 0)
      return badRequest('Equivalente en Bs no válido')
  } else {
    monto_bs = monto
  }

  const forma = str(body.forma_pago, 64)?.toLowerCase() ?? ''
  const allowedFp = ['efectivo', 'pago_movil', 'transferencia']
  if (!allowedFp.includes(forma)) return badRequest('Forma de pago no válida')

  return {
    id,
    row: {
      fecha,
      categoria,
      proveedor: str(body.proveedor, 512),
      descripcion: str(body.descripcion, 2048),
      monto,
      moneda,
      tasa,
      monto_bs,
      forma_pago: forma,
      foto_url: str(body.foto_url, 2048),
      foto_public_id: str(body.foto_public_id, 512),
      proveedor_id: str(body.proveedor_id, 128),
    },
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  try {
    await ensureEgresosTable()

    const rows =
      desde && hasta
        ? await sql`
            SELECT *
            FROM egresos
            WHERE fecha >= ${desde}
              AND fecha <= ${hasta}
            ORDER BY created_at DESC
          `
        : await sql`
            SELECT *
            FROM egresos
            ORDER BY created_at DESC
            LIMIT 100
          `
    const out = Array.isArray(rows) ? rows : []
    logDbOk('egresos', 'get', { desde, hasta, count: out.length })
    return jsonNoStore(rows)
  } catch (e: any) {
    logDbFail('egresos', 'get', e, { desde, hasta })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>

  await ensureEgresosTable()

  const n = normalize(body)
  if (n instanceof NextResponse) {
    logDbFail('egresos', 'post.validation', new Error('payload inválido'), {
      id: body.id,
    })
    return n
  }

  const { id, row } = n
  try {
    await sql`
      INSERT INTO egresos (
        id,
        fecha,
        categoria,
        proveedor,
        descripcion,
        monto,
        moneda,
        tasa,
        monto_bs,
        forma_pago,
        foto_url,
        foto_public_id,
        proveedor_id
      )
      VALUES (
        ${id},
        ${row.fecha},
        ${row.categoria},
        ${row.proveedor},
        ${row.descripcion},
        ${row.monto},
        ${row.moneda},
        ${row.tasa},
        ${row.monto_bs},
        ${row.forma_pago},
        ${row.foto_url},
        ${row.foto_public_id},
        ${row.proveedor_id}
      )
    `
    logDbOk('egresos', 'post', {
      id,
      fecha: row.fecha,
      categoria: row.categoria,
      monto: row.monto,
      moneda: row.moneda,
      monto_bs: row.monto_bs,
    })
    return jsonNoStore({ ok: true })
  } catch (e: any) {
    logDbFail('egresos', 'post', e, {
      id,
      fecha: row.fecha,
      monto: row.monto,
      moneda: row.moneda,
    })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>

  await ensureEgresosTable()

  const n = normalize(body)
  if (n instanceof NextResponse) {
    logDbFail('egresos', 'put.validation', new Error('payload inválido'), {
      id: body.id,
    })
    return n
  }

  const { id, row } = n
  try {
    await sql`
      UPDATE egresos
      SET
        fecha            = ${row.fecha},
        categoria        = ${row.categoria},
        proveedor          = ${row.proveedor},
        descripcion        = ${row.descripcion},
        monto             = ${row.monto},
        moneda            = ${row.moneda},
        tasa               = ${row.tasa},
        monto_bs          = ${row.monto_bs},
        forma_pago        = ${row.forma_pago},
        foto_url          = ${row.foto_url},
        foto_public_id    = ${row.foto_public_id},
        proveedor_id      = ${row.proveedor_id},
        updated_at        = NOW()
      WHERE id = ${id}
    `
    logDbOk('egresos', 'put', {
      id,
      fecha: row.fecha,
      monto: row.monto,
      moneda: row.moneda,
    })
    return jsonNoStore({ ok: true })
  } catch (e: any) {
    logDbFail('egresos', 'put', e, { id, fecha: row.fecha, monto: row.monto })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) {
    logDbFail('egresos', 'delete', new Error('ID requerido'), { id })
    return jsonNoStore({ error: 'ID requerido' }, { status: 400 })
  }
  try {
    await ensureEgresosTable()
    await sql`
      DELETE FROM egresos WHERE id = ${id}
    `
    logDbOk('egresos', 'delete', { id })
    return jsonNoStore({ ok: true })
  } catch (e: any) {
    logDbFail('egresos', 'delete', e, { id })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}
