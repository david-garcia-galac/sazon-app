import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureSchemaPatches, neonRows } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'cajero'))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await ensureSchemaPatches()

  const q = req.nextUrl.searchParams.get('q') ?? ''

  type Row = { id: string; nombre: string; telefono: string | null; limite_usd: string }
  const rows = neonRows<Row>(await sql`
    SELECT id, nombre, telefono, limite_usd
    FROM clientes_deudores
    WHERE activo = TRUE
      AND (${q} = '' OR nombre ILIKE ${`%${q}%`} OR COALESCE(telefono,'') ILIKE ${`%${q}%`})
    ORDER BY nombre ASC
    LIMIT 20
  `)

  return NextResponse.json(rows.map((r) => ({ ...r, limite_usd: Number(r.limite_usd) })), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'cajero'))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await ensureSchemaPatches()

  const { nombre, telefono, notas } = await req.json()
  if (!nombre?.trim())
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const id = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  await sql`
    INSERT INTO clientes_deudores (id, nombre, telefono, notas, limite_usd)
    VALUES (${id}, ${nombre.trim()}, ${telefono || null}, ${notas || null}, 10)
  `

  return NextResponse.json({ ok: true, id, nombre: nombre.trim(), telefono: telefono || null, limite_usd: 10 })
}
