/**
 * Motor de insights/alertas para el dueño.
 *
 * Las reglas son intencionalmente simples y transparentes — un dueño no
 * técnico tiene que entender por qué le aparece cada sugerencia.
 *
 * Inputs:
 *   - Tickets simulados/anclados (60 días).
 *   - Ventas reales agregadas por fecha (de tu DB).
 *
 * Output:
 *   - alerts[]    → cosas que requieren atención hoy.
 *   - insights[]  → sugerencias proactivas con acción concreta.
 */

import { DIAS_SEMANA, type OwnerAlert, type OwnerInsight } from './types'
import type { TicketFicticio } from './mock'

function fmtBs(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

interface BuildInsightsInput {
  tickets: TicketFicticio[]
  hoy: string // YYYY-MM-DD
  /** Ingresos reales por fecha en Bs (lo que tenemos en la tabla `ingresos`). */
  ingresosRealesPorFecha: Map<string, number>
}

/** Variación día vs media del mismo día de la semana en las últimas 4 semanas. */
function variacionVsSimilar(
  porFecha: Map<string, number>,
  hoy: string
): { current: number; baseline: number; pct: number } | null {
  const cur = porFecha.get(hoy)
  if (cur == null) return null
  const hoyD = new Date(`${hoy}T00:00:00`)
  const dow = (hoyD.getDay() + 6) % 7
  const muestra: number[] = []
  for (let k = 1; k <= 4; k++) {
    const ref = new Date(hoyD)
    ref.setDate(ref.getDate() - 7 * k)
    const dy = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`
    const v = porFecha.get(dy)
    if (v != null && (new Date(`${dy}T00:00:00`).getDay() + 6) % 7 === dow)
      muestra.push(v)
  }
  if (!muestra.length) return null
  const baseline = muestra.reduce((a, b) => a + b, 0) / muestra.length
  if (baseline === 0) return null
  return { current: cur, baseline, pct: ((cur - baseline) / baseline) * 100 }
}

/** Top productos en ventana de N días por turno. */
function topProductoCaida(
  tickets: TicketFicticio[],
  hoy: string,
  diasRecientes: number,
  diasPrevios: number
): { producto: string; turno: string; pctCaida: number } | null {
  const cutHoy = new Date(`${hoy}T00:00:00`)
  const cutPrev = new Date(cutHoy)
  cutPrev.setDate(cutPrev.getDate() - diasRecientes)
  const cutPrev2 = new Date(cutPrev)
  cutPrev2.setDate(cutPrev2.getDate() - diasPrevios)

  const agg = new Map<string, { reciente: number; previo: number; turno: string }>()
  for (const t of tickets) {
    const d = new Date(`${t.fecha}T00:00:00`)
    const key = `${t.producto}__${t.turno}`
    const slot = agg.get(key) ?? { reciente: 0, previo: 0, turno: t.turno }
    if (d > cutPrev && d <= cutHoy) slot.reciente += t.ordenes
    else if (d > cutPrev2 && d <= cutPrev) slot.previo += t.ordenes
    agg.set(key, slot)
  }
  let peor: { producto: string; turno: string; pctCaida: number } | null = null
  agg.forEach((v, key) => {
    if (v.previo < 20) return
    const caida = ((v.previo - v.reciente) / v.previo) * 100
    if (caida > (peor?.pctCaida ?? 15)) {
      const producto = key.split('__')[0]
      peor = { producto, turno: v.turno, pctCaida: caida }
    }
  })
  return peor
}

/** Clientes únicos por día (simulación). */
function clientesUnicosPorDia(tickets: TicketFicticio[]): Map<string, number> {
  const map = new Map<string, Set<string>>()
  for (const t of tickets) {
    if (!map.has(t.fecha)) map.set(t.fecha, new Set())
    map.get(t.fecha)!.add(t.clienteHash)
  }
  const out = new Map<string, number>()
  map.forEach((v, k) => out.set(k, v.size))
  return out
}

function caidaDosDiasSeguidos(porFecha: Map<string, number>, hoy: string): boolean {
  const hoyD = new Date(`${hoy}T00:00:00`)
  const d1 = new Date(hoyD); d1.setDate(d1.getDate() - 1)
  const d2 = new Date(hoyD); d2.setDate(d2.getDate() - 2)
  const d3 = new Date(hoyD); d3.setDate(d3.getDate() - 3)
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const v1 = porFecha.get(ymd(d1)) ?? null
  const v2 = porFecha.get(ymd(d2)) ?? null
  const v3 = porFecha.get(ymd(d3)) ?? null
  if (v1 == null || v2 == null || v3 == null) return false
  return v1 < v2 && v2 < v3
}

/** Día de la semana donde un producto vende mucho menos que su promedio. */
function diaConBajoRendimiento(tickets: TicketFicticio[]): {
  producto: string
  diaLabel: string
  pctMenor: number
  turno: string
} | null {
  const agg = new Map<
    string,
    { porDow: number[]; total: number; turno: string }
  >()
  for (const t of tickets) {
    const key = `${t.producto}__${t.turno}`
    const cur = agg.get(key) ?? { porDow: new Array(7).fill(0), total: 0, turno: t.turno }
    cur.porDow[t.diaSemana] += t.ordenes
    cur.total += t.ordenes
    agg.set(key, cur)
  }
  let peor: {
    producto: string
    diaLabel: string
    pctMenor: number
    turno: string
  } | null = null
  agg.forEach((v, key) => {
    if (v.total < 60) return
    const avg = v.total / 7
    for (let i = 0; i < 7; i++) {
      const pct = ((avg - v.porDow[i]) / avg) * 100
      if (pct > (peor?.pctMenor ?? 25)) {
        peor = {
          producto: key.split('__')[0],
          diaLabel: DIAS_SEMANA[i],
          pctMenor: pct,
          turno: v.turno,
        }
      }
    }
  })
  return peor
}

export function buildAlertasInsights(
  input: BuildInsightsInput
): { alerts: OwnerAlert[]; insights: OwnerInsight[] } {
  const { tickets, hoy, ingresosRealesPorFecha } = input
  const alerts: OwnerAlert[] = []
  const insights: OwnerInsight[] = []

  // ── Alertas ─────────────────────────────────────────────────────────────

  // 1) Ajuste de precio: ingreso hoy vs misma fecha hace 7 días.
  const cmp = variacionVsSimilar(ingresosRealesPorFecha, hoy)
  if (cmp && Math.abs(cmp.pct) >= 15) {
    alerts.push({
      id: 'ingreso-vs-semana',
      severity: cmp.pct < 0 ? 'warning' : 'info',
      title:
        cmp.pct < 0
          ? `Ingresos de hoy están ${Math.abs(cmp.pct).toFixed(0)}% por debajo del promedio del mismo día`
          : `Ingresos de hoy están ${cmp.pct.toFixed(0)}% por encima del promedio del mismo día`,
      detail:
        cmp.pct < 0
          ? `Hoy llevás Bs ${fmtBs(cmp.current)} contra un promedio de Bs ${fmtBs(cmp.baseline)} en las últimas 4 semanas para este día. Revisá si hubo cambios de precio o quiebres de producto.`
          : `Hoy llevás Bs ${fmtBs(cmp.current)} contra un promedio de Bs ${fmtBs(cmp.baseline)} en las últimas 4 semanas. ¡Buen ritmo!`,
      metric: 'ingresos_hoy',
      context: { current: cmp.current, baseline: cmp.baseline, pct: cmp.pct },
    })
  }

  // 2) Producto top 3 cae en ventas (últimos 7 días vs 7 anteriores).
  const caida = topProductoCaida(tickets, hoy, 7, 7)
  if (caida && caida.pctCaida >= 20) {
    alerts.push({
      id: 'producto-cae',
      severity: 'warning',
      title: `${caida.producto} cayó ${caida.pctCaida.toFixed(0)}% esta semana`,
      detail: `Las órdenes de "${caida.producto}" (${caida.turno}) cayeron versus la semana anterior. Considerá ofrecerlo como combo o destacarlo en cartelera durante el turno.`,
      metric: 'producto_caida',
      context: caida as unknown as Record<string, unknown>,
    })
  }

  // 3) Clientes únicos disminuyen 2 días seguidos.
  const clientes = clientesUnicosPorDia(tickets)
  if (caidaDosDiasSeguidos(clientes, hoy)) {
    alerts.push({
      id: 'clientes-bajando',
      severity: 'critical',
      title: 'Clientes únicos bajan por más de 2 días seguidos',
      detail: 'Considerá enviar promo por WhatsApp o activar happy-hour de bebidas el próximo turno.',
      metric: 'clientes_unicos',
    })
  }

  // ── Insights ────────────────────────────────────────────────────────────

  // a) Día con bajo rendimiento → sugerir promoción
  const baja = diaConBajoRendimiento(tickets)
  if (baja) {
    insights.push({
      id: 'dia-baja-promo',
      title: `Los ${baja.diaLabel} de ${baja.turno} venden ${baja.pctMenor.toFixed(0)}% menos ${baja.producto}`,
      body: `Probá una promo de ${baja.producto} solo los ${baja.diaLabel} (combo + bebida con descuento) para recuperar esa franja.`,
      actionLabel: 'Programar promo',
    })
  }

  // b) Franja muerta 10:30 → brunch de fin de semana
  insights.push({
    id: 'brunch-finde',
    title: 'La franja 10–11 am vende poco (transición desayuno → almuerzo)',
    body:
      'Si tu local lo permite, probá un "brunch finde" sáb/dom para esa hora: huevos pericos + arepa + jugo. Bajo coste de prep, alto ticket promedio.',
    actionLabel: 'Diseñar brunch',
  })

  // c) Top producto del turno + sugerencia de stock para el día de mayor demanda
  const conteoPorDow = new Map<string, number[]>()
  for (const t of tickets) {
    if (t.turno !== 'desayuno') continue
    const cur = conteoPorDow.get(t.producto) ?? new Array(7).fill(0)
    cur[t.diaSemana] += t.ordenes
    conteoPorDow.set(t.producto, cur)
  }
  let mejor: { producto: string; dia: number; ordenes: number } | null = null
  conteoPorDow.forEach((arr, p) => {
    for (let i = 0; i < 7; i++) {
      if (arr[i] > (mejor?.ordenes ?? 0))
        mejor = { producto: p, dia: i, ordenes: arr[i] }
    }
  })
  if (mejor) {
    insights.push({
      id: 'stock-finde',
      title: `Los ${DIAS_SEMANA[mejor.dia]} se pide mucho ${mejor.producto} en desayuno`,
      body: `Aumentá la preparación de ${mejor.producto.toLowerCase()} para los ${DIAS_SEMANA[mejor.dia]}: en los últimos 60 días se vendieron ${mejor.ordenes} unidades sólo ese día.`,
      actionLabel: 'Ajustar prep',
    })
  }

  // d) Recordatorio fiscal (encajado en la app)
  insights.push({
    id: 'reporte-semanal',
    title: 'Generá el reporte de la semana y mandalo por WhatsApp',
    body:
      'Tenés un módulo de reportes en PDF listo. Mandalo a tu contadora todos los lunes 8 am para cerrar la semana.',
    actionLabel: 'Ir a reportes',
  })

  return { alerts, insights }
}
