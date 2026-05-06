import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

/** Agregados de ingresos para un día (pestañas Bs / USD / conciliación en el panel). */
async function aggIngresosDia(dia: string) {
  const [row] = await sql`
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
  return row as Record<string, number>
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const hasta =
    searchParams.get('hoy') ??
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  let diaResumen = searchParams.get('dia') ?? hasta
  if (diaResumen > hasta) diaResumen = hasta

  try {
    const [inDia, egDia, deudas, detDia] = await Promise.all([
      sql`SELECT COALESCE(SUM(monto),0)::float AS total, COUNT(*)::int AS ventas FROM ingresos WHERE fecha = ${diaResumen}`,
      sql`SELECT COALESCE(SUM(CASE WHEN moneda='BS' THEN monto ELSE monto_bs END),0)::float AS total FROM egresos WHERE fecha = ${diaResumen}`,
      sql`SELECT d.id, p.nombre as proveedor_nombre, d.monto_total, d.monto_pagado, d.moneda, d.fecha_vencimiento
          FROM deudas_proveedor d JOIN proveedores p ON p.id = d.proveedor_id
          WHERE d.estado IN ('pendiente','parcial') ORDER BY d.fecha_vencimiento ASC NULLS LAST LIMIT 5`,
      aggIngresosDia(diaResumen),
    ])

    const iDia = Number(inDia[0].total)
    const eDia = Number(egDia[0].total)

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

    return NextResponse.json({
      diaResumen,
      hoy: { ingresos: iDia, egresos: eDia, ventas: Number(inDia[0].ventas), saldo: iDia - eDia },
      deudasPendientes: deudas,
      ingresosDetalleHoy: mkDet(detDia),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
