'use client'
import { useEffect, useState, useCallback, Suspense, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, CheckSquare, Square, XCircle } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import {
  Modal, Toast, useToast, ConfirmDialog,
  EmptyState, LoadingSpinner, SelectField, InputField
} from '@/components/ui'
import {
  FORMAS_PAGO_INGRESO_BS,
  MONEDAS,
  formatBs,
  formatUSD,
  fechaLocal,
  formatoFechaLista,
  hoy,
  labelBebida,
  parseDecimalInput,
  PRODUCTOS_DEFAULT,
} from '@/lib/constants'
import type { ProductoCatalog } from '@/lib/constants'
import { generateId } from '@/lib/idb'
import type { Ingreso } from '@/lib/idb'

type PreciosCfg = {
  empanada_bs: number
  tasa_bcv: number | null
  precios_bebidas: Record<string, number>
  productos_catalog: ProductoCatalog[]
}

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({ emoji, imageSrc, name, desc, price, quantity, onAdd, onRemove }: {
  emoji: string; imageSrc?: string; name: string; desc: string; price: string
  quantity: number; onAdd: () => void; onRemove: () => void
}) {
  return (
    <div className={`rounded-2xl border-2 p-3 transition-colors ${quantity > 0 ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-white shadow-sm'}`}>
      {imageSrc
        ? <img src={imageSrc} alt={name} className="w-12 h-12 object-contain mb-2" />
        : <div className="text-3xl mb-2">{emoji}</div>
      }
      <p className="font-bold text-sm text-gray-800 leading-tight">{name}</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-1.5 leading-snug">{desc}</p>
      <p className="text-xs font-bold text-brand-orange mb-3">{price}</p>
      {quantity === 0 ? (
        <button type="button" onClick={onAdd}
          className="w-full py-2 rounded-xl bg-orange-500 text-white text-sm font-bold active:scale-95 transition-transform">
          Agregar
        </button>
      ) : (
        <div className="flex items-center justify-between bg-white rounded-xl px-1 py-1">
          <button type="button" onClick={onRemove}
            className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 font-bold text-xl flex items-center justify-center active:scale-90 transition-transform">
            −
          </button>
          <span className="font-bold text-gray-700 text-base tabular-nums">{quantity}</span>
          <button type="button" onClick={onAdd}
            className="w-8 h-8 rounded-lg bg-orange-500 text-white font-bold text-xl flex items-center justify-center active:scale-90 transition-transform">
            +
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function etiquetaFormaIngreso(fp: string, moneda?: string): { icon: string; label: string } {
  if (fp === 'divisa' || moneda === 'USD') return { icon: '🟢', label: 'Divisa USD' }
  switch (fp) {
    case 'pago_movil':    return { icon: '📱', label: 'Pago móvil' }
    case 'transferencia': return { icon: '💳', label: 'Punto de Venta' }
    default:              return { icon: '💵', label: 'Efectivo' }
  }
}

function chipTipo(tipo: string) {
  if (tipo === 'desayuno') return { cls: 'chip-amber',  lbl: '🥟 Empanadas' }
  if (tipo === 'almuerzo') return { cls: 'chip-orange', lbl: '☀️ Almuerzo'  }
  return                          { cls: 'chip-blue',   lbl: '🥤 Bebida'    }
}

// IDs de productos predeterminados (para ordenar: default primero, custom al final)
const DEFAULT_PRODUCT_IDS = new Set(PRODUCTOS_DEFAULT.map(p => p.id))

// ── Cart types ────────────────────────────────────────────────────────────────

type CartState = {
  fecha: string
  empanadas: number
  almuerzo: number
  almuerzoMonto: string
  bebidas: Record<string, number>
  moneda: 'BS' | 'USD'           // 'USD' only for editing legacy records
  tasa: string                   // only for legacy USD edit
  montoUsd: string               // only for legacy USD edit
  recibidoUsd: string            // new divisa: amount client paid
  vueltoUsd: string              // new divisa: change given back
  forma_pago: string
  notas: string
}

const emptyCart = (): CartState => ({
  fecha: hoy(),
  empanadas: 0,
  almuerzo: 0,
  almuerzoMonto: '',
  bebidas: {},
  moneda: 'BS',
  tasa: '',
  montoUsd: '',
  recibidoUsd: '',
  vueltoUsd: '',
  forma_pago: 'efectivo',
  notas: '',
})

// ── Page ──────────────────────────────────────────────────────────────────────

function IngresosInner() {
  const [ingresos, setIngresos]   = useState<Ingreso[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<Ingreso | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [filtro, setFiltro]       = useState<'hoy' | 'semana' | 'mes' | 'todo'>('hoy')
  const [preciosCfg, setPreciosCfg] = useState<PreciosCfg | null>(null)
  const [cart, setCart]           = useState<CartState>(emptyCart)
  // Bulk delete
  const [selMode, setSelMode]     = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const { toast, show }           = useToast()
  const searchParams              = useSearchParams()
  const router                    = useRouter()

  // ── Sorted catalog: default products first, custom last ─────────────────────

  const sortedCatalog = useMemo(() => {
    const cat = preciosCfg?.productos_catalog ?? []
    const defaults = cat.filter(p => DEFAULT_PRODUCT_IDS.has(p.id))
    const custom   = cat.filter(p => !DEFAULT_PRODUCT_IDS.has(p.id))
    return [...defaults, ...custom]
  }, [preciosCfg?.productos_catalog])

  // ── Computed ────────────────────────────────────────────────────────────────

  const isDivisaMode = cart.forma_pago === 'divisa' && cart.moneda === 'BS'

  const autoTotalBs = useMemo(() => {
    if (!preciosCfg || cart.moneda !== 'BS' || isDivisaMode) return 0
    let t = cart.empanadas * preciosCfg.empanada_bs
    if (cart.almuerzo > 0) t += parseDecimalInput(cart.almuerzoMonto) || 0
    for (const [id, qty] of Object.entries(cart.bebidas)) {
      if (qty <= 0) continue
      const prod = preciosCfg.productos_catalog.find(p => p.id === id)
      t += (prod?.price ?? 0) * qty
    }
    return t
  }, [cart.empanadas, cart.almuerzo, cart.almuerzoMonto, cart.bebidas, cart.moneda, preciosCfg, isDivisaMode])

  const hasItems = cart.empanadas > 0 || cart.almuerzo > 0 ||
    Object.values(cart.bebidas).some(q => q > 0)

  const netUsdDivisa = useMemo(() => {
    const rec = parseDecimalInput(cart.recibidoUsd)
    const vue = parseDecimalInput(cart.vueltoUsd) || 0
    if (!rec || rec <= 0) return 0
    return Math.max(0, rec - vue)
  }, [cart.recibidoUsd, cart.vueltoUsd])

  // ── Data loading ─────────────────────────────────────────────────────────────

  const getFechas = () => {
    const hoyStr = hoy()
    if (filtro === 'hoy') return { desde: hoyStr, hasta: hoyStr }
    if (filtro === 'semana') {
      const d = new Date()
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      return { desde: fechaLocal(d), hasta: hoyStr }
    }
    if (filtro === 'mes') {
      const d = new Date()
      return { desde: fechaLocal(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: hoyStr }
    }
    return { desde: '2024-01-01', hasta: '2099-12-31' }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { desde, hasta } = getFechas()
    try {
      const res = await fetch(`/api/ingresos?desde=${desde}&hasta=${hasta}`)
      if (res.ok) setIngresos(await res.json())
    } catch { } finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { load() }, [load])

  const cargarPrecios = useCallback(() => {
    fetch('/api/precios')
      .then(async r => {
        if (!r.ok) return null
        const d = await r.json()
        if (d && typeof d.precios_bebidas === 'object' && Number.isFinite(Number(d.empanada_bs)))
          return {
            empanada_bs: Number(d.empanada_bs),
            tasa_bcv: d.tasa_bcv == null ? null : Number(d.tasa_bcv),
            precios_bebidas: d.precios_bebidas as Record<string, number>,
            productos_catalog: (Array.isArray(d.productos_catalog) ? d.productos_catalog : []) as ProductoCatalog[],
          }
        return null
      })
      .then(d => { if (d) setPreciosCfg(d) })
      .catch(() => { })
  }, [])

  useEffect(() => { cargarPrecios() }, [cargarPrecios])
  useEffect(() => { if (showForm) cargarPrecios() }, [showForm, cargarPrecios])

  useEffect(() => {
    if (searchParams.get('nuevo') === '1') { setShowForm(true); router.replace('/ingresos') }
  }, [searchParams, router])

  // ── Selection helpers ─────────────────────────────────────────────────────────

  const toggleSel = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(ingresos.map(i => i.id)))
  const clearSel  = () => { setSelectedIds(new Set()); setSelMode(false) }

  const delBulk = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await fetch('/api/ingresos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    show(`${ids.length} ingreso${ids.length > 1 ? 's' : ''} eliminado${ids.length > 1 ? 's' : ''}`, 'error')
    setConfirmBulk(false)
    clearSel()
    load()
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const closeForm = () => { setShowForm(false); setEditing(null); setCart(emptyCart()) }

  const openEdit = (i: Ingreso) => {
    setEditing(i)
    const beb      = typeof i.bebida === 'string' ? i.bebida : ''
    const isDivisa = i.forma_pago === 'divisa'
    const isLegacyUsd = (i.moneda ?? 'BS') === 'USD' && !isDivisa
    setCart({
      fecha: (i.fecha ?? '').slice(0, 10),
      empanadas: i.tipo === 'desayuno' ? i.cantidad : 0,
      almuerzo:  i.tipo === 'almuerzo' ? i.cantidad : 0,
      almuerzoMonto: i.tipo === 'almuerzo' ? String(i.monto) : '',
      bebidas: (i.tipo === 'bebida' && beb) ? { [beb]: i.cantidad } : {},
      moneda: isLegacyUsd ? 'USD' : 'BS',
      tasa: isLegacyUsd && i.tasa ? String(i.tasa) : '',
      montoUsd: isLegacyUsd ? String(i.monto_usd ?? i.monto) : '',
      recibidoUsd: isDivisa ? String(i.monto_usd ?? i.monto) : '',
      vueltoUsd: '',
      forma_pago: isDivisa ? 'divisa' : (isLegacyUsd ? 'efectivo' : i.forma_pago),
      notas: i.notas ?? '',
    })
    setShowForm(true)
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    // ── Legacy USD mode ──
    if (cart.moneda === 'USD') {
      const montoUsd = parseDecimalInput(cart.montoUsd)
      const tasa     = parseDecimalInput(cart.tasa)
      if (!montoUsd || montoUsd <= 0) { show('Indicá el monto en USD', 'error'); return }
      if (!tasa || tasa <= 0)          { show('Indicá la tasa Bs/USD', 'error'); return }
      const res = await fetch('/api/ingresos', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id ?? generateId(),
          fecha: cart.fecha,
          tipo: 'desayuno',
          bebida: '',
          cantidad: 1,
          cantidad_bebida: 0,
          monto: montoUsd * tasa,
          moneda: 'USD',
          tasa,
          monto_usd: montoUsd,
          forma_pago: 'efectivo',
          notas: cart.notas,
        }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); show((j as any).error ?? 'Error al guardar', 'error'); return }
      show(editing ? 'Ingreso actualizado ✓' : 'Ingreso registrado ✓')
      closeForm(); load(); return
    }

    // ── Divisa (USD, no tasa) ──
    if (isDivisaMode) {
      if (netUsdDivisa <= 0) { show('Indicá cuánto pagó el cliente en USD', 'error'); return }
      const res = await fetch('/api/ingresos', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id ?? generateId(),
          fecha: cart.fecha,
          tipo: 'desayuno',
          bebida: '',
          cantidad: 1,
          cantidad_bebida: 0,
          monto: netUsdDivisa,
          moneda: 'USD',
          tasa: null,
          monto_usd: netUsdDivisa,
          forma_pago: 'divisa',
          notas: cart.notas,
        }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); show((j as any).error ?? 'Error al guardar', 'error'); return }
      show(editing ? 'Ingreso actualizado ✓' : 'Ingreso registrado ✓')
      closeForm(); load(); return
    }

    // ── BS mode ──
    if (!hasItems) { show('Seleccioná al menos un producto', 'error'); return }

    if (cart.almuerzo > 0) {
      const am = parseDecimalInput(cart.almuerzoMonto)
      if (!am || am <= 0) { show('Indicá el precio del almuerzo', 'error'); return }
    }

    if (editing) {
      let tipo = editing.tipo
      let bebida = editing.bebida ?? ''
      let cantidad = 1
      let cantidad_bebida = 0
      let monto = 0

      if (tipo === 'desayuno') {
        cantidad = cart.empanadas || 1
        monto    = cantidad * (preciosCfg?.empanada_bs ?? 0)
      } else if (tipo === 'almuerzo') {
        cantidad = cart.almuerzo || 1
        monto    = parseDecimalInput(cart.almuerzoMonto) || 0
      } else {
        const qty = cart.bebidas[bebida] ?? 0
        const prod = preciosCfg?.productos_catalog.find(p => p.id === bebida)
        cantidad        = qty || 1
        cantidad_bebida = cantidad
        monto           = cantidad * (prod?.price ?? 0)
      }

      const res = await fetch('/api/ingresos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, fecha: cart.fecha, tipo, bebida, cantidad, cantidad_bebida, monto, moneda: 'BS', forma_pago: cart.forma_pago, notas: cart.notas }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); show((j as any).error ?? 'Error', 'error'); return }
      show('Ingreso actualizado ✓')
      closeForm(); load(); return
    }

    // New: create one record per item type
    const records: object[] = []

    if (cart.empanadas > 0) {
      const monto = cart.empanadas * (preciosCfg?.empanada_bs ?? 0)
      records.push({ id: generateId(), fecha: cart.fecha, tipo: 'desayuno', bebida: '', cantidad: cart.empanadas, cantidad_bebida: 0, monto, moneda: 'BS', forma_pago: cart.forma_pago, notas: cart.notas })
    }

    if (cart.almuerzo > 0) {
      const monto = parseDecimalInput(cart.almuerzoMonto) || 0
      records.push({ id: generateId(), fecha: cart.fecha, tipo: 'almuerzo', bebida: '', cantidad: cart.almuerzo, cantidad_bebida: 0, monto, moneda: 'BS', forma_pago: cart.forma_pago, notas: cart.notas })
    }

    for (const [prodId, qty] of Object.entries(cart.bebidas)) {
      if (qty <= 0) continue
      const prod = preciosCfg?.productos_catalog.find(p => p.id === prodId)
      const monto = qty * (prod?.price ?? 0)
      records.push({ id: generateId(), fecha: cart.fecha, tipo: 'bebida', bebida: prodId, cantidad: qty, cantidad_bebida: qty, monto, moneda: 'BS', forma_pago: cart.forma_pago, notas: cart.notas })
    }

    const results = await Promise.all(
      records.map(r => fetch('/api/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r),
      }))
    )
    if (results.some(r => !r.ok)) { show('Error al guardar algún registro', 'error'); return }

    show(records.length === 1 ? 'Ingreso registrado ✓' : `${records.length} registros guardados ✓`)
    closeForm(); load()
  }

  const del = async (id: string) => {
    await fetch('/api/ingresos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    show('Ingreso eliminado', 'error'); setConfirmId(null); load()
  }

  const total = ingresos.reduce((s, i) => s + Number(i.monto), 0)

  const editTipo = editing?.tipo ?? null

  return (
    <div className="pb-20">
      {toast && <Toast message={toast.message} type={toast.type} />}
      <ConfirmDialog open={!!confirmId} message="¿Eliminar este ingreso?" onConfirm={() => del(confirmId!)} onCancel={() => setConfirmId(null)} />
      <ConfirmDialog
        open={confirmBulk}
        message={`¿Eliminar ${selectedIds.size} ingreso${selectedIds.size > 1 ? 's' : ''} seleccionado${selectedIds.size > 1 ? 's' : ''}?`}
        onConfirm={delBulk}
        onCancel={() => setConfirmBulk(false)}
      />

      <PageHeader
        title="Ingresos"
        subtitle={`Total período: ${formatBs(total)}`}
        colorClass="header-orange"
        showLogout
        right={
          <div className="flex gap-2">
            <button
              onClick={() => { setSelMode(s => !s); setSelectedIds(new Set()) }}
              className={`w-10 h-10 rounded-2xl text-white flex items-center justify-center active:scale-90 transition-transform ${selMode ? 'bg-white/30' : 'bg-black/15'}`}
              title="Seleccionar"
            >
              <CheckSquare size={18} />
            </button>
            <button onClick={() => setShowForm(true)}
              className="w-10 h-10 rounded-2xl bg-black/15 text-white flex items-center justify-center active:scale-90 transition-transform">
              <Plus size={20} />
            </button>
          </div>
        }
      />

      {/* Filter chips */}
      <div className="px-4 pt-3 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
        {(['hoy', 'semana', 'mes', 'todo'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all
              ${filtro === f
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-200'}`}>
            {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Esta semana' : f === 'mes' ? 'Este mes' : 'Todo'}
          </button>
        ))}
      </div>

      {/* Selection bar */}
      {selMode && ingresos.length > 0 && (
        <div className="mx-4 mb-2 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-2xl px-3 py-2">
          <button onClick={selectAll} className="text-xs font-bold text-orange-600 active:scale-95">
            Selec. todos ({ingresos.length})
          </button>
          <span className="flex-1 text-xs text-gray-500 text-center">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          {selectedIds.size > 0 && (
            <button onClick={() => setConfirmBulk(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold active:scale-95">
              <Trash2 size={12} /> Eliminar
            </button>
          )}
          <button onClick={clearSel} className="text-gray-400 active:scale-95">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* List */}
      <div className="px-4 space-y-3">
        {loading ? <LoadingSpinner /> : ingresos.length === 0 ? (
          <EmptyState icon="🍽️" message="Sin ingresos en este período" />
        ) : ingresos.map(i => {
          const { cls, lbl } = chipTipo(i.tipo)
          const { icon, label } = etiquetaFormaIngreso(i.forma_pago, i.moneda ?? 'BS')
          const isUsd = (i.moneda ?? 'BS') === 'USD'
          const isSel = selectedIds.has(i.id)
          return (
            <div
              key={i.id}
              className={`card fade-in-up transition-colors ${isSel ? 'border-2 border-orange-400 bg-orange-50' : ''}`}
              onClick={selMode ? () => toggleSel(i.id) : undefined}
            >
              <div className="flex items-start justify-between">
                {selMode && (
                  <div className="mr-3 pt-0.5">
                    {isSel
                      ? <CheckSquare size={20} className="text-orange-500" />
                      : <Square size={20} className="text-gray-300" />}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={cls}>{lbl}</span>
                    <span className={isUsd ? 'chip-green' : 'chip-blue'}>{icon} {label}</span>
                  </div>
                  <p className="text-xl font-bold text-brand-brown">
                    {isUsd
                      ? formatUSD(Number(i.monto_usd ?? i.monto))
                      : formatBs(Number(i.monto))}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {i.tipo === 'bebida'
                      ? `${i.cantidad} × ${labelBebida(i.bebida ?? '', preciosCfg?.productos_catalog)}`
                      : `${i.cantidad} ${i.tipo === 'desayuno' ? 'empanada(s)' : 'plato(s)'}`}
                    {i.tipo === 'desayuno' && i.bebida && i.bebida !== 'sin_bebida' && (
                      ` · ${labelBebida(i.bebida, preciosCfg?.productos_catalog)} × ${Number(i.cantidad_bebida) > 0 ? i.cantidad_bebida : 1}`
                    )}
                    {' · '}{formatoFechaLista(i.fecha)}
                  </p>
                  {i.notas && (
                    <p className="text-xs text-gray-400 mt-1">
                      {(i.moneda ?? 'BS') === 'BS' && i.forma_pago === 'pago_movil' ? 'Referencia: ' : ''}
                      {i.notas}
                    </p>
                  )}
                </div>
                {!selMode && (
                  <div className="flex gap-2 ml-2">
                    <button onClick={() => openEdit(i)} className="p-2 rounded-xl bg-orange-50 active:scale-95">
                      <Pencil size={15} className="text-brand-orange" />
                    </button>
                    <button onClick={() => setConfirmId(i.id)} className="p-2 rounded-xl bg-red-50 active:scale-95">
                      <Trash2 size={15} className="text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Form Modal ── */}
      <Modal open={showForm} onClose={closeForm} title={editing ? 'Editar ingreso' : 'Nuevo ingreso'}>
        <form onSubmit={submit} className="space-y-5 mt-2">

          <InputField label="Fecha" value={cart.fecha} onChange={v => setCart(c => ({ ...c, fecha: v }))} type="date" required />

          {/* Only show moneda selector when editing a legacy USD record */}
          {editing && cart.moneda === 'USD' && (
            <SelectField
              label="Moneda del ingreso"
              value={cart.moneda}
              onChange={v => setCart(c => ({ ...c, moneda: v as 'BS' | 'USD', tasa: v === 'BS' ? '' : c.tasa }))}
              options={MONEDAS}
              required
            />
          )}

          {/* ── Legacy USD mode (editing old records) ── */}
          {cart.moneda === 'USD' && (
            <>
              <InputField label="Monto (USD)" value={cart.montoUsd} onChange={v => setCart(c => ({ ...c, montoUsd: v }))} decimal placeholder="0,00" required />
              <InputField label="Tasa (Bs por 1 USD)" value={cart.tasa} onChange={v => setCart(c => ({ ...c, tasa: v }))} decimal placeholder="Ej. 36,50" required />
            </>
          )}

          {/* ── BS mode: products ── */}
          {cart.moneda === 'BS' && !isDivisaMode && (
            <>
              {/* Comidas */}
              {(!editTipo || editTipo === 'desayuno' || editTipo === 'almuerzo') && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Comida</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(!editTipo || editTipo === 'desayuno') && (
                      <ProductCard
                        emoji=""
                        imageSrc="/empanada.png"
                        name="Empanadas"
                        desc="De queso, carne o pollo"
                        price={preciosCfg ? `${formatBs(preciosCfg.empanada_bs)} c/u` : '—'}
                        quantity={cart.empanadas}
                        onAdd={() => setCart(c => ({ ...c, empanadas: c.empanadas + 1 }))}
                        onRemove={() => setCart(c => ({ ...c, empanadas: Math.max(0, c.empanadas - 1) }))}
                      />
                    )}
                    {(!editTipo || editTipo === 'almuerzo') && (
                      <ProductCard
                        emoji="☀️"
                        name="Almuerzo"
                        desc="Plato del día"
                        price="Precio libre"
                        quantity={cart.almuerzo}
                        onAdd={() => setCart(c => ({ ...c, almuerzo: c.almuerzo + 1 }))}
                        onRemove={() => setCart(c => ({ ...c, almuerzo: Math.max(0, c.almuerzo - 1) }))}
                      />
                    )}
                  </div>
                  {cart.almuerzo > 0 && (
                    <div className="mt-3">
                      <InputField
                        label={`Precio almuerzo × ${cart.almuerzo} (Bs)`}
                        value={cart.almuerzoMonto}
                        onChange={v => setCart(c => ({ ...c, almuerzoMonto: v }))}
                        decimal
                        placeholder="0,00"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Bebidas: default products first, custom last */}
              {(!editTipo || editTipo === 'bebida') && sortedCatalog.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Bebidas <span className="normal-case font-normal">(opcional)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {sortedCatalog
                      .filter(prod => !editTipo || !editing?.bebida || prod.id === editing.bebida)
                      .map(prod => {
                        const qty = cart.bebidas[prod.id] ?? 0
                        return (
                          <ProductCard
                            key={prod.id}
                            emoji={prod.emoji}
                            name={prod.name}
                            desc=""
                            price={`${formatBs(prod.price)} c/u`}
                            quantity={qty}
                            onAdd={() => setCart(c => ({
                              ...c,
                              bebidas: { ...c.bebidas, [prod.id]: (c.bebidas[prod.id] ?? 0) + 1 },
                            }))}
                            onRemove={() => setCart(c => {
                              const next = Math.max(0, (c.bebidas[prod.id] ?? 0) - 1)
                              const beb = { ...c.bebidas }
                              if (next === 0) delete beb[prod.id]
                              else beb[prod.id] = next
                              return { ...c, bebidas: beb }
                            })}
                          />
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Running total */}
              {hasItems && (
                <div className={`rounded-2xl p-4 ${autoTotalBs > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total a cobrar</p>
                  <p className={`text-2xl font-black tabular-nums ${autoTotalBs > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {autoTotalBs > 0 ? formatBs(autoTotalBs) : cart.almuerzo > 0 ? 'Ingresá precio almuerzo ↑' : '—'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {[
                      cart.empanadas > 0 && `${cart.empanadas} empanada${cart.empanadas > 1 ? 's' : ''}`,
                      cart.almuerzo  > 0 && `${cart.almuerzo} almuerzo${cart.almuerzo > 1 ? 's' : ''}`,
                      ...Object.entries(cart.bebidas)
                        .filter(([, q]) => q > 0)
                        .map(([id, q]) => `${q} ${labelBebida(id, preciosCfg?.productos_catalog)}`),
                    ].filter(Boolean).join(' + ')}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Divisa (USD, no tasa) ── */}
          {isDivisaMode && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">💵 Pago en dólares</p>
                <div className="space-y-3">
                  <InputField
                    label="Cliente pagó (USD)"
                    value={cart.recibidoUsd}
                    onChange={v => setCart(c => ({ ...c, recibidoUsd: v }))}
                    decimal
                    placeholder="0,00"
                    required
                  />
                  <InputField
                    label="Vuelto dado (USD)"
                    value={cart.vueltoUsd}
                    onChange={v => setCart(c => ({ ...c, vueltoUsd: v }))}
                    decimal
                    placeholder="0,00"
                  />
                  {netUsdDivisa > 0 && (
                    <div className="bg-white rounded-xl px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Neto recibido</span>
                      <span className="text-lg font-black text-emerald-700 tabular-nums">
                        {formatUSD(netUsdDivisa)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment method (BS mode only) */}
          {cart.moneda === 'BS' && (
            <SelectField
              label="Forma de pago"
              value={cart.forma_pago}
              onChange={v => setCart(c => ({ ...c, forma_pago: v, recibidoUsd: '', vueltoUsd: '' }))}
              options={FORMAS_PAGO_INGRESO_BS}
              required
            />
          )}

          <InputField
            label={cart.moneda === 'BS' && cart.forma_pago === 'pago_movil' ? 'Referencia (opcional)' : 'Notas (opcional)'}
            value={cart.notas}
            onChange={v => setCart(c => ({ ...c, notas: v }))}
            placeholder={cart.moneda === 'BS' && cart.forma_pago === 'pago_movil'
              ? 'Ej. últimos dígitos del pago, teléfono...'
              : 'Observaciones...'}
          />

          <button type="submit" className="btn-primary mt-2">
            {editing ? '✓ Actualizar ingreso' : '+ Registrar ingreso'}
          </button>
        </form>
      </Modal>

      <BottomNav />
    </div>
  )
}

export default function IngresosPage() {
  return <Suspense><IngresosInner /></Suspense>
}
