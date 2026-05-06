import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  try {
    const items = await sql`SELECT * FROM inventario ORDER BY nombre ASC`
    return NextResponse.json(items)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  try {
    await sql`INSERT INTO inventario ${sql(body)}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...rest } = body
  try {
    await sql`UPDATE inventario SET ${sql(rest)}, updated_at = NOW() WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  try {
    await sql`DELETE FROM inventario WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
