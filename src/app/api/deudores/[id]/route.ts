import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureSchemaPatches, neonRows } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'cajero'))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await ensureSchemaPatches()

  const { id } = params

  type ClienteRow = { id: string; nombre: string; telefono: string | null; limite_usd: string }
  const cliRows = neonRows<ClienteRow>(await sql`
    SELECT id, nombre, telefono, limite_usd FROM clientes_deudores WHERE id = ${id}
  `)
  if (!cliRows[0]) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  type ConsumoRow = { id: string; descripcion: string; monto_usd: string; fecha: string; created_at: string }
  type PagoRow   = { id: string; monto_usd: string; forma_pago: string; fecha: string; notas: string | null; created_at: string }

  const [consumos, pagos] = await Promise.all([
    sql`SELECT id, descripcion, monto_usd::TEXT, fecha::TEXT, created_at::TEXT FROM consumos_deudores WHERE cliente_id = ${id} ORDER BY fecha ASC, created_at ASC`,
    sql`SELECT id, monto_usd::TEXT, forma_pago, fecha::TEXT, notas, created_at::TEXT FROM pagos_deudores WHERE cliente_id = ${id} ORDER BY fecha ASC, created_at ASC`,
  ])

  const historial = [
    ...neonRows<ConsumoRow>(consumos).map((r) => ({
      id: r.id, tipo: 'consumo' as const,
      descripcion: r.descripcion, monto_usd: Number(r.monto_usd),
      fecha: r.fecha, created_at: r.created_at,
    })),
    ...neonRows<PagoRow>(pagos).map((r) => ({
      id: r.id, tipo: 'pago' as const,
      descripcion: `Pago · ${r.forma_pago.replace('_', ' ')}${r.notas ? ` · ${r.notas}` : ''}`,
      monto_usd: Number(r.monto_usd),
      fecha: r.fecha, created_at: r.created_at,
    })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return NextResponse.json({
    cliente: { ...cliRows[0], limite_usd: Number(cliRows[0].limite_usd) },
    historial,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
