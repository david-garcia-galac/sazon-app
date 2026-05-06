'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import {
  Modal, Toast, useToast, ConfirmDialog,
  EmptyState, LoadingSpinner, SelectField, InputField
} from '@/components/ui'
import {
  BEBIDAS,
  FORMAS_PAGO_INGRESO_BS,
  MONEDAS,
  formatBs,
  formatUSD,
  fechaLocal,
  formatoFechaLista,
  hoy,
  labelBebida,
} from '@/lib/constants'
import { generateId } from '@/lib/idb'
import type { Ingreso } from '@/lib/idb'

type PreciosCfg = {
  empanada_bs: number
  tasa_bcv: number | null
  precios_bebidas: Record<string, number>
}

const TIPOS = [
  { value: 'desayuno', label: '🥟 Empanadas' },
  { value: 'almuerzo', label: '☀️ Almuerzo' },
]

function etiquetaFormaIngreso(fp: string): { icon: string; label: string } {
  switch (fp) {
    case 'pago_movil':
      return { icon: '📱', label: 'Pago móvil' }
    case 'transferencia':
      return { icon: '🏦', label: 'Transferencia' }
    default:
      return { icon: '💵', label: 'Efectivo' }
  }
}

function IngresosInner() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Ingreso | null>(null)
  const [confirmId, setConfirmId] = useState<string|null>(null)
  const [filtro, setFiltro]     = useState<'hoy'|'semana'|'mes'|'todo'>('hoy')
  const [preciosCfg, setPreciosCfg] = useState<PreciosCfg | null>(null)
  const { toast, show } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Form state
  const [form, setForm] = useState({
    fecha: hoy(),
    tipo: 'desayuno',
    bebida: '',
    cantidad: '1',
    cantidad_bebida: '0',
    monto: '',
    moneda: 'BS' as 'BS' | 'USD',
    tasa: '',
    forma_pago: 'efectivo',
    notas: '',
  })

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
    } catch {} finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { load() }, [load])

  const cargarPrecios = useCallback(() => {
    fetch('/api/precios')
      .then(async (r) => {
        if (!r.ok) return null
        const d = await r.json()
        if (
          d &&
          typeof d.precios_bebidas === 'object' &&
          d.precios_bebidas != null &&
          Number.isFinite(Number(d.empanada_bs))
        )
          return {
            empanada_bs: Number(d.empanada_bs),
            tasa_bcv: d.tasa_bcv == null ? null : Number(d.tasa_bcv),
            precios_bebidas: d.precios_bebidas as Record<string, number>,
          }
        return null
      })
      .then((d) => {
        if (d) setPreciosCfg(d)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    cargarPrecios()
  }, [cargarPrecios])

  useEffect(() => {
    if (showForm) cargarPrecios()
  }, [showForm, cargarPrecios])

  /** Auto total BS empanadas: cant × precio empanada + cant bebidas × precio unitario bebida. */
  useEffect(() => {
    if (form.moneda !== 'BS' || form.tipo !== 'desayuno') return
    if (!preciosCfg) return
    const n = parseInt(form.cantidad, 10) || 0
    const sin =
      !form.bebida || form.bebida === 'sin_bebida'
    const nBeb = sin ? 0 : parseInt(form.cantidad_bebida, 10) || 0
    const precioUni = preciosCfg.precios_bebidas[form.bebida] ?? 0
    const tot =
      n * preciosCfg.empanada_bs + nBeb * precioUni
    const next = tot.toFixed(2)
    setForm((f) => (f.monto === next ? f : { ...f, monto: next }))
  }, [
    preciosCfg,
    form.moneda,
    form.tipo,
    form.cantidad,
    form.bebida,
    form.cantidad_bebida,
  ])

  useEffect(() => {
    if (searchParams.get('nuevo') === '1') { setShowForm(true); router.replace('/ingresos') }
  }, [searchParams, router])

  const openEdit = (i: Ingreso) => {
    setEditing(i)
    const beb =
      typeof i.bebida === 'string' ? i.bebida : ''
    const tieneBebida = Boolean(beb) && beb !== 'sin_bebida'
    const nb =
      typeof i.cantidad_bebida === 'number' &&
      Number(i.cantidad_bebida) > 0
        ? Number(i.cantidad_bebida)
        : tieneBebida
          ? 1
          : 0
    setForm({
      fecha: i.fecha,
      tipo: i.tipo,
      bebida: beb,
      cantidad: String(i.cantidad),
      cantidad_bebida: String(nb),
      monto:
        (i.moneda ?? 'BS') === 'USD'
          ? String(i.monto_usd ?? i.monto)
          : String(i.monto),
      moneda: (i.moneda ?? 'BS') as 'BS' | 'USD',
      tasa: i.tasa != null && Number(i.tasa) > 0 ? String(i.tasa) : '',
      forma_pago: i.forma_pago,
      notas: i.notas ?? '',
    })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditing(null); resetForm() }
  const resetForm = () =>
    setForm({
      fecha: hoy(),
      tipo: 'desayuno',
      bebida: '',
      cantidad: '1',
      cantidad_bebida: '0',
      monto: '',
      moneda: 'BS',
      tasa: '',
      forma_pago: 'efectivo',
      notas: '',
    })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.monto) return
    const id = editing?.id ?? generateId()
    const base = {
      fecha: form.fecha,
      tipo: form.tipo,
      bebida: form.bebida,
      cantidad: parseInt(form.cantidad, 10),
      cantidad_bebida: parseInt(form.cantidad_bebida, 10) || 0,
      monto: parseFloat(form.monto),
      moneda: form.moneda,
      tasa: form.moneda === 'USD' ? parseFloat(form.tasa) : undefined,
      monto_usd:
        form.moneda === 'USD' ? parseFloat(form.monto) : undefined,
      forma_pago: form.moneda === 'USD' ? 'efectivo' : form.forma_pago,
      notas: form.notas,
    }
    const payload = { id, ...base }
    const res = await fetch('/api/ingresos', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      show((j as { error?: string }).error ?? 'No se pudo guardar', 'error')
      return
    }
    show(editing ? 'Ingreso actualizado ✓' : 'Ingreso registrado ✓')
    closeForm()
    load()
  }

  const del = async (id: string) => {
    await fetch('/api/ingresos', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    show('Ingreso eliminado', 'error'); setConfirmId(null); load()
  }

  const total = ingresos.reduce(
    (s, i) => s + Number(i.monto),
    0
  )

  return (
    <div className="pb-20">
      {toast && <Toast message={toast.message} type={toast.type}/>}
      <ConfirmDialog open={!!confirmId} message="¿Eliminar este ingreso?" onConfirm={() => del(confirmId!)} onCancel={() => setConfirmId(null)}/>

      {/* Header */}
      <div className="bg-brand-orange px-4 pt-10 pb-5 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">Ingresos</h1>
            <p className="text-orange-200 text-xs">
              Total (equiv. Bs): {formatBs(total)}
            </p>
            <button
              type="button"
              onClick={() => router.push('/configuracion')}
              className="text-left text-orange-100 text-xs underline decoration-orange-100/70 mt-1 active:opacity-80">
              Ajustar precios →
            </button>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-white/20 text-white p-3 rounded-xl active:scale-95">
            <Plus size={20}/>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
        {(['hoy','semana','mes','todo'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
              ${filtro===f ? 'bg-brand-orange text-white' : 'bg-white border border-orange-200 text-gray-600'}`}>
            {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Esta semana' : f === 'mes' ? 'Este mes' : 'Todo'}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {loading ? <LoadingSpinner/> : ingresos.length === 0 ? (
          <EmptyState icon="🍽️" message="Sin ingresos en este período"/>
        ) : ingresos.map(i => (
          <div key={i.id} className="card fade-in-up">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`chip-${i.tipo==='desayuno'?'amber':'orange'}`}>
                    {i.tipo === 'desayuno' ? '🥟 Empanadas' : '☀️ Almuerzo'}
                  </span>
                  <span className="chip-blue">
                    {(() => {
                      const { icon, label } = etiquetaFormaIngreso(i.forma_pago)
                      return (
                        <>
                          {icon} {label}
                        </>
                      )
                    })()}
                  </span>
                  {(i.moneda ?? 'BS') === 'USD' && (
                    <span className="chip-green">USD</span>
                  )}
                </div>
                <p className="text-xl font-bold text-brand-brown">
                  {(i.moneda ?? 'BS') === 'USD'
                    ? formatUSD(Number(i.monto_usd ?? i.monto))
                    : formatBs(Number(i.monto))}
                </p>
                {(i.moneda ?? 'BS') === 'USD' && (
                  <p className="text-xs text-gray-500">
                    ≈ {formatBs(Number(i.monto))} (tasa {i.tasa})
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">
                  {i.cantidad}{' '}
                  {i.tipo === 'desayuno' ? 'empanada(s)' : 'plato(s)'}
                  {(() => {
                    const b = i.bebida ?? ''
                    if (!b || b === 'sin_bebida') return ''
                    const q =
                      Number(i.cantidad_bebida) > 0
                        ? Number(i.cantidad_bebida)
                        : 1
                    return ` · ${labelBebida(b)} × ${q}`
                  })()}
                  {' · '}
                  {formatoFechaLista(i.fecha)}
                </p>
                {i.notas && <p className="text-xs text-gray-400 mt-1">{i.notas}</p>}
              </div>
              <div className="flex gap-2 ml-2">
                <button onClick={() => openEdit(i)} className="p-2 rounded-xl bg-orange-50 active:scale-95">
                  <Pencil size={15} className="text-brand-orange"/>
                </button>
                <button onClick={() => setConfirmId(i.id)} className="p-2 rounded-xl bg-red-50 active:scale-95">
                  <Trash2 size={15} className="text-red-500"/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      <Modal open={showForm} onClose={closeForm} title={editing ? 'Editar ingreso' : 'Nuevo ingreso'}>
        <form onSubmit={submit} className="space-y-4 mt-2">
          <InputField label="Fecha" value={form.fecha} onChange={v=>setForm(f=>({...f,fecha:v}))} type="date" required/>
          <SelectField
            label="Tipo"
            value={form.tipo}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                tipo: v,
                monto: v === 'almuerzo' ? '' : f.monto,
              }))
            }
            options={TIPOS}
            required
          />
          <SelectField
            label="Moneda del ingreso"
            value={form.moneda}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                moneda: v as 'BS' | 'USD',
                forma_pago: v === 'USD' ? 'efectivo' : f.forma_pago,
                tasa: v === 'BS' ? '' : f.tasa,
              }))
            }
            options={MONEDAS}
            required
          />
          <SelectField
            label="Bebida"
            value={form.bebida}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                bebida: v,
                cantidad_bebida:
                  v === 'sin_bebida' || !v
                    ? '0'
                    : f.cantidad_bebida === '0' ||
                        !f.cantidad_bebida ||
                        Number(f.cantidad_bebida) < 1
                      ? '1'
                      : f.cantidad_bebida,
              }))
            }
            options={BEBIDAS}/>
          {!form.bebida || form.bebida === 'sin_bebida' ? null : (
            <InputField
              label="Cantidad de bebidas"
              value={form.cantidad_bebida}
              onChange={(v) => setForm((f) => ({ ...f, cantidad_bebida: v }))}
              type="number"
              min="1"
              required
            />
          )}
          <InputField
            label={form.tipo === 'desayuno' ? 'Cantidad de empanadas' : 'Cantidad'}
            value={form.cantidad}
            onChange={(v) => setForm((f) => ({ ...f, cantidad: v }))}
            type="number"
            min="1"
            required
          />
          {form.moneda === 'USD' ? (
            <>
              <InputField
                label="Monto (USD, efectivo)"
                value={form.monto}
                onChange={(v) => setForm((f) => ({ ...f, monto: v }))}
                type="number"
                step="0.01"
                placeholder="0.00"
                required
              />
              <InputField
                label="Tasa (Bs por 1 USD)"
                value={form.tasa}
                onChange={(v) => setForm((f) => ({ ...f, tasa: v }))}
                type="number"
                step="0.01"
                placeholder="Ej. 36.50"
                required
              />
            </>
          ) : (
            <>
              {form.tipo === 'desayuno' && (
                <p className="text-xs text-gray-500">
                  El monto se calcula con los precios de{' '}
                  <button
                    type="button"
                    className="text-brand-orange font-medium underline"
                    onClick={() => router.push('/configuracion')}>
                    Ajustes
                  </button>
                  . Podés corregirlo a mano si el cliente paga distinto.
                </p>
              )}
              <InputField
                label="Monto total (Bs)"
                value={form.monto}
                onChange={(v) => setForm((f) => ({ ...f, monto: v }))}
                type="number"
                step="0.01"
                placeholder="0.00"
                required
              />
              <SelectField
                label="Forma de pago"
                value={form.forma_pago}
                onChange={(v) => setForm((f) => ({ ...f, forma_pago: v }))}
                options={FORMAS_PAGO_INGRESO_BS}
                required
              />
            </>
          )}
          <InputField label="Notas (opcional)" value={form.notas} onChange={v=>setForm(f=>({...f,notas:v}))} placeholder="Observaciones..."/>
          <button type="submit" className="btn-primary mt-2">
            {editing ? '✓ Actualizar ingreso' : '+ Registrar ingreso'}
          </button>
        </form>
      </Modal>

      <BottomNav/>
    </div>
  )
}

export default function IngresosPage() {
  return <Suspense><IngresosInner/></Suspense>
}
