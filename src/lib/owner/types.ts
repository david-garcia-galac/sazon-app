/**
 * Tipos del módulo dueño (vista 30,000 pies).
 *
 * Lo que tu DB sí tiene: ingresos.monto, fecha, moneda, forma_pago, tipo (desayuno/almuerzo).
 * Lo que tu DB NO captura: producto específico, hora, cliente único, tiempo prep.
 *
 * → Los campos "no capturados" se generan vía mock.ts con seed estable. Cuando
 *   un día decidas capturarlos de verdad, el shape de salida no cambia.
 */

export type Turno = 'desayuno' | 'almuerzo'

export type RangeKey = 'hoy' | 'semana' | 'mes' | 'personalizado'

export interface OwnerRange {
  key: RangeKey
  desde: string // YYYY-MM-DD
  hasta: string
}

export interface Variation {
  value: number
  pct: number // -100..+inf
  direction: 'up' | 'down' | 'flat'
}

export interface Kpi {
  id: string
  label: string
  value: number
  format: 'bs' | 'usd' | 'int' | 'pct' | 'time'
  sub?: string
  variation?: Variation
  hint?: string
}

export interface SalesTrendPoint {
  fecha: string // YYYY-MM-DD
  total: number // Bs
  semanaActual?: boolean
}

export interface WeekCompareSeries {
  /** Día de la semana 0..6 (lun..dom). */
  diaSemana: number
  diaLabel: string
  estaSemana: number
  semanaAnterior: number
}

export interface OrderMixPoint {
  fecha: string
  desayuno: number
  almuerzo: number
}

export interface OrderMixSummary {
  totalDesayuno: number
  totalAlmuerzo: number
  pctDesayuno: number // 0..100
  pctAlmuerzo: number
  evolucion: OrderMixPoint[] // 14 días para gráfico tipo área apilada
}

export interface HeatmapCell {
  diaSemana: number // 0=Lun..6=Dom
  hora: number // 0..23
  /** 0..1 (normalizado dentro del set para colorear). */
  intensidad: number
  ordenes: number
  ingresoBs: number
}

export interface TopProduct {
  nombre: string
  pctOrdenes: number // 0..100 dentro de su turno
  ordenes: number
  ingresoBs: number
  margenIndex: number // proxy de "precio × popularidad" normalizado 0..100
}

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface OwnerAlert {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  metric?: string
  /** Valor crudo en bytes/Bs/etc para que el modal lo expanda. */
  context?: Record<string, unknown>
}

export interface OwnerInsight {
  id: string
  title: string
  body: string
  actionLabel?: string
}

export interface OwnerMetrics {
  range: OwnerRange
  generadoEn: string
  kpis: Kpi[]
  salesTrend30: SalesTrendPoint[]
  weekCompare: WeekCompareSeries[]
  orderMix: OrderMixSummary
  heatmap: HeatmapCell[]
  topDesayuno: TopProduct[]
  topAlmuerzo: TopProduct[]
  topMargen: TopProduct[]
  prepTime: { desayuno: number; almuerzo: number } // minutos
  alerts: OwnerAlert[]
  insights: OwnerInsight[]
  comparativaHoraria: {
    desayuno: { ordenes: number; ingresoBs: number; ticketPromedio: number }
    almuerzo: { ordenes: number; ingresoBs: number; ticketPromedio: number }
  }
}

export const TURNO_LABELS: Record<Turno, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
}

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
