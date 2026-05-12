import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface SazonDB extends DBSchema {
  ingresos: {
    key: string
    value: Ingreso
    indexes: { 'by-fecha': string; 'by-sync': number }
  }
  egresos: {
    key: string
    value: Egreso
    indexes: { 'by-fecha': string; 'by-sync': number }
  }
  proveedores: {
    key: string
    value: Proveedor
    indexes: { 'by-sync': number }
  }
  deudas: {
    key: string
    value: DeudaProveedor
    indexes: { 'by-proveedor': string; 'by-sync': number }
  }
  pagos: {
    key: string
    value: PagoProveedor
    indexes: { 'by-deuda': string; 'by-sync': number }
  }
  inventario: {
    key: string
    value: ItemInventario
    indexes: { 'by-categoria': string }
  }
  movimientos_inv: {
    key: string
    value: MovimientoInventario
    indexes: { 'by-item': string }
  }
  tasa_cambio: {
    key: string
    value: TasaCambio
    indexes: { 'by-fecha': string }
  }
  sync_queue: {
    key: string
    value: SyncItem
    indexes: { 'by-ts': number }
  }
}

export interface Ingreso {
  id: string
  fecha: string
  tipo: 'desayuno' | 'almuerzo' | 'bebida'
  bebida?: string
  cantidad: number
  cantidad_bebida?: number
  monto: number
  moneda: 'BS' | 'USD'
  tasa?: number | null
  monto_usd?: number | null
  forma_pago: 'efectivo' | 'pago_movil' | 'transferencia' | 'divisa'
  notas?: string
  created_at: string
  updated_at: string
  _synced?: number
  _deleted?: boolean
}

export interface Egreso {
  id: string
  fecha: string
  categoria: string
  proveedor?: string
  descripcion?: string
  monto: number
  moneda: 'BS' | 'USD'
  tasa?: number
  monto_bs?: number
  forma_pago: string
  foto_url?: string
  foto_public_id?: string
  proveedor_id?: string
  created_at: string
  updated_at: string
  _synced?: number
  _deleted?: boolean
}

export interface Proveedor {
  id: string
  nombre: string
  categoria?: string
  telefono?: string
  tiene_credito: boolean
  notas?: string
  created_at: string
  _synced?: number
}

export interface DeudaProveedor {
  id: string
  proveedor_id: string
  egreso_id?: string
  monto_total: number
  monto_pagado: number
  moneda: string
  fecha_compra: string
  fecha_vencimiento?: string
  estado: 'pendiente' | 'parcial' | 'pagado'
  notas?: string
  created_at: string
  updated_at: string
  _synced?: number
}

export interface PagoProveedor {
  id: string
  deuda_id: string
  monto: number
  fecha: string
  forma_pago: string
  comprobante_url?: string
  notas?: string
  created_at: string
  _synced?: number
}

export interface ItemInventario {
  id: string
  nombre: string
  categoria: 'desayuno' | 'almuerzo' | 'general'
  unidad: string
  stock_actual: number
  stock_minimo: number
  notas?: string
  updated_at: string
}

export interface MovimientoInventario {
  id: string
  inventario_id: string
  tipo: 'compra' | 'consumo' | 'ajuste'
  cantidad: number
  fecha: string
  notas?: string
  created_at: string
}

export interface TasaCambio {
  id: string
  fecha: string
  tasa_bs: number
  created_at: string
}

export interface SyncItem {
  id: string
  tabla: string
  accion: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  ts: number
}

let dbInstance: IDBPDatabase<SazonDB> | null = null

export async function getDB(): Promise<IDBPDatabase<SazonDB>> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<SazonDB>('sazon-db', 1, {
    upgrade(db) {
      // ingresos
      const ingStore = db.createObjectStore('ingresos', { keyPath: 'id' })
      ingStore.createIndex('by-fecha', 'fecha')
      ingStore.createIndex('by-sync', '_synced')

      // egresos
      const egStore = db.createObjectStore('egresos', { keyPath: 'id' })
      egStore.createIndex('by-fecha', 'fecha')
      egStore.createIndex('by-sync', '_synced')

      // proveedores
      const provStore = db.createObjectStore('proveedores', { keyPath: 'id' })
      provStore.createIndex('by-sync', '_synced')

      // deudas
      const deudaStore = db.createObjectStore('deudas', { keyPath: 'id' })
      deudaStore.createIndex('by-proveedor', 'proveedor_id')
      deudaStore.createIndex('by-sync', '_synced')

      // pagos
      const pagoStore = db.createObjectStore('pagos', { keyPath: 'id' })
      pagoStore.createIndex('by-deuda', 'deuda_id')
      pagoStore.createIndex('by-sync', '_synced')

      // inventario
      const invStore = db.createObjectStore('inventario', { keyPath: 'id' })
      invStore.createIndex('by-categoria', 'categoria')

      // movimientos_inv
      const movStore = db.createObjectStore('movimientos_inv', { keyPath: 'id' })
      movStore.createIndex('by-item', 'inventario_id')

      // tasa_cambio
      const tasaStore = db.createObjectStore('tasa_cambio', { keyPath: 'id' })
      tasaStore.createIndex('by-fecha', 'fecha')

      // sync_queue
      const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' })
      syncStore.createIndex('by-ts', 'ts')
    },
  })
  return dbInstance
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Helpers genéricos ─────────────────────────────────
export async function dbGetAll<T extends keyof SazonDB>(
  store: T
): Promise<SazonDB[T]['value'][]> {
  const db = await getDB()
  const all = await db.getAll(store as any)
  return (all as SazonDB[T]['value'][]).filter((i: any) => !i._deleted)
}

export async function dbGet<T extends keyof SazonDB>(
  store: T,
  id: string
): Promise<SazonDB[T]['value'] | undefined> {
  const db = await getDB()
  return db.get(store as any, id) as Promise<SazonDB[T]['value'] | undefined>
}

export async function dbPut<T extends keyof SazonDB>(
  store: T,
  value: SazonDB[T]['value']
): Promise<void> {
  const db = await getDB()
  await db.put(store as any, value)
  // add to sync queue
  await addToSyncQueue(store as any, 'create', value as Record<string, unknown>)
}

export async function dbDelete<T extends keyof SazonDB>(
  store: T,
  id: string
): Promise<void> {
  const db = await getDB()
  const item = await db.get(store as any, id) as any
  if (item) {
    item._deleted = true
    item.updated_at = new Date().toISOString()
    await db.put(store as any, item)
    await addToSyncQueue(store as any, 'delete', { id })
  }
}

async function addToSyncQueue(
  tabla: string,
  accion: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>
): Promise<void> {
  const db = await getDB()
  const item: SyncItem = {
    id: generateId(),
    tabla,
    accion,
    payload,
    ts: Date.now(),
  }
  await db.put('sync_queue', item)
}

/** Cola hacia Postgres (solo columnas de tabla; sin campos IndexedDB locales). */
export async function enqueueSync(
  tabla: string,
  accion: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>
): Promise<void> {
  const copy = { ...payload }
  delete copy._synced
  delete copy._deleted
  await addToSyncQueue(tabla, accion, copy)
}

export async function getSyncQueue(): Promise<SyncItem[]> {
  const db = await getDB()
  return db.getAllFromIndex('sync_queue', 'by-ts')
}

export async function clearSyncItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('sync_queue', id)
}

// ── Ingresos ──────────────────────────────────────────
export async function getIngresosByFecha(desde: string, hasta: string) {
  const db = await getDB()
  const all = await db.getAllFromIndex('ingresos', 'by-fecha')
  return all.filter(i => !i._deleted && i.fecha >= desde && i.fecha <= hasta)
}

// ── Egresos ───────────────────────────────────────────
export async function getEgresosByFecha(desde: string, hasta: string) {
  const db = await getDB()
  const all = await db.getAllFromIndex('egresos', 'by-fecha')
  return all.filter(e => !e._deleted && e.fecha >= desde && e.fecha <= hasta)
}

// ── Tasa ──────────────────────────────────────────────
export async function getUltimaTasa(): Promise<TasaCambio | undefined> {
  const db = await getDB()
  const all = await db.getAllFromIndex('tasa_cambio', 'by-fecha')
  return all[all.length - 1]
}

export async function saveTasa(tasa: number): Promise<void> {
  const db = await getDB()
  const hoy = new Date().toISOString().slice(0, 10)
  const existing = await db.getAllFromIndex('tasa_cambio', 'by-fecha')
  const todayTasa = existing.find(t => t.fecha === hoy)
  const item: TasaCambio = {
    id: todayTasa?.id ?? generateId(),
    fecha: hoy,
    tasa_bs: tasa,
    created_at: new Date().toISOString(),
  }
  await db.put('tasa_cambio', item)
}
