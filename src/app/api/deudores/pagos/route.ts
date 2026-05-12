import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureSchemaPatches, neonRows } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const FORMAS_VALIDAS = ['efectivo', 'transferencia', 'datos_prepago']

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'cajero'))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await ensureSchemaPatches()

  const { cliente_id, monto_usd, forma_pago, fecha, notas } = await req.json()

  if (!cliente_id || !monto_usd || monto_usd <= 0)
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  if (!FORMAS_VALIDAS.includes(forma_pago))
    return NextResponse.json({ error: 'Forma de pago inválida' }, { status: 400 })

  // Verificar que el cliente existe y tiene saldo
  type BalRow = { total_consumido: string; total_pagado: string }
  const balRows = neonRows<BalRow>(await sql`
    SELECT COALESCE(cons.total,0) AS total_consumido, COALESCE(pag.total,0) AS total_pagado
    FROM clientes_deudores c
    LEFT JOIN (SELECT cliente_id, SUM(monto_usd) AS total FROM consumos_deudores WHERE cliente_id = ${cliente_id} GROUP BY cliente_id) cons ON cons.cliente_id = c.id
    LEFT JOIN (SELECT cliente_id, SUM(monto_usd) AS total FROM pagos_deudores   WHERE cliente_id = ${cliente_id} GROUP BY cliente_id) pag  ON pag.cliente_id  = c.id
    WHERE c.id = ${cliente_id}
  `)

  if (!balRows[0]) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const id  = `pd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const dia = fecha ?? new Date().toISOString().slice(0, 10)

  await sql`
    INSERT INTO pagos_deudores (id, cliente_id, monto_usd, forma_pago, fecha, notas)
    VALUES (${id}, ${cliente_id}, ${Number(monto_usd)}, ${forma_pago}, ${dia}, ${notas || null})
  `

  return NextResponse.json({ ok: true, id })
}
