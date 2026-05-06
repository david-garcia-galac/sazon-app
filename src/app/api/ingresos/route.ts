import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureSchemaPatches } from '@/lib/db'

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
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

  const cantidad =
    typeof cantidadIn === 'number'
      ? cantidadIn
      : parseInt(String(cantidadIn ?? '0'), 10)
  if (!Number.isFinite(cantidad) || cantidad <= 0)
    return NextResponse.json({ error: 'Cantidad no válida' }, { status: 400 })

  const bebidaStr = typeof bebida === 'string' ? bebida : ''
  const sinBebida = !bebidaStr || bebidaStr === 'sin_bebida'

  let cantidad_bebida =
    cantidadBebidaIn === undefined || cantidadBebidaIn === null || cantidadBebidaIn === ''
      ? 0
      : typeof cantidadBebidaIn === 'number'
        ? cantidadBebidaIn
        : parseInt(String(cantidadBebidaIn), 10)

  if (!Number.isFinite(cantidad_bebida) || cantidad_bebida < 0)
    return NextResponse.json({ error: 'Cantidad de bebidas no válida' }, { status: 400 })

  if (sinBebida) cantidad_bebida = 0
  else if (cantidad_bebida < 1)
    return NextResponse.json(
      { error: 'Indicá cuántas bebidas (al menos 1) o elegí “Sin bebida”' },
      { status: 400 }
    )

  const moneda = monedaIn === 'USD' ? 'USD' : 'BS'

  let monto: number
  let tasa: number | null = null
  let monto_usd: number | null = null
  let forma: string

  if (moneda === 'USD') {
    const usd = Number(montoIn)
    const rate = Number(tasaIn)
    if (!Number.isFinite(usd) || usd <= 0)
      return NextResponse.json({ error: 'Indica el monto en dólares' }, { status: 400 })
    if (!Number.isFinite(rate) || rate <= 0)
      return NextResponse.json({ error: 'Indica la tasa de cambio (Bs por USD)' }, { status: 400 })
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
      return NextResponse.json({ error: 'Indica el monto en Bs' }, { status: 400 })
    const allowed = ['efectivo', 'pago_movil', 'transferencia']
    forma = typeof forma_pago === 'string' ? forma_pago : ''
    if (!allowed.includes(forma))
      return NextResponse.json({ error: 'Forma de pago no válida' }, { status: 400 })
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

    const rows =
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
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, ...incoming } = body
  if (!id || typeof id !== 'string')
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  await ensureSchemaPatches()

  const normalized = normalizeIngreso(incoming as Record<string, unknown>)
  if (normalized instanceof NextResponse) return normalized
  const { row } = normalized

  try {
    await sql`
      INSERT INTO ingresos (id, fecha, tipo, bebida, cantidad, cantidad_bebida, monto, moneda, tasa, monto_usd, forma_pago, notas)
      VALUES (${id}, ${row.fecha}, ${row.tipo}, ${row.bebida}, ${row.cantidad}, ${row.cantidad_bebida}, ${row.monto}, ${row.moneda}, ${row.tasa}, ${row.monto_usd}, ${row.forma_pago}, ${row.notas})
    `
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...incoming } = body
  if (!id || typeof id !== 'string')
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  await ensureSchemaPatches()

  const normalized = normalizeIngreso(incoming as Record<string, unknown>)
  if (normalized instanceof NextResponse) return normalized
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
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  try {
    await ensureSchemaPatches()
    await sql`
      DELETE FROM ingresos WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
