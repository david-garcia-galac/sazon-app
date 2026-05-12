export const CATEGORIAS_EGRESO = [
  { value: 'verduleria',    label: '🥬 Verdulería' },
  { value: 'carniceria',   label: '🥩 Carnicería' },
  { value: 'almacen',      label: '🏪 Almacén' },
  { value: 'queso',        label: '🧀 Queso' },
  { value: 'bebidas',      label: '🥤 Bebidas' },
  { value: 'polar_harina', label: '🌾 Polar Harina Pan' },
  { value: 'aceite',       label: '🫒 Proveedor Aceite' },
  { value: 'luz',          label: '💡 Luz' },
  { value: 'agua',         label: '💧 Agua' },
  { value: 'condominio',   label: '🏢 Condominio' },
  { value: 'alquiler',     label: '🏠 Alquiler' },
  { value: 'empleados',    label: '👷 Sueldos' },
  { value: 'impuestos',    label: '🧾 Impuestos' },
  { value: 'otros',        label: '📦 Otros' },
]

export const BEBIDAS = [
  { value: 'coca_cola',     label: 'Coca-Cola' },
  { value: 'jugo_natural',  label: 'Jugo Natural' },
  { value: 'malta',         label: 'Malta' },
  { value: 'agua',          label: 'Agua' },
  { value: 'sin_bebida',    label: 'Sin bebida' },
]

/** Solo ingresos en bolívares (+ divisa USD) */
export const FORMAS_PAGO_INGRESO_BS = [
  { value: 'efectivo',       label: '💵 Efectivo (Bs)' },
  { value: 'pago_movil',    label: '📱 Pago Móvil' },
  { value: 'transferencia', label: '💳 Punto de Venta' },
  { value: 'divisa',        label: '🟢 Divisa USD' },
]

/** Compat: todos los métodos BS (uso en listados/filtros) */
export const FORMAS_PAGO_INGRESO = FORMAS_PAGO_INGRESO_BS

export const FORMAS_PAGO_EGRESO = [
  { value: 'efectivo',      label: '💵 Efectivo' },
  { value: 'pago_movil',   label: '📱 Pago Móvil' },
  { value: 'transferencia', label: '🏦 Transferencia' },
]

export const MONEDAS = [
  { value: 'BS',  label: 'Bolívares (Bs)' },
  { value: 'USD', label: 'Dólares (USD)' },
]

export function formatBs(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + ' Bs'
}

export function formatUSD(n: number): string {
  return '$' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/**
 * Interpreta montos escritos con coma o punto decimal (`36,5`, `12.50`).
 * Si hay ambos, el que aparece último es el separador decimal (ej. `1.234,56` o `1,234.56`).
 */
export function parseDecimalInput(raw: string): number {
  let s = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
  if (!s) return NaN
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    s = s.replace(',', '.')
  }
  return parseFloat(s)
}

/** Fecha calendario local YYYY-MM-DD (alinea listados y `<input type="date">`; evita desfases con UTC). */
export function fechaLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function hoy(): string {
  return fechaLocal(new Date())
}

/** Lunes de la semana actual (fecha local). */
export function inicioSemana(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return fechaLocal(d)
}

export function inicioMes(): string {
  const d = new Date()
  return fechaLocal(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function labelCategoria(value: string): string {
  return CATEGORIAS_EGRESO.find(c => c.value === value)?.label ?? value
}

export type ProductoCatalog = {
  id: string
  name: string
  emoji: string
  price: number
}

export const PRODUCTOS_DEFAULT: ProductoCatalog[] = [
  { id: 'refresco_350ml',    name: 'Refresco 350ml',        emoji: '🥤', price: 590 },
  { id: 'jugo_valle_500ml',  name: 'Jugo del Valle 500ml',  emoji: '🧃', price: 720 },
  { id: 'malta_botella',     name: 'Malta botella 222ml',   emoji: '🍺', price: 580 },
  { id: 'fruton',            name: 'Fruton',                 emoji: '🍹', price: 560 },
  { id: 'justy_400ml',       name: 'Justy 400ml',           emoji: '🧃', price: 580 },
  { id: 'malta_desechable',  name: 'Malta desechable 250ml',emoji: '🍺', price: 690 },
  { id: 'malta_lata_355ml',  name: 'Malta lata 355ml',      emoji: '🍺', price: 700 },
  { id: 'agua_pequena',      name: 'Agua pequeña 355ml',    emoji: '💧', price: 250 },
  { id: 'agua_grande',       name: 'Agua grande 600ml',     emoji: '💧', price: 500 },
  { id: 'jugo_natural',      name: 'Jugo natural',           emoji: '🥤', price: 590 },
  { id: 'energizante_400ml', name: 'Energizante 400ml',     emoji: '⚡', price: 600 },
  { id: 'galleta_club',      name: 'Galleta Club Social',   emoji: '🍪', price: 290 },
  { id: 'caramelos',         name: 'Caramelos',             emoji: '🍬', price: 25  },
]

export function labelBebida(value: string, catalog?: ProductoCatalog[]): string {
  if (!value) return 'Sin bebida'
  if (catalog) {
    const prod = catalog.find((p) => p.id === value)
    if (prod) return prod.name
  }
  return BEBIDAS.find((b) => b.value === value)?.label ?? value.replace(/_/g, ' ')
}

/** Fecha desde API Postgres (DATE o ISO); evita "Invalid Date" al concatenar T12 sobre ISO completo */
export function formatoFechaLista(fecha: unknown): string {
  if (fecha == null) return '—'
  const raw = String(fecha)
  const ymd =
    raw.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(raw)
      ? raw.slice(0, 10)
      : ''
  if (!ymd) return '—'
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}
