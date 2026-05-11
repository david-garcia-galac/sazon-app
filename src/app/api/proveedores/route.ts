import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS proveedores (
      id            TEXT PRIMARY KEY,
      nombre        TEXT NOT NULL,
      categoria     TEXT,
      telefono      TEXT,
      tiene_credito BOOLEAN DEFAULT FALSE,
      notas         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS deudas_proveedor (
      id                TEXT PRIMARY KEY,
      proveedor_id      TEXT NOT NULL,
      egreso_id         TEXT,
      monto_total       NUMERIC(12,2) NOT NULL,
      monto_pagado      NUMERIC(12,2) DEFAULT 0,
      moneda            TEXT DEFAULT 'BS',
      fecha_compra      DATE NOT NULL,
      fecha_vencimiento DATE,
      estado            TEXT DEFAULT 'pendiente',
      notas             TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS pagos_proveedor (
      id              TEXT PRIMARY KEY,
      deuda_id        TEXT NOT NULL,
      monto           NUMERIC(12,2) NOT NULL,
      fecha           DATE NOT NULL,
      forma_pago      TEXT NOT NULL,
      notas           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function GET() {
  try {
    await ensureTables()
    const proveedores = await sql`SELECT * FROM proveedores ORDER BY nombre ASC`
    const deudas = await sql`
      SELECT d.*, p.nombre AS proveedor_nombre
      FROM deudas_proveedor d
      LEFT JOIN proveedores p ON p.id = d.proveedor_id
      ORDER BY d.created_at DESC
    `
    return NextResponse.json({ proveedores, deudas })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables()
    const body = await req.json()
    const { _type, ...data } = body

    if (_type === 'proveedor') {
      const { id, nombre, categoria, telefono, tiene_credito, notas } = data
      await sql`
        INSERT INTO proveedores (id, nombre, categoria, telefono, tiene_credito, notas)
        VALUES (${id}, ${nombre}, ${categoria ?? null}, ${telefono ?? null}, ${tiene_credito ?? false}, ${notas ?? null})
      `
      return NextResponse.json({ ok: true })
    }

    if (_type === 'deuda') {
      const { id, proveedor_id, monto_total, monto_pagado, moneda, fecha_compra, fecha_vencimiento, estado, notas } = data
      await sql`
        INSERT INTO deudas_proveedor (id, proveedor_id, monto_total, monto_pagado, moneda, fecha_compra, fecha_vencimiento, estado, notas)
        VALUES (
          ${id}, ${proveedor_id}, ${monto_total}, ${monto_pagado ?? 0},
          ${moneda ?? 'BS'}, ${fecha_compra}, ${fecha_vencimiento ?? null},
          ${estado ?? 'pendiente'}, ${notas ?? null}
        )
      `
      return NextResponse.json({ ok: true })
    }

    if (_type === 'pago') {
      const { id, deuda_id, monto, fecha, forma_pago, notas } = data
      await sql`
        INSERT INTO pagos_proveedor (id, deuda_id, monto, fecha, forma_pago, notas)
        VALUES (${id}, ${deuda_id}, ${monto}, ${fecha}, ${forma_pago}, ${notas ?? null})
      `
      // Recalcular monto_pagado y estado de la deuda
      await sql`
        UPDATE deudas_proveedor
        SET
          monto_pagado = (
            SELECT COALESCE(SUM(p.monto), 0) FROM pagos_proveedor p WHERE p.deuda_id = ${deuda_id}
          ),
          estado = CASE
            WHEN (SELECT COALESCE(SUM(p.monto), 0) FROM pagos_proveedor p WHERE p.deuda_id = ${deuda_id}) >= monto_total THEN 'pagado'
            WHEN (SELECT COALESCE(SUM(p.monto), 0) FROM pagos_proveedor p WHERE p.deuda_id = ${deuda_id}) > 0 THEN 'parcial'
            ELSE 'pendiente'
          END,
          updated_at = NOW()
        WHERE id = ${deuda_id}
      `
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, _type } = await req.json()
    if (_type === 'deuda') {
      await sql`DELETE FROM pagos_proveedor WHERE deuda_id = ${id}`
      await sql`DELETE FROM deudas_proveedor WHERE id = ${id}`
    } else {
      await sql`DELETE FROM deudas_proveedor WHERE proveedor_id = ${id}`
      await sql`DELETE FROM proveedores WHERE id = ${id}`
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
