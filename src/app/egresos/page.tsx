'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import {
  Modal, Toast, useToast, ConfirmDialog,
  EmptyState, LoadingSpinner, SelectField, InputField, PhotoPicker
} from '@/components/ui'
import {
  CATEGORIAS_EGRESO, FORMAS_PAGO_EGRESO, MONEDAS,
  formatBs, formatUSD, hoy, labelCategoria
} from '@/lib/constants'
import { generateId } from '@/lib/idb'
import type { Egreso } from '@/lib/idb'

function EgresosInner() {
  const [egresos, setEgresos]   = useState<Egreso[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Egreso | null>(null)
  const [confirmId, setConfirmId] = useState<string|null>(null)
  const [filtro, setFiltro]     = useState<'hoy'|'semana'|'mes'|'todo'>('hoy')
  const { toast, show } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [form, setForm] = useState({
    fecha: hoy(), categoria: '', proveedor: '', descripcion: '',
    monto: '', moneda: 'BS', tasa: '', forma_pago: 'efectivo', notas: '',
    foto_url: '', foto_public_id: '',
  })

  const montoBs = () => {
    const m = parseFloat(form.monto)
    const t = parseFloat(form.tasa)
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

  const load = useCallback(async () => {
    setLoading(true)
    const { desde, hasta } = getFechas()
    try {
      const res = await fetch(`/api/egresos?desde=${desde}&hasta=${hasta}`)
      if (res.ok) setEgresos(await res.json())
    } catch {} finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (searchParams.get('nuevo') === '1') { setShowForm(true); router.replace('/egresos') }
  }, [searchParams, router])

  const openEdit = (e: Egreso) => {
    setEditing(e)
    setForm({
      fecha: e.fecha, categoria: e.categoria, proveedor: e.proveedor ?? '',
      descripcion: e.descripcion ?? '', monto: String(e.monto),
      moneda: e.moneda, tasa: e.tasa ? String(e.tasa) : '',
      forma_pago: e.forma_pago, notas: '', foto_url: e.foto_url ?? '',
      foto_public_id: e.foto_public_id ?? '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false); setEditing(null)
    setForm({ fecha: hoy(), categoria: '', proveedor: '', descripcion: '', monto: '', moneda: 'BS', tasa: '', forma_pago: 'efectivo', notas: '', foto_url: '', foto_public_id: '' })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.monto || !form.categoria) return
    const bs = montoBs()
    const payload: Egreso = {
      id: editing?.id ?? generateId(),
      fecha: form.fecha, categoria: form.categoria, proveedor: form.proveedor,
      descripcion: form.descripcion, monto: parseFloat(form.monto),
      moneda: form.moneda as 'BS'|'USD',
      tasa: form.tasa ? parseFloat(form.tasa) : undefined,
      monto_bs: bs || undefined,
      forma_pago: form.forma_pago,
      foto_url: form.foto_url || undefined,
      foto_public_id: form.foto_public_id || undefined,
      created_at: editing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await fetch('/api/egresos', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    })
    show(editing ? 'Egreso actualizado ✓' : 'Egreso registrado ✓')
    closeForm(); load()
  }

  const del = async (id: string) => {
    await fetch('/api/egresos', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    show('Egreso eliminado', 'error'); setConfirmId(null); load()
  }

  const total = egresos.reduce((s, e) => s + Number(e.monto_bs ?? e.monto), 0)

  return (
    <div className="pb-20">
      {toast && <Toast message={toast.message} type={toast.type}/>}
      <ConfirmDialog open={!!confirmId} message="¿Eliminar este egreso?" onConfirm={() => del(confirmId!)} onCancel={() => setConfirmId(null)}/>

      <div className="bg-red-500 px-4 pt-10 pb-5 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">Egresos</h1>
            <p className="text-red-200 text-xs">Total: {formatBs(total)}</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-white/20 text-white p-3 rounded-xl active:scale-95">
            <Plus size={20}/>
          </button>
        </div>
      </div>

      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
        {(['hoy','semana','mes','todo'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
              ${filtro===f ? 'bg-red-500 text-white' : 'bg-white border border-red-200 text-gray-600'}`}>
            {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Esta semana' : f === 'mes' ? 'Este mes' : 'Todo'}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {loading ? <LoadingSpinner/> : egresos.length === 0 ? (
          <EmptyState icon="📤" message="Sin egresos en este período"/>
        ) : egresos.map(e => (
          <div key={e.id} className="card fade-in-up">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="chip-red">{labelCategoria(e.categoria)}</span>
                  <span className="chip-blue">{e.forma_pago}</span>
                  {e.moneda === 'USD' && <span className="chip-green">USD</span>}
                </div>
                <p className="text-xl font-bold text-red-600">
                  {e.moneda === 'USD' ? formatUSD(Number(e.monto)) : formatBs(Number(e.monto))}
                </p>
                {e.moneda === 'USD' && e.monto_bs && (
                  <p className="text-xs text-gray-400">≈ {formatBs(Number(e.monto_bs))}</p>
                )}
                {e.proveedor && <p className="text-xs text-gray-500 mt-0.5">📦 {e.proveedor}</p>}
                <p className="text-xs text-gray-400">{new Date(e.fecha + 'T12:00:00').toLocaleDateString('es',{day:'numeric',month:'short'})}</p>
              </div>
              <div className="flex gap-1 ml-2 items-start">
                {e.foto_url && (
                  <a href={e.foto_url} target="_blank" rel="noreferrer"
                    className="p-2 rounded-xl bg-blue-50 active:scale-95">
                    <ImageIcon size={15} className="text-blue-500"/>
                  </a>
                )}
                <button onClick={() => openEdit(e)} className="p-2 rounded-xl bg-orange-50 active:scale-95">
                  <Pencil size={15} className="text-brand-orange"/>
                </button>
                <button onClick={() => setConfirmId(e.id)} className="p-2 rounded-xl bg-red-50 active:scale-95">
                  <Trash2 size={15} className="text-red-500"/>
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
          <InputField label="Proveedor (opcional)" value={form.proveedor} onChange={v=>setForm(f=>({...f,proveedor:v}))} placeholder="Nombre del proveedor"/>
          <InputField label="Descripción" value={form.descripcion} onChange={v=>setForm(f=>({...f,descripcion:v}))} placeholder="Qué se compró..."/>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Moneda" value={form.moneda} onChange={v=>setForm(f=>({...f,moneda:v}))} options={MONEDAS} required/>
            <InputField label="Monto" value={form.monto} onChange={v=>setForm(f=>({...f,monto:v}))} type="number" step="0.01" placeholder="0.00" required/>
          </div>

          {form.moneda === 'USD' && (
            <div>
              <InputField label="Tasa del día (Bs/USD)" value={form.tasa} onChange={v=>setForm(f=>({...f,tasa:v}))} type="number" step="0.01" placeholder="Ej: 38.50"/>
              {form.tasa && form.monto && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  ≈ {formatBs(parseFloat(form.monto) * parseFloat(form.tasa))}
                </p>
              )}
            </div>
          )}

          <SelectField label="Forma de pago" value={form.forma_pago} onChange={v=>setForm(f=>({...f,forma_pago:v}))} options={FORMAS_PAGO_EGRESO} required/>

          <PhotoPicker
            existingUrl={form.foto_url}
            onUpload={(url, pid) => setForm(f => ({ ...f, foto_url: url, foto_public_id: pid }))}
          />

          <button type="submit" className="bg-red-500 text-white font-semibold rounded-xl px-5 py-3 active:scale-95 transition-transform w-full flex items-center justify-center gap-2 mt-2">
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
