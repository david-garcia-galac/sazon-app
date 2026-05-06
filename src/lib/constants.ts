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

export const FORMAS_PAGO_INGRESO = [
  { value: 'efectivo',    label: '💵 Efectivo' },
  { value: 'pago_movil',  label: '📱 Pago Móvil' },
]

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

export function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function inicioSemana(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

export function inicioMes(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function labelCategoria(value: string): string {
  return CATEGORIAS_EGRESO.find(c => c.value === value)?.label ?? value
}
