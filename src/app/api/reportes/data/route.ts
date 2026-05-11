import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureEgresosTable, ensureSchemaPatches, neonRows } from '@/lib/db'
import { logDbFail, logDbOk } from '@/lib/logger'
import type {
  EgresoRow,
  IngresoRow,
  ReportData,
  ReportRange,
  ReportType,
  Totales,
} from '@/lib/reportes/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
}

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { ...NO_STORE, ...(init?.headers ?? {}) },
  })
}

function isYmd(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function asType(s: string | null): ReportType | null {
  return s === 'ingresos' || s === 'egresos' || s === 'resumen' ? s : null
}

function asRange(s: string | null): ReportRange | null {
  return s === 'diario' || s === 'semanal' ? s : null
}

function totales(ingresos: IngresoRow[], egresos: EgresoRow[]): Totales {
  let ingresosBs = 0
  let ingresosUsd = 0
  for (const r of ingresos) {
    if (r.moneda === 'USD') ingresosUsd += Number(r.monto_usd ?? 0)
    else ingresosBs += Number(r.monto ?? 0)
  }
  let egresosBs = 0
  let egresosUsd = 0
  for (const r of egresos) {
    if (r.moneda === 'USD') {
      egresosUsd += Number(r.monto ?? 0)
      egresosBs += Number(r.monto_bs ?? 0)
    } else {
      egresosBs += Number(r.monto ?? 0)
    }
  }
  return {
    ingresosBs,
    ingresosUsd,
    egresosBs,
    egresosUsd,
    saldoBs: ingresosBs - egresosBs,
    ventas: ingresos.length,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type = asType(searchParams.get('type'))
  const range = asRange(searchParams.get('range'))
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  if (!type || !range || !isYmd(desde) || !isYmd(hasta))
    return jsonNoStore({ error: 'Parámetros inválidos (type, range, desde, hasta)' }, { status: 400 })

  if (desde > hasta)
    return jsonNoStore({ error: 'El rango es inválido (desde > hasta)' }, { status: 400 })

  try {
    await ensureSchemaPatches()
    await ensureEgresosTable()

    const wantIn = type === 'ingresos' || type === 'resumen'
    const wantEg = type === 'egresos' || type === 'resumen'

    const ingresos: IngresoRow[] = wantIn
      ? (neonRows<Record<string, unknown>>(
          await sql`
            SELECT id, fecha::text, tipo, bebida, cantidad, cantidad_bebida,
                   monto::float AS monto, moneda, tasa::float AS tasa,
                   monto_usd::float AS monto_usd, forma_pago, notas
            FROM ingresos
            WHERE fecha >= ${desde} AND fecha <= ${hasta}
            ORDER BY fecha ASC, created_at ASC
          `
        ) as unknown as IngresoRow[])
      : []

    const egresos: EgresoRow[] = wantEg
      ? (neonRows<Record<string, unknown>>(
          await sql`
            SELECT id, fecha::text, categoria, proveedor, descripcion,
                   monto::float AS monto, moneda, tasa::float AS tasa,
                   monto_bs::float AS monto_bs, forma_pago
            FROM egresos
            WHERE fecha >= ${desde} AND fecha <= ${hasta}
            ORDER BY fecha ASC, created_at ASC
          `
        ) as unknown as EgresoRow[])
      : []

    const data: ReportData = {
      config: { type, range, desde, hasta },
      generadoEn: new Date().toISOString(),
      ingresos,
      egresos,
      totales: totales(ingresos, egresos),
    }

    logDbOk('reportes', 'data.get', {
      type,
      range,
      desde,
      hasta,
      ingresos: ingresos.length,
      egresos: egresos.length,
    })

    return jsonNoStore(data)
  } catch (e: any) {
    logDbFail('reportes', 'data.get', e, { type, range, desde, hasta })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}
