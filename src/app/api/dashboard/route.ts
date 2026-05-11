import { NextRequest, NextResponse } from 'next/server'
import sql, { neonOneRow } from '@/lib/db'
import { logDbFail, logDbOk } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
}

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) },
  })
}

/** Agregados de ingresos para un día (pestañas Bs / USD / conciliación en el panel). */
async function aggIngresosDia(dia: string) {
  const raw = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN COALESCE(moneda,'BS') = 'BS' THEN monto ELSE 0 END), 0)::float AS bs_total,
      COALESCE(SUM(CASE WHEN COALESCE(moneda,'BS') = 'BS' AND forma_pago = 'efectivo' THEN monto ELSE 0 END), 0)::float AS bs_efectivo,
      COALESCE(SUM(CASE WHEN COALESCE(moneda,'BS') = 'BS' AND forma_pago = 'pago_movil' THEN monto ELSE 0 END), 0)::float AS bs_pago_movil,
      COALESCE(SUM(CASE WHEN COALESCE(moneda,'BS') = 'BS' AND forma_pago = 'transferencia' THEN monto ELSE 0 END), 0)::float AS bs_transferencia,
      COALESCE(SUM(CASE WHEN COALESCE(moneda,'BS') = 'BS' THEN monto ELSE 0 END), 0)::float AS bs_solo,
      COALESCE(SUM(CASE WHEN moneda = 'USD' THEN COALESCE(monto_usd, 0) ELSE 0 END), 0)::float AS usd_monto,
      COALESCE(SUM(CASE WHEN moneda = 'USD' THEN monto ELSE 0 END), 0)::float AS usd_equiv_bs,
      COUNT(*) FILTER (WHERE COALESCE(moneda,'BS') = 'BS')::int AS ventas_bs,
      COUNT(*) FILTER (WHERE moneda = 'USD')::int AS ventas_usd,
      COALESCE(SUM(monto), 0)::float AS ingresos_equiv_bs,
      COUNT(*)::int AS ventas
    FROM ingresos WHERE fecha = ${dia}
  `
  const row = neonOneRow<Record<string, number>>(raw, [
    'bs_total',
    'usd_monto',
    'ventas_bs',
    'ventas_usd',
    'ventas',
  ])
  return row ?? {
    bs_total: 0,
    bs_efectivo: 0,
    bs_pago_movil: 0,
    bs_transferencia: 0,
    bs_solo: 0,
    usd_monto: 0,
    usd_equiv_bs: 0,
    ventas_bs: 0,
    ventas_usd: 0,
    ingresos_equiv_bs: 0,
    ventas: 0,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const hasta =
    searchParams.get('hoy') ??
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  let diaResumen = searchParams.get('dia') ?? hasta
  if (diaResumen > hasta) diaResumen = hasta

  try {
    await sql`CREATE TABLE IF NOT EXISTS ingresos (
      id TEXT PRIMARY KEY, fecha DATE NOT NULL, tipo TEXT NOT NULL,
      bebida TEXT, cantidad INTEGER NOT NULL DEFAULT 1,
      cantidad_bebida INTEGER NOT NULL DEFAULT 0,
      monto NUMERIC(12,2) NOT NULL, moneda TEXT NOT NULL DEFAULT 'BS',
      tasa NUMERIC(10,2), monto_usd NUMERIC(12,2),
      forma_pago TEXT NOT NULL, notas TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS egresos (
      id TEXT PRIMARY KEY, fecha DATE NOT NULL, categoria TEXT NOT NULL,
      proveedor TEXT, descripcion TEXT, monto NUMERIC(12,2) NOT NULL,
      moneda TEXT NOT NULL DEFAULT 'BS', tasa NUMERIC(10,2), monto_bs NUMERIC(12,2),
      forma_pago TEXT NOT NULL, foto_url TEXT, foto_public_id TEXT, proveedor_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS proveedores (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL, categoria TEXT,
      telefono TEXT, tiene_credito BOOLEAN DEFAULT FALSE, notas TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS deudas_proveedor (
      id TEXT PRIMARY KEY, proveedor_id TEXT NOT NULL, egreso_id TEXT,
      monto_total NUMERIC(12,2) NOT NULL, monto_pagado NUMERIC(12,2) DEFAULT 0,
      moneda TEXT DEFAULT 'BS', fecha_compra DATE NOT NULL,
      fecha_vencimiento DATE, estado TEXT DEFAULT 'pendiente', notas TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`
  } catch {
    // Las tablas ya existen — ignorar
  }

  try {
    const [rawInDia, rawEgDia, detDia] = await Promise.all([
      sql`SELECT COALESCE(SUM(monto),0)::float AS total, COUNT(*)::int AS ventas FROM ingresos WHERE fecha = ${diaResumen}`,
      sql`SELECT COALESCE(SUM(CASE WHEN moneda='BS' THEN monto ELSE monto_bs END),0)::float AS total FROM egresos WHERE fecha = ${diaResumen}`,
      aggIngresosDia(diaResumen),
    ])

    // Deudas en consulta separada para que un error no rompa todo el dashboard
    let deudas: unknown[] = []
    try {
      deudas = await sql`
        SELECT d.id, p.nombre as proveedor_nombre, d.monto_total, d.monto_pagado, d.moneda, d.fecha_vencimiento
        FROM deudas_proveedor d JOIN proveedores p ON p.id = d.proveedor_id
        WHERE d.estado IN ('pendiente','parcial')
        ORDER BY d.fecha_vencimiento ASC NULLS LAST LIMIT 5
      `
    } catch (deudasErr) {
      logDbFail('dashboard', 'get.deudas', deudasErr, { dia: diaResumen })
    }

    const inRow = neonOneRow<{ total: number; ventas: number }>(rawInDia, ['total', 'ventas'])
    const egRow = neonOneRow<{ total: number }>(rawEgDia, ['total'])

    const iDia = Number(inRow?.total ?? 0)
    const eDia = Number(egRow?.total ?? 0)

    logDbOk('dashboard', 'get', {
      hoy: hasta,
      dia: diaResumen,
      ingresos: iDia,
      egresos: eDia,
      ventas: Number(inRow?.ventas ?? 0),
      deudas: deudas.length,
    })

    const mkDet = (d: Record<string, number>) => ({
      bs: {
        total: d.bs_total,
        efectivo: d.bs_efectivo,
        pago_movil: d.bs_pago_movil,
        transferencia: d.bs_transferencia,
        ventas: d.ventas_bs,
      },
      usd: {
        totalUsd: d.usd_monto,
        equivBs: d.usd_equiv_bs,
        ventas: d.ventas_usd,
      },
      conciliacion: {
        ingresosBolivares: d.bs_solo,
        bolivaresEquivUsd: d.usd_equiv_bs,
        totalBolivares: d.ingresos_equiv_bs,
        totalDivisaUsd: d.usd_monto,
        ventasTotal: d.ventas,
      },
    })

    return jsonNoStore({
      diaResumen,
      hoy: {
        ingresos: iDia,
        egresos: eDia,
        ventas: Number(inRow?.ventas ?? 0),
        saldo: iDia - eDia,
      },
      deudasPendientes: deudas,
      ingresosDetalleHoy: mkDet(detDia),
    })
  } catch (e: any) {
    logDbFail('dashboard', 'get', e, { hoy: hasta, dia: diaResumen })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}
