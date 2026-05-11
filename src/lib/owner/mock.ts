/**
 * Generador determinístico de tickets ficticios.
 *
 * Por qué determinístico:
 *  - El owner abre el panel a las 9 am y luego a las 10 am: los números deben
 *    ser estables, no aleatorios cada refresh. Logramos eso seed-eando por
 *    (fecha + slot horario), no por Math.random().
 *
 * Patrón de estacionalidad simulado:
 *  - Picos 8-10 h (desayuno) y 12-14 h (almuerzo).
 *  - Sábado y domingo +30% vs día de semana.
 *  - Lunes -15% (vuelta al trabajo, baja).
 *  - Por mes, leve crecimiento +0.5%/día (tendencia positiva).
 */

import type { Turno } from './types'

// ─── Catálogo de productos por turno (no es tu menú real; podés ajustarlo) ───
export const PRODUCTOS_DESAYUNO = [
  'Empanada de carne',
  'Empanada de queso',
  'Empanada de pollo',
  'Cachito de jamón',
  'Pastelito mixto',
  'Calentado paisa',
  'Arepa de queso',
] as const

export const PRODUCTOS_ALMUERZO = [
  'Pabellón criollo',
  'Asado negro con arroz',
  'Pollo guisado',
  'Pescado frito',
  'Sobrebarra de lentejas',
  'Pasticho casero',
  'Sopa del día',
] as const

export interface TicketFicticio {
  fecha: string // YYYY-MM-DD
  hora: number // 0..23
  diaSemana: number // 0=Lun..6=Dom
  turno: Turno
  producto: string
  bebida: string | null
  ordenes: number // cantidad de items en el ticket
  montoBs: number
  clienteHash: string // pseudo identificador para "clientes únicos"
}

// ─── PRNG seedable (mulberry32) ──────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function gauss(rng: () => number, mu: number, sigma: number): number {
  // Box–Muller
  const u = Math.max(rng(), 1e-9)
  const v = rng()
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 0=lunes ... 6=domingo */
function dowLunes0(d: Date): number {
  const js = d.getDay()
  return (js + 6) % 7
}

// ─── Curvas de demanda ───────────────────────────────────────────────────────

function factorDia(diaSemana: number): number {
  if (diaSemana === 5 || diaSemana === 6) return 1.3 // sáb/dom
  if (diaSemana === 0) return 0.85 // lunes
  return 1.0
}

function curvaHora(turno: Turno, hora: number): number {
  if (turno === 'desayuno') {
    if (hora === 8) return 1.0
    if (hora === 9) return 0.95
    if (hora === 7) return 0.55
    if (hora === 10) return 0.45
    return 0
  }
  if (hora === 12) return 1.0
  if (hora === 13) return 0.95
  if (hora === 14) return 0.6
  if (hora === 15) return 0.25
  return 0
}

const HORAS_DESAYUNO = [7, 8, 9, 10]
const HORAS_ALMUERZO = [12, 13, 14, 15]

// ─── Generación ──────────────────────────────────────────────────────────────

export interface GenerarOpts {
  /** YYYY-MM-DD inclusivo (default: hoy − 59) */
  desde: string
  /** YYYY-MM-DD inclusivo (default: hoy) */
  hasta: string
  /** Semilla global; default: una basada en "sazon" para reproducibilidad. */
  globalSeed?: number
  /** Volumen base por día (ajustá según realidad esperada). */
  ordenesDiaBase?: number
}

/** Genera tickets ficticios para el rango pedido. */
export function generarTicketsRango(opts: GenerarOpts): TicketFicticio[] {
  const desde = new Date(`${opts.desde}T00:00:00`)
  const hasta = new Date(`${opts.hasta}T00:00:00`)
  const globalSeed = opts.globalSeed ?? hashStr('sazon-amparo-2026')
  const base = opts.ordenesDiaBase ?? 65

  const tickets: TicketFicticio[] = []

  for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
    const fecha = ymd(d)
    const dow = dowLunes0(d)
    const factor = factorDia(dow)

    // Tendencia leve creciente día a día (+0.5%/día desde el inicio del rango).
    const trend =
      1 +
      Math.max(0, (d.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24)) * 0.005

    for (const turno of ['desayuno', 'almuerzo'] as Turno[]) {
      const horas = turno === 'desayuno' ? HORAS_DESAYUNO : HORAS_ALMUERZO
      // total estimado de órdenes del turno (Bell shape sobre las horas pico)
      const ordenesTurnoBase =
        (turno === 'desayuno' ? 0.45 : 0.55) * base * factor * trend
      const rngDay = mulberry32((globalSeed ^ hashStr(fecha + turno)) >>> 0)
      const ordenesTurno = Math.max(
        4,
        Math.round(gauss(rngDay, ordenesTurnoBase, ordenesTurnoBase * 0.08))
      )

      // Distribuimos por hora según curva.
      for (const h of horas) {
        const peso = curvaHora(turno, h)
        if (peso <= 0) continue
        const ordenesHora = Math.max(0, Math.round(ordenesTurno * peso / 2.95))

        for (let i = 0; i < ordenesHora; i++) {
          const rngT = mulberry32(
            (globalSeed ^ hashStr(fecha + turno + h + ':' + i)) >>> 0
          )
          const producto =
            turno === 'desayuno'
              ? pick(rngT, PRODUCTOS_DESAYUNO)
              : pick(rngT, PRODUCTOS_ALMUERZO)
          const items = Math.max(1, Math.round(gauss(rngT, 1.6, 0.5)))
          const ticketBs =
            turno === 'desayuno'
              ? Math.round(gauss(rngT, 220, 40) * items)
              : Math.round(gauss(rngT, 420, 70) * items)

          tickets.push({
            fecha,
            hora: h,
            diaSemana: dow,
            turno,
            producto,
            bebida: rngT() < 0.7 ? (rngT() < 0.5 ? 'Jugo natural' : 'Refresco') : null,
            ordenes: items,
            montoBs: Math.max(120, ticketBs),
            // "cliente único" simulado: hash de hora+slot+fecha (no estamos
            // capturando clientes reales, esto solo da una métrica simulada).
            clienteHash: `c${(hashStr(fecha + h + ':' + Math.floor(i / 1.5))).toString(36).slice(0, 6)}`,
          })
        }
      }
    }
  }

  return tickets
}

/**
 * Si tenés ingresos reales para el rango, llamamos a esta función para
 * "anclar" los totales del mock a los reales (re-escala el monto). Productos,
 * horas y tickets quedan simulados, pero los totales por día sí coinciden con
 * tus ventas reales — útil para que el owner reconozca sus números.
 */
export function anclarMontosAlRealPorDia(
  tickets: TicketFicticio[],
  ingresosRealesPorFecha: Map<string, number>
): TicketFicticio[] {
  // Sumamos lo mock por fecha → ratio = real/mock para esa fecha; lo aplicamos
  // a cada ticket de esa fecha.
  const totalesMockPorFecha = new Map<string, number>()
  for (const t of tickets) {
    totalesMockPorFecha.set(t.fecha, (totalesMockPorFecha.get(t.fecha) ?? 0) + t.montoBs)
  }
  return tickets.map((t) => {
    const real = ingresosRealesPorFecha.get(t.fecha)
    const mockTotal = totalesMockPorFecha.get(t.fecha) ?? 0
    if (!real || mockTotal === 0) return t
    const ratio = real / mockTotal
    return { ...t, montoBs: Math.round(t.montoBs * ratio) }
  })
}
