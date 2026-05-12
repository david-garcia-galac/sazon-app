import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureSchemaPatches } from '@/lib/db'
import { logDbFail, logDbOk } from '@/lib/logger'
import { getSession } from '@/lib/auth'
import {
  anclarMontosAlRealPorDia,
  generarTicketsRango,
  type TicketFicticio,
} from '@/lib/owner/mock'
import { buildAlertasInsights } from '@/lib/owner/insights'
import {
  DIAS_SEMANA,
  type HeatmapCell,
  type Kpi,
  type OrderMixPoint,
  type OrderMixSummary,
  type OwnerMetrics,
  type OwnerRange,
  type RangeKey,
  type SalesTrendPoint,
  type TopProduct,
  type WeekCompareSeries,
} from '@/lib/owner/types'

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

// ─── Helpers de fechas ───────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function daysAgo(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() - days)
  return ymd(d)
}
function inicioSemanaLunes(base: string): string {
  const d = new Date(`${base}T00:00:00`)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return ymd(d)
}
function inicioMes(base: string): string {
  const d = new Date(`${base}T00:00:00`)
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1))
}

function asRangeKey(s: string | null): RangeKey {
  if (s === 'hoy' || s === 'semana' || s === 'mes' || s === 'personalizado') return s
  return 'hoy'
}

function resolveRange(searchParams: URLSearchParams): OwnerRange {
  const hoy = ymd(new Date())
  const key = asRangeKey(searchParams.get('range'))
  if (key === 'hoy') return { key, desde: hoy, hasta: hoy }
  if (key === 'semana') return { key, desde: inicioSemanaLunes(hoy), hasta: hoy }
  if (key === 'mes') return { key, desde: inicioMes(hoy), hasta: hoy }
  // personalizado
  const desde = searchParams.get('desde') ?? daysAgo(hoy, 6)
  const hasta = searchParams.get('hasta') ?? hoy
  return { key, desde, hasta }
}

// ─── KPI helpers ─────────────────────────────────────────────────────────────

function variation(current: number, previous: number) {
  if (previous === 0)
    return {
      value: current,
      pct: current === 0 ? 0 : 100,
      direction: current === 0 ? ('flat' as const) : ('up' as const),
    }
  const pct = ((current - previous) / previous) * 100
  return {
    value: current,
    pct,
    direction: pct > 0.5 ? ('up' as const) : pct < -0.5 ? ('down' as const) : ('flat' as const),
  }
}

// ─── Agregados desde DB (ingresos reales por fecha) ─────────────────────────

async function ingresosRealesPorFecha(
  desde: string,
  hasta: string
): Promise<Map<string, number>> {
  const rows = (await sql`
    SELECT fecha::text AS fecha,
           SUM(CASE WHEN moneda='USD' THEN monto ELSE monto END)::float AS total
    FROM ingresos
    WHERE fecha >= ${desde} AND fecha <= ${hasta}
    GROUP BY fecha
  `) as unknown as Array<{ fecha: string; total: number }>

  const out = new Map<string, number>()
  for (const r of rows) out.set(r.fecha, Number(r.total ?? 0))
  return out
}

// ─── Construcción de bloques ─────────────────────────────────────────────────

function buildSalesTrend30(
  ingresosPorFecha: Map<string, number>,
  hoy: string
): SalesTrendPoint[] {
  const inicioSem = inicioSemanaLunes(hoy)
  const out: SalesTrendPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const f = daysAgo(hoy, i)
    out.push({
      fecha: f,
      total: ingresosPorFecha.get(f) ?? 0,
      semanaActual: f >= inicioSem,
    })
  }
  return out
}

function buildWeekCompare(
  ingresosPorFecha: Map<string, number>,
  hoy: string
): WeekCompareSeries[] {
  const inicioActual = inicioSemanaLunes(hoy)
  const inicioPrev = daysAgo(inicioActual, 7)
  const out: WeekCompareSeries[] = []
  for (let i = 0; i < 7; i++) {
    const fActual = daysAgo(inicioActual, -i) // suma i días
    const fPrev = daysAgo(inicioPrev, -i)
    out.push({
      diaSemana: i,
      diaLabel: DIAS_SEMANA[i],
      estaSemana: ingresosPorFecha.get(fActual) ?? 0,
      semanaAnterior: ingresosPorFecha.get(fPrev) ?? 0,
    })
  }
  return out
}

function buildOrderMix(tickets: TicketFicticio[]): OrderMixSummary {
  let dy = 0
  let al = 0
  for (const t of tickets) {
    if (t.turno === 'desayuno') dy += t.ordenes
    else al += t.ordenes
  }
  const total = dy + al || 1

  const porFecha = new Map<string, { d: number; a: number }>()
  for (const t of tickets) {
    const slot = porFecha.get(t.fecha) ?? { d: 0, a: 0 }
    if (t.turno === 'desayuno') slot.d += t.ordenes
    else slot.a += t.ordenes
    porFecha.set(t.fecha, slot)
  }
  const evolucion: OrderMixPoint[] = Array.from(porFecha.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([fecha, v]) => ({ fecha, desayuno: v.d, almuerzo: v.a }))

  return {
    totalDesayuno: dy,
    totalAlmuerzo: al,
    pctDesayuno: (dy / total) * 100,
    pctAlmuerzo: (al / total) * 100,
    evolucion,
  }
}

function buildHeatmap(tickets: TicketFicticio[]): HeatmapCell[] {
  type Slot = { ordenes: number; ingresoBs: number }
  const grid = new Map<string, Slot>()
  for (const t of tickets) {
    const k = `${t.diaSemana}-${t.hora}`
    const cur = grid.get(k) ?? { ordenes: 0, ingresoBs: 0 }
    cur.ordenes += t.ordenes
    cur.ingresoBs += t.montoBs
    grid.set(k, cur)
  }
  const max = Array.from(grid.values()).reduce((m, s) => Math.max(m, s.ordenes), 0) || 1
  const out: HeatmapCell[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 6; h <= 16; h++) {
      const k = `${d}-${h}`
      const s = grid.get(k) ?? { ordenes: 0, ingresoBs: 0 }
      out.push({
        diaSemana: d,
        hora: h,
        ordenes: s.ordenes,
        ingresoBs: s.ingresoBs,
        intensidad: s.ordenes / max,
      })
    }
  }
  return out
}

function buildTops(tickets: TicketFicticio[]): {
  topDesayuno: TopProduct[]
  topAlmuerzo: TopProduct[]
  topMargen: TopProduct[]
} {
  type Agg = { ordenes: number; ingresoBs: number; turno: string }
  const agg = new Map<string, Agg>()
  for (const t of tickets) {
    const k = `${t.producto}__${t.turno}`
    const cur = agg.get(k) ?? { ordenes: 0, ingresoBs: 0, turno: t.turno }
    cur.ordenes += t.ordenes
    cur.ingresoBs += t.montoBs
    agg.set(k, cur)
  }
  const list = Array.from(agg.entries()).map(([k, v]) => ({
    nombre: k.split('__')[0],
    turno: v.turno,
    ordenes: v.ordenes,
    ingresoBs: v.ingresoBs,
  }))
  const totalDy = list.filter((x) => x.turno === 'desayuno').reduce((a, b) => a + b.ordenes, 0) || 1
  const totalAl = list.filter((x) => x.turno === 'almuerzo').reduce((a, b) => a + b.ordenes, 0) || 1

  const dy = list
    .filter((x) => x.turno === 'desayuno')
    .sort((a, b) => b.ordenes - a.ordenes)
    .slice(0, 5)
    .map(
      (x): TopProduct => ({
        nombre: x.nombre,
        ordenes: x.ordenes,
        ingresoBs: x.ingresoBs,
        pctOrdenes: (x.ordenes / totalDy) * 100,
        margenIndex: 0,
      })
    )
  const al = list
    .filter((x) => x.turno === 'almuerzo')
    .sort((a, b) => b.ordenes - a.ordenes)
    .slice(0, 5)
    .map(
      (x): TopProduct => ({
        nombre: x.nombre,
        ordenes: x.ordenes,
        ingresoBs: x.ingresoBs,
        pctOrdenes: (x.ordenes / totalAl) * 100,
        margenIndex: 0,
      })
    )

  // Margen estimado = índice "precio × popularidad" normalizado 0..100.
  const conPrecio = list.map((x) => ({
    ...x,
    precioPromedio: x.ingresoBs / Math.max(1, x.ordenes),
    score: (x.ingresoBs / Math.max(1, x.ordenes)) * x.ordenes,
  }))
  const maxScore = conPrecio.reduce((m, x) => Math.max(m, x.score), 0) || 1
  const margen = conPrecio
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(
      (x): TopProduct => ({
        nombre: `${x.nombre} (${x.turno})`,
        ordenes: x.ordenes,
        ingresoBs: x.ingresoBs,
        pctOrdenes: x.turno === 'desayuno' ? (x.ordenes / totalDy) * 100 : (x.ordenes / totalAl) * 100,
        margenIndex: (x.score / maxScore) * 100,
      })
    )

  return { topDesayuno: dy, topAlmuerzo: al, topMargen: margen }
}

function buildKpis(input: {
  tickets: TicketFicticio[]
  hoy: string
  ingresosReales: Map<string, number>
}): Kpi[] {
  const { tickets, hoy, ingresosReales } = input

  // Ingreso hoy vs ayer
  const ayer = daysAgo(hoy, 1)
  const ingHoy = ingresosReales.get(hoy) ?? 0
  const ingAyer = ingresosReales.get(ayer) ?? 0

  // Ticket promedio (desayuno vs almuerzo) últimos 7 días
  const semana = new Set<string>()
  for (let i = 0; i < 7; i++) semana.add(daysAgo(hoy, i))
  let ticketsDy = 0
  let bsDy = 0
  let ticketsAl = 0
  let bsAl = 0
  let ordenesHoy = 0
  for (const t of tickets) {
    if (!semana.has(t.fecha)) continue
    if (t.turno === 'desayuno') {
      ticketsDy += 1
      bsDy += t.montoBs
    } else {
      ticketsAl += 1
      bsAl += t.montoBs
    }
    if (t.fecha === hoy) ordenesHoy += t.ordenes
  }
  const promDy = ticketsDy ? bsDy / ticketsDy : 0
  const promAl = ticketsAl ? bsAl / ticketsAl : 0

  // Clientes únicos hoy vs hace 7 días
  const setHoy = new Set<string>()
  const setHace7 = new Set<string>()
  const hace7 = daysAgo(hoy, 7)
  for (const t of tickets) {
    if (t.fecha === hoy) setHoy.add(t.clienteHash)
    else if (t.fecha === hace7) setHace7.add(t.clienteHash)
  }

  // Tasa de repetición (clientes que aparecieron en >1 día de los últimos 7)
  const aparicionesPorCliente = new Map<string, Set<string>>()
  for (const t of tickets) {
    if (!semana.has(t.fecha)) continue
    if (!aparicionesPorCliente.has(t.clienteHash))
      aparicionesPorCliente.set(t.clienteHash, new Set())
    aparicionesPorCliente.get(t.clienteHash)!.add(t.fecha)
  }
  let total = 0
  let recur = 0
  aparicionesPorCliente.forEach((s) => {
    total += 1
    if (s.size > 1) recur += 1
  })
  const tasaRepeticion = total ? (recur / total) * 100 : 0

  // Hora pico (la de mayor ingreso en los últimos 7 días)
  const ingresoPorHora = new Map<number, number>()
  for (const t of tickets) {
    if (!semana.has(t.fecha)) continue
    ingresoPorHora.set(t.hora, (ingresoPorHora.get(t.hora) ?? 0) + t.montoBs)
  }
  let pickHora = 12
  let pickMonto = -1
  ingresoPorHora.forEach((m, h) => {
    if (m > pickMonto) {
      pickMonto = m
      pickHora = h
    }
  })

  return [
    {
      id: 'ingreso-hoy',
      label: 'Ingreso hoy',
      value: ingHoy,
      format: 'bs',
      sub: 'vs ayer',
      variation: variation(ingHoy, ingAyer),
    },
    {
      id: 'ticket-desayuno',
      label: 'Ticket prom. desayuno',
      value: promDy,
      format: 'bs',
      sub: 'últimos 7 días',
    },
    {
      id: 'ticket-almuerzo',
      label: 'Ticket prom. almuerzo',
      value: promAl,
      format: 'bs',
      sub: 'últimos 7 días',
    },
    {
      id: 'clientes-unicos',
      label: 'Clientes únicos hoy',
      value: setHoy.size,
      format: 'int',
      sub: 'vs misma fecha −7 d',
      variation: variation(setHoy.size, setHace7.size),
    },
    {
      id: 'tasa-repeticion',
      label: 'Tasa repetición (7 d)',
      value: tasaRepeticion,
      format: 'pct',
      sub: '% clientes que volvieron',
    },
    {
      id: 'hora-pico',
      label: 'Hora pico',
      value: pickHora,
      format: 'time',
      sub: `${ordenesHoy} órdenes hoy`,
    },
  ]
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'owner') {
    return jsonNoStore({ error: 'No autorizado' }, { status: 403 })
  }

  const range = resolveRange(req.nextUrl.searchParams)

  try {
    await ensureSchemaPatches()

    const hoy = ymd(new Date())
    // Para tendencias necesitamos 60 días reales mínimos.
    const minDesde = daysAgo(hoy, 59)
    const realPorFecha = await ingresosRealesPorFecha(minDesde, hoy)

    // Tickets simulados anclados a tus ingresos reales
    let tickets = generarTicketsRango({ desde: minDesde, hasta: hoy })
    tickets = anclarMontosAlRealPorDia(tickets, realPorFecha)

    // Filtramos tickets al rango solicitado para los blocks que dependen del rango.
    const ticketsRango = tickets.filter(
      (t) => t.fecha >= range.desde && t.fecha <= range.hasta
    )

    const salesTrend30 = buildSalesTrend30(realPorFecha, hoy)
    const weekCompare = buildWeekCompare(realPorFecha, hoy)
    const orderMix = buildOrderMix(tickets) // mix usa 60 días para ser estable
    const heatmap = buildHeatmap(tickets)
    const tops = buildTops(ticketsRango)
    const kpis = buildKpis({ tickets, hoy, ingresosReales: realPorFecha })

    // Comparativa horaria 8-10 vs 12-14 (semana en curso)
    const inicioSem = inicioSemanaLunes(hoy)
    const stats = { desayuno: { o: 0, bs: 0 }, almuerzo: { o: 0, bs: 0 } }
    for (const t of tickets) {
      if (t.fecha < inicioSem || t.fecha > hoy) continue
      const slot = t.turno === 'desayuno' ? stats.desayuno : stats.almuerzo
      slot.o += t.ordenes
      slot.bs += t.montoBs
    }

    const { alerts, insights } = buildAlertasInsights({
      tickets,
      hoy,
      ingresosRealesPorFecha: realPorFecha,
    })

    type DeudoresRow = { count: string; total_usd: string }
    const deudoresRows = (await sql`
      SELECT COUNT(*) AS count, COALESCE(SUM(saldo), 0) AS total_usd
      FROM (
        SELECT COALESCE(cons.total, 0) - COALESCE(pag.total, 0) AS saldo
        FROM clientes_deudores c
        LEFT JOIN (SELECT cliente_id, SUM(monto_usd) AS total FROM consumos_deudores GROUP BY cliente_id) cons ON cons.cliente_id = c.id
        LEFT JOIN (SELECT cliente_id, SUM(monto_usd) AS total FROM pagos_deudores GROUP BY cliente_id) pag ON pag.cliente_id = c.id
        WHERE c.activo = TRUE
      ) sub
      WHERE saldo > 0.001
    `) as unknown as DeudoresRow[]
    const deudoresRow = deudoresRows[0] ?? { count: '0', total_usd: '0' }

    const metrics: OwnerMetrics = {
      range,
      generadoEn: new Date().toISOString(),
      kpis,
      salesTrend30,
      weekCompare,
      orderMix,
      heatmap,
      topDesayuno: tops.topDesayuno,
      topAlmuerzo: tops.topAlmuerzo,
      topMargen: tops.topMargen,
      prepTime: { desayuno: 9, almuerzo: 17 }, // proxy estimado (min); ajustable
      alerts,
      insights,
      comparativaHoraria: {
        desayuno: {
          ordenes: stats.desayuno.o,
          ingresoBs: stats.desayuno.bs,
          ticketPromedio: stats.desayuno.o
            ? stats.desayuno.bs / stats.desayuno.o
            : 0,
        },
        almuerzo: {
          ordenes: stats.almuerzo.o,
          ingresoBs: stats.almuerzo.bs,
          ticketPromedio: stats.almuerzo.o
            ? stats.almuerzo.bs / stats.almuerzo.o
            : 0,
        },
      },
      deudores: {
        count: Number(deudoresRow.count),
        totalUsd: Math.round(Number(deudoresRow.total_usd) * 100) / 100,
      },
    }

    logDbOk('owner', 'metrics.get', {
      range: range.key,
      desde: range.desde,
      hasta: range.hasta,
      reales_dias: realPorFecha.size,
      tickets_60d: tickets.length,
    })

    return jsonNoStore(metrics)
  } catch (e: any) {
    logDbFail('owner', 'metrics.get', e, { ...range })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}
