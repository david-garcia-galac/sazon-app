import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const hoy = searchParams.get('hoy') ?? new Date().toISOString().slice(0, 10)
  const semana = searchParams.get('semana') ?? hoy
  const mes = searchParams.get('mes') ?? hoy.slice(0, 7) + '-01'

  try {
    const [inHoy, egHoy, inSem, egSem, inMes, egMes, deudas] = await Promise.all([
      sql`SELECT COALESCE(SUM(monto),0) as total, COUNT(*) as ventas FROM ingresos WHERE fecha = ${hoy}`,
      sql`SELECT COALESCE(SUM(CASE WHEN moneda='BS' THEN monto ELSE monto_bs END),0) as total FROM egresos WHERE fecha = ${hoy}`,
      sql`SELECT COALESCE(SUM(monto),0) as total FROM ingresos WHERE fecha >= ${semana}`,
      sql`SELECT COALESCE(SUM(CASE WHEN moneda='BS' THEN monto ELSE monto_bs END),0) as total FROM egresos WHERE fecha >= ${semana}`,
      sql`SELECT COALESCE(SUM(monto),0) as total FROM ingresos WHERE fecha >= ${mes}`,
      sql`SELECT COALESCE(SUM(CASE WHEN moneda='BS' THEN monto ELSE monto_bs END),0) as total FROM egresos WHERE fecha >= ${mes}`,
      sql`SELECT d.id, p.nombre as proveedor_nombre, d.monto_total, d.monto_pagado, d.moneda, d.fecha_vencimiento
          FROM deudas_proveedor d JOIN proveedores p ON p.id = d.proveedor_id
          WHERE d.estado IN ('pendiente','parcial') ORDER BY d.fecha_vencimiento ASC NULLS LAST LIMIT 5`,
    ])

    const iHoy = Number(inHoy[0].total)
    const eHoy = Number(egHoy[0].total)
    const iSem = Number(inSem[0].total)
    const eSem = Number(egSem[0].total)
    const iMes = Number(inMes[0].total)
    const eMes = Number(egMes[0].total)

    return NextResponse.json({
      hoy:    { ingresos: iHoy, egresos: eHoy, ventas: Number(inHoy[0].ventas), saldo: iHoy - eHoy },
      semana: { ingresos: iSem, egresos: eSem, saldo: iSem - eSem },
      mes:    { ingresos: iMes, egresos: eMes, saldo: iMes - eMes },
      deudasPendientes: deudas,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
