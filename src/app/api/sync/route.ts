import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const { items } = await req.json()
  let synced = 0

  for (const item of items) {
    try {
      const { tabla, accion, payload } = item
      if (accion === 'delete') {
        await sql`DELETE FROM ${sql(tabla)} WHERE id = ${payload.id}`
      } else {
        const cols = Object.keys(payload)
        const vals = Object.values(payload)
        if (accion === 'create') {
          await sql`INSERT INTO ${sql(tabla)} ${sql(payload as Record<string,unknown>)} ON CONFLICT (id) DO NOTHING`
        } else {
          await sql`INSERT INTO ${sql(tabla)} ${sql(payload as Record<string,unknown>)} ON CONFLICT (id) DO UPDATE SET ${sql(payload as Record<string,unknown>)}`
        }
      }
      synced++
    } catch {
      // continue with other items
    }
  }

  return NextResponse.json({ ok: true, synced })
}
