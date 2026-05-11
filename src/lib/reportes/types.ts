// Tipos compartidos por el módulo de reportes (cliente + servidor).

export type ReportType = 'ingresos' | 'egresos' | 'resumen'
export type ReportRange = 'diario' | 'semanal'

export interface ReportConfig {
  type: ReportType
  range: ReportRange
  desde: string // YYYY-MM-DD inclusivo
  hasta: string // YYYY-MM-DD inclusivo
}

export interface IngresoRow {
  id: string
  fecha: string
  tipo: string
  bebida: string | null
  cantidad: number
  cantidad_bebida: number
  monto: number
  moneda: 'BS' | 'USD'
  tasa: number | null
  monto_usd: number | null
  forma_pago: string
  notas: string | null
}

export interface EgresoRow {
  id: string
  fecha: string
  categoria: string
  proveedor: string | null
  descripcion: string | null
  monto: number
  moneda: 'BS' | 'USD'
  tasa: number | null
  monto_bs: number | null
  forma_pago: string
}

export interface Totales {
  ingresosBs: number
  ingresosUsd: number
  egresosBs: number
  egresosUsd: number
  saldoBs: number
  ventas: number
}

/** Payload consolidado que la página de reportes pinta y exporta. */
export interface ReportData {
  config: ReportConfig
  generadoEn: string
  ingresos: IngresoRow[]
  egresos: EgresoRow[]
  totales: Totales
}

/** Una entrada del historial local. */
export interface ReportHistoryItem {
  id: string
  createdAt: string
  config: ReportConfig
  filename: string
  /** URL pública (Cloudinary) si se subió para enviar por WhatsApp. */
  url?: string
  /** Teléfono al que se envió (E.164 sin "+"). */
  phone?: string
  /** Mensaje enviado junto al link. */
  message?: string
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  ingresos: 'Ingresos',
  egresos: 'Egresos',
  resumen: 'Resumen del día',
}

export const REPORT_RANGE_LABELS: Record<ReportRange, string> = {
  diario: 'Diario',
  semanal: 'Semanal',
}
