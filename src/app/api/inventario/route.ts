import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS inventario (
      id                TEXT PRIMARY KEY,
      nombre            TEXT NOT NULL,
      categoria         TEXT NOT NULL,
      unidad            TEXT NOT NULL DEFAULT 'unidad',
      stock_actual      NUMERIC(10,2) DEFAULT 0,
      stock_minimo      NUMERIC(10,2) DEFAULT 0,
      notas             TEXT,
      fecha_vencimiento DATE,
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id            TEXT PRIMARY KEY,
      inventario_id TEXT NOT NULL,
      tipo          TEXT NOT NULL,
      cantidad      NUMERIC(10,2) NOT NULL,
      fecha         DATE NOT NULL,
      notas         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Migration: add fecha_vencimiento if not present
  try {
    await sql`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE`
  } catch { /* already exists */ }
}

export async function GET() {
  try {
    await ensureTables()
    const items = await sql`SELECT * FROM inventario ORDER BY nombre ASC`
    const movimientos = await sql`SELECT * FROM movimientos_inventario ORDER BY created_at DESC LIMIT 100`
    return NextResponse.json({ items, movimientos })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables()
    const body = await req.json()
    const { _type, ...data } = body

    if (_type === 'item') {
      const { id, nombre, categoria, unidad, stock_actual, stock_minimo, notas, fecha_vencimiento } = data
      const fv = fecha_vencimiento && fecha_vencimiento.length >= 10 ? fecha_vencimiento : null
      await sql`
        INSERT INTO inventario (id, nombre, categoria, unidad, stock_actual, stock_minimo, notas, fecha_vencimiento)
        VALUES (${id}, ${nombre}, ${categoria}, ${unidad ?? 'unidad'}, ${stock_actual ?? 0}, ${stock_minimo ?? 0}, ${notas ?? null}, ${fv})
      `
      return NextResponse.json({ ok: true })
    }

    if (_type === 'movimiento') {
      const { id, inventario_id, tipo, cantidad, fecha, notas } = data
      await sql`
        INSERT INTO movimientos_inventario (id, inventario_id, tipo, cantidad, fecha, notas)
        VALUES (${id}, ${inventario_id}, ${tipo}, ${cantidad}, ${fecha}, ${notas ?? null})
      `
      if (tipo === 'compra') {
        await sql`UPDATE inventario SET stock_actual = stock_actual + ${cantidad}, updated_at = NOW() WHERE id = ${inventario_id}`
      } else if (tipo === 'consumo') {
        await sql`UPDATE inventario SET stock_actual = GREATEST(0, stock_actual - ${cantidad}), updated_at = NOW() WHERE id = ${inventario_id}`
      } else {
        await sql`UPDATE inventario SET stock_actual = ${cantidad}, updated_at = NOW() WHERE id = ${inventario_id}`
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await sql`DELETE FROM movimientos_inventario WHERE inventario_id = ${id}`
    await sql`DELETE FROM inventario WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
