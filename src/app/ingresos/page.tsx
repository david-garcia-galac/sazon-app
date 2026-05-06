'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ChevronDown } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import {
  Modal, Toast, useToast, ConfirmDialog,
  EmptyState, LoadingSpinner, SelectField, InputField
} from '@/components/ui'
import { BEBIDAS, FORMAS_PAGO_INGRESO, formatBs, hoy } from '@/lib/constants'
import { generateId } from '@/lib/idb'
import type { Ingreso } from '@/lib/idb'

const TIPOS = [
  { value: 'desayuno', label: '🌅 Desayuno' },
  { value: 'almuerzo', label: '☀️ Almuerzo' },
]

function IngresosInner() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Ingreso | null>(null)
  const [confirmId, setConfirmId] = useState<string|null>(null)
  const [filtro, setFiltro]     = useState<'hoy'|'semana'|'mes'|'todo'>('hoy')
  const { toast, show } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Form state
  const [form, setForm] = useState({
    fecha: hoy(), tipo: 'desayuno', bebida: '', cantidad: '1',
    monto: '', forma_pago: 'efectivo', notas: '',
  })

  const getFechas = () => {
    const hoyStr = hoy()
    if (filtro === 'hoy') return { desde: hoyStr, hasta: hoyStr }
    if (filtro === 'semana') {
      const d = new Date(); const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      return { desde: d.toISOString().slice(0,10), hasta: hoyStr }
    }
    if (filtro === 'mes') {
      const d = new Date()
      return { desde: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10), hasta: hoyStr }
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

  useEffect(() => {
    if (searchParams.get('nuevo') === '1') { setShowForm(true); router.replace('/ingresos') }
  }, [searchParams, router])

  const openEdit = (i: Ingreso) => {
    setEditing(i)
    setForm({
      fecha: i.fecha, tipo: i.tipo, bebida: i.bebida ?? '',
      cantidad: String(i.cantidad), monto: String(i.monto),
      forma_pago: i.forma_pago, notas: i.notas ?? '',
    })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditing(null); resetForm() }
  const resetForm = () => setForm({ fecha: hoy(), tipo: 'desayuno', bebida: '', cantidad: '1', monto: '', forma_pago: 'efectivo', notas: '' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.monto) return
    const payload: Ingreso = {
      id: editing?.id ?? generateId(),
      fecha: form.fecha, tipo: form.tipo as 'desayuno'|'almuerzo',
      bebida: form.bebida, cantidad: parseInt(form.cantidad),
      monto: parseFloat(form.monto), moneda: 'BS',
      forma_pago: form.forma_pago as 'efectivo'|'pago_movil',
      notas: form.notas,
      created_at: editing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await fetch('/api/ingresos', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    })
    show(editing ? 'Ingreso actualizado ✓' : 'Ingreso registrado ✓')
    closeForm(); load()
  }

  const del = async (id: string) => {
    await fetch('/api/ingresos', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    show('Ingreso eliminado', 'error'); setConfirmId(null); load()
  }

  const total = ingresos.reduce((s, i) => s + Number(i.monto), 0)

  return (
    <div className="pb-20">
      {toast && <Toast message={toast.message} type={toast.type}/>}
      <ConfirmDialog open={!!confirmId} message="¿Eliminar este ingreso?" onConfirm={() => del(confirmId!)} onCancel={() => setConfirmId(null)}/>

      {/* Header */}
      <div className="bg-brand-orange px-4 pt-10 pb-5 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">Ingresos</h1>
            <p className="text-orange-200 text-xs">Total: {formatBs(total)}</p>
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
                    {i.tipo === 'desayuno' ? '🌅 Desayuno' : '☀️ Almuerzo'}
                  </span>
                  <span className="chip-blue">{i.forma_pago === 'efectivo' ? '💵' : '📱'} {i.forma_pago === 'efectivo' ? 'Efectivo' : 'Pago Móvil'}</span>
                </div>
                <p className="text-xl font-bold text-brand-brown">{formatBs(Number(i.monto))}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {i.cantidad} plato(s) · {i.bebida || 'Sin bebida'} · {new Date(i.fecha + 'T12:00:00').toLocaleDateString('es',{day:'numeric',month:'short'})}
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
          <SelectField label="Tipo" value={form.tipo} onChange={v=>setForm(f=>({...f,tipo:v}))} options={TIPOS} required/>
          <SelectField label="Bebida" value={form.bebida} onChange={v=>setForm(f=>({...f,bebida:v}))} options={BEBIDAS}/>
          <InputField label="Cantidad de platos" value={form.cantidad} onChange={v=>setForm(f=>({...f,cantidad:v}))} type="number" min="1" required/>
          <InputField label="Monto total (Bs)" value={form.monto} onChange={v=>setForm(f=>({...f,monto:v}))} type="number" step="0.01" placeholder="0.00" required/>
          <SelectField label="Forma de pago" value={form.forma_pago} onChange={v=>setForm(f=>({...f,forma_pago:v}))} options={FORMAS_PAGO_INGRESO} required/>
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
