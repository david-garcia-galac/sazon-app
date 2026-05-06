import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  try {
    const rows = desde && hasta
      ? await sql`SELECT * FROM egresos WHERE fecha >= ${desde} AND fecha <= ${hasta} ORDER BY created_at DESC`
      : await sql`SELECT * FROM egresos ORDER BY created_at DESC LIMIT 100`
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  try {
    await sql`INSERT INTO egresos ${sql(body)}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...rest } = body
  try {
    await sql`UPDATE egresos SET ${sql(rest)}, updated_at = NOW() WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  try {
    await sql`DELETE FROM egresos WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
