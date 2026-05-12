import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureSchemaPatches, neonRows } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MORA_RATE = 0.05
const MORA_DIAS = 7

function okJson(data: unknown) {
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}

function calcularMora(saldo: number, fechaPrimerConsumo: string | null): { diasAtraso: number; mora: number } {
  if (!fechaPrimerConsumo || saldo <= 0) return { diasAtraso: 0, mora: 0 }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const inicio = new Date(String(fechaPrimerConsumo))
  inicio.setHours(0, 0, 0, 0)
  const diasAtraso = Math.floor((hoy.getTime() - inicio.getTime()) / 86_400_000)
  const mora = diasAtraso > MORA_DIAS ? Math.round(saldo * MORA_RATE * 100) / 100 : 0
  return { diasAtraso, mora }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'cajero'))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await ensureSchemaPatches()

  const q = req.nextUrl.searchParams.get('q') ?? ''

  const rawSel = await sql`
    SELECT
      c.id, c.nombre, c.telefono, c.limite_usd, c.activo,
      COALESCE(cons.total_consumido, 0) AS total_consumido,
      COALESCE(pag.total_pagado, 0)    AS total_pagado,
      cons.fecha_primer_consumo
    FROM clientes_deudores c
    LEFT JOIN (
      SELECT cliente_id,
             SUM(monto_usd)::NUMERIC AS total_consumido,
             MIN(fecha)::TEXT        AS fecha_primer_consumo
      FROM consumos_deudores GROUP BY cliente_id
    ) cons ON cons.cliente_id = c.id
    LEFT JOIN (
      SELECT cliente_id, SUM(monto_usd)::NUMERIC AS total_pagado
      FROM pagos_deudores GROUP BY cliente_id
    ) pag ON pag.cliente_id = c.id
    WHERE c.activo = TRUE
      AND (${q} = '' OR c.nombre ILIKE ${`%${q}%`} OR COALESCE(c.telefono,'') ILIKE ${`%${q}%`})
    ORDER BY cons.fecha_primer_consumo ASC NULLS LAST
  `

  type Row = {
    id: string; nombre: string; telefono: string | null; limite_usd: string
    total_consumido: string; total_pagado: string; fecha_primer_consumo: string | null
  }
  const rows = neonRows<Row>(rawSel)

  const result = rows
    .map((r) => {
      const saldo = Math.round((Number(r.total_consumido) - Number(r.total_pagado)) * 100) / 100
      const { diasAtraso, mora } = calcularMora(saldo, r.fecha_primer_consumo)
      return {
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono,
        limite_usd: Number(r.limite_usd),
        total_consumido: Number(r.total_consumido),
        total_pagado: Number(r.total_pagado),
        saldo,
        dias_atraso: diasAtraso,
        mora,
        total_pagar: Math.round((saldo + mora) * 100) / 100,
      }
    })
    .filter((r) => r.saldo > 0.001)

  return okJson(result)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'cajero'))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await ensureSchemaPatches()

  const body = await req.json()
  const { cliente_id, descripcion, monto_usd, fecha } = body as {
    cliente_id: string; descripcion: string; monto_usd: number; fecha?: string
  }

  if (!cliente_id || !descripcion?.trim() || !monto_usd || monto_usd <= 0)
    return NextResponse.json({ error: 'Datos incompletos o inválidos' }, { status: 400 })

  // Verificar límite de crédito
  type LimiteRow = { limite_usd: string; total_consumido: string; total_pagado: string }
  const limRows = neonRows<LimiteRow>(await sql`
    SELECT c.limite_usd,
           COALESCE(cons.total,0) AS total_consumido,
           COALESCE(pag.total,0)  AS total_pagado
    FROM clientes_deudores c
    LEFT JOIN (SELECT cliente_id, SUM(monto_usd) AS total FROM consumos_deudores WHERE cliente_id = ${cliente_id} GROUP BY cliente_id) cons ON cons.cliente_id = c.id
    LEFT JOIN (SELECT cliente_id, SUM(monto_usd) AS total FROM pagos_deudores   WHERE cliente_id = ${cliente_id} GROUP BY cliente_id) pag  ON pag.cliente_id  = c.id
    WHERE c.id = ${cliente_id}
  `)

  const lim = limRows[0]
  if (!lim) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const saldoActual = Number(lim.total_consumido) - Number(lim.total_pagado)
  const nuevoSaldo  = saldoActual + Number(monto_usd)
  const limiteUsd   = Number(lim.limite_usd)

  if (nuevoSaldo > limiteUsd + 0.005)
    return NextResponse.json({
      error: `Límite de crédito excedido. Saldo actual: $${saldoActual.toFixed(2)}, disponible: $${Math.max(0, limiteUsd - saldoActual).toFixed(2)}`,
    }, { status: 422 })

  const id   = `cd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const dia  = fecha ?? new Date().toISOString().slice(0, 10)

  await sql`
    INSERT INTO consumos_deudores (id, cliente_id, descripcion, monto_usd, fecha)
    VALUES (${id}, ${cliente_id}, ${descripcion.trim()}, ${Number(monto_usd)}, ${dia})
  `

  return okJson({ ok: true, id })
}
