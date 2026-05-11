import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureSchemaPatches, neonRows } from '@/lib/db'
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

type Row = {
  fecha: string
  tipo: string
  bebida: string | null
  cantidad: number
  cantidad_bebida: number
  monto: number
  moneda: 'BS' | 'USD'
  tasa: number | null
  monto_usd: number | null
  forma_pago: string
  notas: string | null
}

function badRequest(error: string) {
  return jsonNoStore({ error }, { status: 400 })
}

function normalizeIngreso(
  body: Record<string, unknown>
): NextResponse | { row: Row } {
  const {
    fecha,
    tipo,
    bebida,
    cantidad: cantidadIn,
    cantidad_bebida: cantidadBebidaIn,
    monto: montoIn,
    moneda: monedaIn,
    tasa: tasaIn,
    monto_usd: montoUsdIn,
    forma_pago,
    notas,
  } = body

  if (typeof fecha !== 'string' || typeof tipo !== 'string')
    return badRequest('Datos incompletos')

  const cantidad =
    typeof cantidadIn === 'number'
      ? cantidadIn
      : parseInt(String(cantidadIn ?? '0'), 10)
  if (!Number.isFinite(cantidad) || cantidad <= 0)
    return badRequest('Cantidad no válida')

  const bebidaStr = typeof bebida === 'string' ? bebida : ''
  const sinBebida = !bebidaStr || bebidaStr === 'sin_bebida'

  let cantidad_bebida =
    cantidadBebidaIn === undefined || cantidadBebidaIn === null || cantidadBebidaIn === ''
      ? 0
      : typeof cantidadBebidaIn === 'number'
        ? cantidadBebidaIn
        : parseInt(String(cantidadBebidaIn), 10)

  if (!Number.isFinite(cantidad_bebida) || cantidad_bebida < 0)
    return badRequest('Cantidad de bebidas no válida')

  if (sinBebida) cantidad_bebida = 0
  else if (cantidad_bebida < 1)
    return badRequest('Indicá cuántas bebidas (al menos 1) o elegí “Sin bebida”')

  const moneda =
    String(monedaIn ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'

  let monto: number
  let tasa: number | null = null
  let monto_usd: number | null = null
  let forma: string

  if (moneda === 'USD') {
    const usd = Number(montoIn)
    const rate = Number(tasaIn)
    if (!Number.isFinite(usd) || usd <= 0)
      return badRequest('Indica el monto en dólares')
    if (!Number.isFinite(rate) || rate <= 0)
      return badRequest('Indica la tasa de cambio (Bs por USD)')
    monto_usd =
      montoUsdIn != null && Number.isFinite(Number(montoUsdIn))
        ? Number(montoUsdIn)
        : usd
    monto = usd * rate
    tasa = rate
    forma = 'efectivo'
  } else {
    monto = Number(montoIn)
    if (!Number.isFinite(monto) || monto <= 0)
      return badRequest('Indica el monto en Bs')
    const allowed = ['efectivo', 'pago_movil', 'transferencia']
    forma = typeof forma_pago === 'string' ? forma_pago : ''
    if (!allowed.includes(forma))
      return badRequest('Forma de pago no válida')
  }

  return {
    row: {
      fecha,
      tipo,
      bebida: bebidaStr || null,
      cantidad,
      cantidad_bebida,
      monto,
      moneda,
      tasa,
      monto_usd,
      forma_pago: forma,
      notas: typeof notas === 'string' ? (notas.trim() ? notas.trim() : null) : null,
    },
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  try {
    await ensureSchemaPatches()

    const raw =
      desde && hasta
        ? await sql`
            SELECT *
            FROM ingresos
            WHERE fecha >= ${desde}
              AND fecha <= ${hasta}
            ORDER BY created_at DESC
          `
        : await sql`
            SELECT *
            FROM ingresos
            ORDER BY created_at DESC
            LIMIT 100
          `
    const rows = neonRows(raw)
    logDbOk('ingresos', 'get', { desde, hasta, count: rows.length })
    return jsonNoStore(rows)
  } catch (e: any) {
    logDbFail('ingresos', 'get', e, { desde, hasta })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, ...incoming } = body
  if (!id || typeof id !== 'string') {
    logDbFail('ingresos', 'post', new Error('ID requerido'), { id })
    return jsonNoStore({ error: 'ID requerido' }, { status: 400 })
  }

  await ensureSchemaPatches()

  const normalized = normalizeIngreso(incoming as Record<string, unknown>)
  if (normalized instanceof NextResponse) {
    logDbFail('ingresos', 'post.validation', new Error('payload inválido'), { id })
    return normalized
  }
  const { row } = normalized

  try {
    await sql`
      INSERT INTO ingresos (id, fecha, tipo, bebida, cantidad, cantidad_bebida, monto, moneda, tasa, monto_usd, forma_pago, notas)
      VALUES (${id}, ${row.fecha}, ${row.tipo}, ${row.bebida}, ${row.cantidad}, ${row.cantidad_bebida}, ${row.monto}, ${row.moneda}, ${row.tasa}, ${row.monto_usd}, ${row.forma_pago}, ${row.notas})
    `
    logDbOk('ingresos', 'post', {
      id,
      fecha: row.fecha,
      tipo: row.tipo,
      monto: row.monto,
      moneda: row.moneda,
      forma_pago: row.forma_pago,
    })
    return jsonNoStore({ ok: true })
  } catch (e: any) {
    logDbFail('ingresos', 'post', e, {
      id,
      fecha: row.fecha,
      monto: row.monto,
      moneda: row.moneda,
    })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...incoming } = body
  if (!id || typeof id !== 'string') {
    logDbFail('ingresos', 'put', new Error('ID requerido'), { id })
    return jsonNoStore({ error: 'ID requerido' }, { status: 400 })
  }

  await ensureSchemaPatches()

  const normalized = normalizeIngreso(incoming as Record<string, unknown>)
  if (normalized instanceof NextResponse) {
    logDbFail('ingresos', 'put.validation', new Error('payload inválido'), { id })
    return normalized
  }
  const { row } = normalized

  try {
    await sql`
      UPDATE ingresos
      SET
        fecha            = ${row.fecha},
        tipo             = ${row.tipo},
        bebida           = ${row.bebida},
        cantidad         = ${row.cantidad},
        cantidad_bebida  = ${row.cantidad_bebida},
        monto            = ${row.monto},
        moneda           = ${row.moneda},
        tasa             = ${row.tasa},
        monto_usd        = ${row.monto_usd},
        forma_pago       = ${row.forma_pago},
        notas            = ${row.notas},
        updated_at       = NOW()
      WHERE id = ${id}
    `
    logDbOk('ingresos', 'put', {
      id,
      fecha: row.fecha,
      monto: row.monto,
      moneda: row.moneda,
    })
    return jsonNoStore({ ok: true })
  } catch (e: any) {
    logDbFail('ingresos', 'put', e, { id, fecha: row.fecha, monto: row.monto })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  try {
    await ensureSchemaPatches()
    await sql`
      DELETE FROM ingresos WHERE id = ${id}
    `
    logDbOk('ingresos', 'delete', { id })
    return jsonNoStore({ ok: true })
  } catch (e: any) {
    logDbFail('ingresos', 'delete', e, { id })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}
