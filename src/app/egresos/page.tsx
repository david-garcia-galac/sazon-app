'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import {
  Modal, Toast, useToast, ConfirmDialog,
  EmptyState, LoadingSpinner, SelectField, InputField, PhotoPicker
} from '@/components/ui'
import {
  CATEGORIAS_EGRESO, FORMAS_PAGO_EGRESO, MONEDAS,
  formatBs, formatUSD, hoy, labelCategoria, parseDecimalInput,
} from '@/lib/constants'
import { generateId, getDB, enqueueSync, getEgresosByFecha } from '@/lib/idb'
import type { Egreso, Proveedor } from '@/lib/idb'

function EgresosInner() {
  const [egresos, setEgresos]   = useState<Egreso[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Egreso | null>(null)
  const [confirmId, setConfirmId] = useState<string|null>(null)
  const [filtro, setFiltro]     = useState<'hoy'|'semana'|'mes'|'todo'>('hoy')
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [addingProv, setAddingProv]   = useState(false)
  const [newProvNombre, setNewProvNombre] = useState('')
  const { toast, show } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [form, setForm] = useState({
    fecha: hoy(), categoria: '', proveedor: '', proveedor_id: '', descripcion: '',
    monto: '', moneda: 'BS', tasa: '', forma_pago: 'efectivo', notas: '',
    foto_url: '', foto_public_id: '',
  })

  const montoBs = () => {
    const m = parseDecimalInput(form.monto)
    const t = parseDecimalInput(form.tasa)
    if (form.moneda === 'USD' && t > 0 && m > 0) return m * t
    if (form.moneda === 'BS') return m
    return 0
  }

  const getFechas = () => {
    const h = hoy()
    if (filtro === 'hoy') return { desde: h, hasta: h }
    if (filtro === 'semana') {
      const d = new Date(); const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      return { desde: d.toISOString().slice(0,10), hasta: h }
    }
    if (filtro === 'mes') {
      const d = new Date()
      return { desde: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10), hasta: h }
    }
    return { desde: '2024-01-01', hasta: '2099-12-31' }
  }

  const ordenEgresos = (list: Egreso[]) =>
    [...list].sort(
      (a, b) =>
        (b.created_at || '').localeCompare(a.created_at || '') ||
        (b.id || '').localeCompare(a.id || '')
    )

  const load = useCallback(async () => {
    setLoading(true)
    const { desde, hasta } = getFechas()
    let remoteOk = false
    let remoteRows: Egreso[] | null = null

    try {
      const res = await fetch(`/api/egresos?desde=${desde}&hasta=${hasta}`)
      if (res.ok) {
        remoteRows = await res.json()
        remoteOk = true
      }
    } catch {
      /* sin red o servidor caído */
    }

    const db = await getDB()
    if (remoteOk && remoteRows) {
      const pending = (
        await getEgresosByFecha(desde, hasta).catch(() => [] as Egreso[])
      ).filter(e => e._synced === 0)

      for (const r of remoteRows as Egreso[]) {
        const existing = await db.get('egresos', r.id)
        if (existing?._synced === 0) continue
        await db.put('egresos', { ...r, _synced: 1 })
      }

      const byId = new Map<string, Egreso>()
      for (const r of remoteRows as Egreso[]) byId.set(r.id, r)
      for (const p of pending) byId.set(p.id, p)
      setEgresos(
        ordenEgresos(Array.from(byId.values()).filter(r => !(r._deleted ?? false)))
      )
    } else {
      try {
        const local = (
          await getEgresosByFecha(desde, hasta).catch(() => [] as Egreso[])
        ).filter(e => !e._deleted)
        setEgresos(ordenEgresos(local))
      } catch {
        setEgresos([])
      }
    }
    setLoading(false)
  }, [filtro])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (searchParams.get('nuevo') === '1') { setShowForm(true); router.replace('/egresos') }
  }, [searchParams, router])

  useEffect(() => {
    fetch('/api/proveedores')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.proveedores) setProveedores(d.proveedores) })
      .catch(() => {})
  }, [])

  const addProveedor = async () => {
    const nombre = newProvNombre.trim()
    if (!nombre) return
    const id = generateId()
    try {
      await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _type: 'proveedor', id, nombre, tiene_credito: false }),
      })
    } catch {}
    setProveedores(prev => [...prev, { id, nombre, tiene_credito: false, created_at: new Date().toISOString() } as Proveedor].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setForm(f => ({ ...f, proveedor_id: id, proveedor: nombre }))
    setAddingProv(false)
    setNewProvNombre('')
  }

  const openEdit = (e: Egreso) => {
    setEditing(e)
    setForm({
      fecha: (e.fecha ?? '').slice(0, 10), categoria: e.categoria, proveedor: e.proveedor ?? '',
      proveedor_id: e.proveedor_id ?? '',
      descripcion: e.descripcion ?? '', monto: String(e.monto),
      moneda: e.moneda, tasa: e.tasa ? String(e.tasa) : '',
      forma_pago: e.forma_pago, notas: '', foto_url: e.foto_url ?? '',
      foto_public_id: e.foto_public_id ?? '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false); setEditing(null)
    setAddingProv(false); setNewProvNombre('')
    setForm({ fecha: hoy(), categoria: '', proveedor: '', proveedor_id: '', descripcion: '', monto: '', moneda: 'BS', tasa: '', forma_pago: 'efectivo', notas: '', foto_url: '', foto_public_id: '' })
  }

  const payloadSyncRecord = (e: Egreso): Record<string, unknown> => {
    const o: Record<string, unknown> = {
      id: e.id,
      fecha: e.fecha,
      categoria: e.categoria,
      proveedor: e.proveedor ?? '',
      descripcion: e.descripcion ?? '',
      monto: e.monto,
      moneda: e.moneda,
      forma_pago: e.forma_pago,
    }
    if (e.tasa != null) o.tasa = e.tasa
    if (e.monto_bs != null) o.monto_bs = e.monto_bs
    if (e.foto_url) o.foto_url = e.foto_url
    if (e.foto_public_id) o.foto_public_id = e.foto_public_id
    if (e.proveedor_id) o.proveedor_id = e.proveedor_id
    return o
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.monto || !form.categoria) return
    const bs = montoBs()
    const payload: Egreso = {
      id: editing?.id ?? generateId(),
      fecha: form.fecha, categoria: form.categoria, proveedor: form.proveedor,
      proveedor_id: form.proveedor_id || undefined,
      descripcion: form.descripcion, monto: parseDecimalInput(form.monto),
      moneda: form.moneda as 'BS'|'USD',
      tasa: form.tasa ? parseDecimalInput(form.tasa) : undefined,
      monto_bs: bs || undefined,
      forma_pago: form.forma_pago,
      foto_url: form.foto_url || undefined,
      foto_public_id: form.foto_public_id || undefined,
      created_at: editing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const res = await fetch('/api/egresos', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({} as { error?: string }))
      if (res.ok) {
        const db = await getDB()
        await db.put('egresos', { ...payload, _synced: 1 })
        show(editing ? 'Egreso actualizado ✓' : 'Egreso registrado ✓')
        closeForm()
        load()
        return
      }
      if (res.status === 400) {
        show(j.error ?? 'No se pudo guardar', 'error')
        return
      }
      /* servidor u otro error: intentamos cola local como respaldo */
    } catch {
      /* fetch falló ( típico sin red ) */
    }

    const db = await getDB()
    await db.put('egresos', { ...payload, _synced: 0 })
    await enqueueSync('egresos', editing ? 'update' : 'create', payloadSyncRecord(payload))
    show(
      editing
        ? 'Guardado en el dispositivo; tocá “sincronizar” en el inicio cuando haya Internet ✓'
        : 'Guardado aquí ✓ Cuando vuelva la red, sincroniza desde el inicio.',
      'success'
    )
    closeForm()
    load()
  }

  const del = async (id: string) => {
    try {
      const res = await fetch('/api/egresos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        await getDB().then(db => db.delete('egresos', id))
        show('Egreso eliminado')
        setConfirmId(null)
        load()
        return
      }
    } catch {}

    await getDB().then(async db => {
      const item = await db.get('egresos', id)
      if (item) {
        ;(item as Egreso)._deleted = true
        ;(item as Egreso).updated_at = new Date().toISOString()
        await db.put('egresos', item)
      }
      await enqueueSync('egresos', 'delete', { id })
    })
    show('Eliminación local sincronizada luego cuando haya red', 'error')
    setConfirmId(null)
    load()
  }

  const total = egresos.reduce((s, e) => s + Number(e.monto_bs ?? e.monto), 0)

  return (
    <div className="pb-20">
      {toast && <Toast message={toast.message} type={toast.type}/>}
      <ConfirmDialog open={!!confirmId} message="¿Eliminar este egreso?" onConfirm={() => del(confirmId!)} onCancel={() => setConfirmId(null)}/>

      <PageHeader
        title="Egresos"
        subtitle={`Total período: ${formatBs(total)}`}
        colorClass="header-red"
        right={
          <button onClick={() => setShowForm(true)}
            className="w-10 h-10 rounded-2xl bg-black/15 text-white flex items-center justify-center active:scale-90 transition-transform">
            <Plus size={20}/>
          </button>
        }
      />

      <div className="px-4 pt-3 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
        {(['hoy','semana','mes','todo'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all
              ${filtro===f
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-200'}`}>
            {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Esta semana' : f === 'mes' ? 'Este mes' : 'Todo'}
          </button>
        ))}
      </div>

      <div className="px-4 pt-2 space-y-3">
        {loading ? <LoadingSpinner/> : egresos.length === 0 ? (
          <EmptyState icon="📤" message="Sin egresos en este período"/>
        ) : egresos.map(e => (
          <div key={e.id} className="card fade-in-up">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span className="chip-red">{labelCategoria(e.categoria)}</span>
                  <span className="chip-gray capitalize">{e.forma_pago.replace('_',' ')}</span>
                  {e.moneda === 'USD' && <span className="chip-blue">USD</span>}
                </div>
                <p className="text-2xl font-extrabold text-red-600 leading-tight">
                  {e.moneda === 'USD' ? formatUSD(Number(e.monto)) : formatBs(Number(e.monto))}
                </p>
                {e.moneda === 'USD' && e.monto_bs && (
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">≈ {formatBs(Number(e.monto_bs))}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  {e.proveedor && (
                    <span className="text-xs text-gray-500 font-medium">📦 {e.proveedor}</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(e.fecha + 'T12:00:00').toLocaleDateString('es',{day:'numeric',month:'short'})}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 items-center shrink-0">
                {e.foto_url && (
                  <a href={e.foto_url} target="_blank" rel="noreferrer"
                    className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center active:scale-90 transition-transform">
                    <ImageIcon size={14} className="text-blue-500"/>
                  </a>
                )}
                <button onClick={() => openEdit(e)}
                  className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center active:scale-90 transition-transform">
                  <Pencil size={14} className="text-orange-500"/>
                </button>
                <button onClick={() => setConfirmId(e.id)}
                  className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center active:scale-90 transition-transform">
                  <Trash2 size={14} className="text-red-500"/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showForm} onClose={closeForm} title={editing ? 'Editar egreso' : 'Nuevo egreso'}>
        <form onSubmit={submit} className="space-y-4 mt-2">
          <InputField label="Fecha" value={form.fecha} onChange={v=>setForm(f=>({...f,fecha:v}))} type="date" required/>
          <SelectField label="Categoría" value={form.categoria} onChange={v=>setForm(f=>({...f,categoria:v}))} options={CATEGORIAS_EGRESO} required/>
          <div>
            <label className="label">Proveedor (opcional)</label>
            {!addingProv ? (
              <select
                value={form.proveedor_id}
                onChange={e => {
                  if (e.target.value === '__new__') {
                    setAddingProv(true)
                  } else {
                    const p = proveedores.find(p => p.id === e.target.value)
                    setForm(f => ({ ...f, proveedor_id: e.target.value, proveedor: p?.nombre ?? '' }))
                  }
                }}
                className="input-field"
              >
                <option value="">Sin proveedor</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
                <option value="__new__">➕ Agregar nuevo proveedor...</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Nombre del proveedor"
                  value={newProvNombre}
                  onChange={e => setNewProvNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProveedor() } }}
                  autoFocus
                />
                <button type="button" onClick={addProveedor}
                  className="bg-brand-orange text-white rounded-xl px-3 text-sm font-semibold active:scale-95 shrink-0">
                  Guardar
                </button>
                <button type="button" onClick={() => { setAddingProv(false); setNewProvNombre('') }}
                  className="border border-gray-200 rounded-xl px-3 text-sm text-gray-500 active:scale-95 shrink-0">
                  ✕
                </button>
              </div>
            )}
          </div>
          <InputField label="Descripción" value={form.descripcion} onChange={v=>setForm(f=>({...f,descripcion:v}))} placeholder="Qué se compró..."/>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Moneda" value={form.moneda} onChange={v=>setForm(f=>({...f,moneda:v}))} options={MONEDAS} required/>
            <InputField label="Monto" value={form.monto} onChange={v=>setForm(f=>({...f,monto:v}))} decimal placeholder="0,00" required/>
          </div>

          {form.moneda === 'USD' && (
            <div>
              <InputField label="Tasa del día (Bs/USD)" value={form.tasa} onChange={v=>setForm(f=>({...f,tasa:v}))} decimal placeholder="Ej: 38,50"/>
              {form.tasa && form.monto && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  ≈ {formatBs(parseDecimalInput(form.monto) * parseDecimalInput(form.tasa))}
                </p>
              )}
            </div>
          )}

          <SelectField label="Forma de pago" value={form.forma_pago} onChange={v=>setForm(f=>({...f,forma_pago:v}))} options={FORMAS_PAGO_EGRESO} required/>

          <PhotoPicker
            existingUrl={form.foto_url}
            onUpload={(url, pid) => setForm(f => ({ ...f, foto_url: url, foto_public_id: pid }))}
          />

          <button type="submit" className="btn-danger w-full mt-2">
            {editing ? '✓ Actualizar egreso' : '+ Registrar egreso'}
          </button>
        </form>
      </Modal>

      <BottomNav/>
    </div>
  )
}

export default function EgresosPage() {
  return <Suspense><EgresosInner/></Suspense>
}
