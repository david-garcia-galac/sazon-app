'use client'
import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ArrowDown, ArrowUp, RotateCcw, CalendarClock } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { Modal, Toast, useToast, ConfirmDialog, EmptyState, LoadingSpinner, InputField, SelectField } from '@/components/ui'
import { hoy, parseDecimalInput } from '@/lib/constants'
import { generateId } from '@/lib/idb'

interface Item {
  id: string
  nombre: string
  categoria: string
  unidad: string
  stock_actual: number
  stock_minimo: number
  notas?: string
  fecha_vencimiento?: string | null
}
interface Mov  { id: string; inventario_id: string; tipo: string; cantidad: number; fecha: string; notas?: string }

const CATEGORIAS = [
  { value: 'desayuno', label: '🥟 Empanadas' },
  { value: 'almuerzo', label: '☀️ Almuerzo' },
  { value: 'general',  label: '📦 General' },
]
const TIPOS_MOV = [
  { value: 'compra',  label: '📥 Compra / entrada' },
  { value: 'consumo', label: '📤 Consumo / salida' },
  { value: 'ajuste',  label: '🔄 Ajuste manual' },
]

function diasHastaVencer(fv: string | null | undefined): number | null {
  if (!fv) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const exp   = new Date(fv + 'T12:00:00')
  if (isNaN(exp.getTime())) return null
  return Math.floor((exp.getTime() - today.getTime()) / 86_400_000)
}

function ExpiryBadge({ dias }: { dias: number | null }) {
  if (dias === null) return null
  if (dias < 0)
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⛔ Vencido</span>
  if (dias === 0)
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⛔ Vence hoy</span>
  if (dias <= 3)
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⚠️ Vence en {dias}d</span>
  if (dias <= 7)
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">🕐 Vence en {dias}d</span>
  return null
}

export default function InventarioPage() {
  const [items, setItems]       = useState<Item[]>([])
  const [movs, setMovs]         = useState<Mov[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'stock'|'movimientos'>('stock')
  const [showItemForm, setShowItemForm] = useState(false)
  const [showMovForm, setShowMovForm]   = useState<string|null>(null)
  const [confirmId, setConfirmId]       = useState<string|null>(null)
  const [catFiltro, setCatFiltro]       = useState<string>('todo')
  const { toast, show } = useToast()

  const [iForm, setIForm] = useState({ nombre:'', categoria:'desayuno', unidad:'kg', stock_actual:'0', stock_minimo:'0', notas:'', fecha_vencimiento:'' })
  const [mForm, setMForm] = useState({ tipo:'compra', cantidad:'', fecha: hoy(), notas:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventario')
      if (res.ok) { const d = await res.json(); setItems(d.items); setMovs(d.movimientos) }
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/inventario', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        _type:'item', id: generateId(), ...iForm,
        stock_actual: parseDecimalInput(iForm.stock_actual),
        stock_minimo: parseDecimalInput(iForm.stock_minimo),
        fecha_vencimiento: iForm.fecha_vencimiento || null,
      }),
    })
    show('Ítem guardado ✓')
    setShowItemForm(false)
    setIForm({ nombre:'', categoria:'desayuno', unidad:'kg', stock_actual:'0', stock_minimo:'0', notas:'', fecha_vencimiento:'' })
    load()
  }

  const saveMov = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showMovForm) return
    await fetch('/api/inventario', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ _type:'movimiento', id: generateId(), inventario_id: showMovForm, ...mForm, cantidad: parseDecimalInput(mForm.cantidad) }),
    })
    show('Movimiento registrado ✓'); setShowMovForm(null)
    setMForm({ tipo:'compra', cantidad:'', fecha: hoy(), notas:'' }); load()
  }

  const del = async (id: string) => {
    await fetch('/api/inventario', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    show('Eliminado', 'error'); setConfirmId(null); load()
  }

  const filtered = catFiltro === 'todo' ? items : items.filter(i => i.categoria === catFiltro)
  const bajoStock   = items.filter(i => Number(i.stock_actual) <= Number(i.stock_minimo) && i.stock_minimo > 0)
  const porVencer   = items.filter(i => {
    const d = diasHastaVencer(i.fecha_vencimiento)
    return d !== null && d <= 7
  }).sort((a, b) => {
    const da = diasHastaVencer(a.fecha_vencimiento) ?? 999
    const db = diasHastaVencer(b.fecha_vencimiento) ?? 999
    return da - db
  })

  return (
    <div className="pb-20">
      {toast && <Toast message={toast.message} type={toast.type}/>}
      <ConfirmDialog open={!!confirmId} message="¿Eliminar este ítem?" onConfirm={() => del(confirmId!)} onCancel={() => setConfirmId(null)}/>

      <PageHeader
        title="Inventario"
        subtitle={`${items.length} ítems · ${bajoStock.length} bajo mínimo`}
        colorClass="header-green"
        showLogout
        right={
          <button onClick={() => setShowItemForm(true)}
            className="w-10 h-10 rounded-2xl bg-black/15 text-white flex items-center justify-center active:scale-90 transition-transform">
            <Plus size={20}/>
          </button>
        }
      />

      {/* Expiry alert */}
      {porVencer.length > 0 && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
            <CalendarClock size={13}/> Próximos a vencer
          </p>
          {porVencer.map(i => {
            const dias = diasHastaVencer(i.fecha_vencimiento)!
            return (
              <p key={i.id} className="text-xs text-amber-700 flex items-center gap-1.5 mt-0.5">
                <ExpiryBadge dias={dias}/>
                <span className="font-medium">{i.nombre}</span>
                <span className="text-amber-500">({i.fecha_vencimiento})</span>
              </p>
            )
          })}
        </div>
      )}

      {/* Low stock alert */}
      {bajoStock.length > 0 && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-2xl p-3">
          <p className="text-xs font-bold text-red-700 mb-1">⚠️ Stock bajo mínimo</p>
          {bajoStock.map(i => (
            <p key={i.id} className="text-xs text-red-600">• {i.nombre}: {i.stock_actual} {i.unidad}</p>
          ))}
        </div>
      )}

      <div className="flex border-b border-orange-100 bg-white px-4 mt-2">
        {(['stock','movimientos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors
              ${tab===t ? 'border-green-600 text-green-700' : 'border-transparent text-gray-400'}`}>
            {t === 'stock' ? '📦 Stock' : '📋 Movimientos'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
          {[{value:'todo',label:'Todos'},...CATEGORIAS].map(c => (
            <button key={c.value} onClick={() => setCatFiltro(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap
                ${catFiltro===c.value ? 'bg-green-600 text-white' : 'bg-white border border-green-200 text-gray-600'}`}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 mt-2 space-y-3">
        {loading ? <LoadingSpinner/> : tab === 'stock' ? (
          filtered.length === 0 ? <EmptyState icon="📦" message="Sin ítems en inventario"/> :
          filtered.map(item => {
            const bajo = Number(item.stock_actual) <= Number(item.stock_minimo) && item.stock_minimo > 0
            const dias = diasHastaVencer(item.fecha_vencimiento)
            const expirando = dias !== null && dias <= 7
            return (
              <div key={item.id} className={`card fade-in-up ${bajo ? 'border-red-200' : expirando ? 'border-amber-200' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-brand-brown">{item.nombre}</p>
                      <ExpiryBadge dias={dias}/>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-lg font-bold ${bajo ? 'text-red-500' : 'text-green-600'}`}>
                        {item.stock_actual} {item.unidad}
                      </span>
                      {bajo && <span className="chip-red text-xs">Bajo mínimo ({item.stock_minimo})</span>}
                    </div>
                    <p className="text-xs text-gray-400 capitalize">
                      {item.categoria}
                      {item.fecha_vencimiento && (
                        <span className="ml-2">· Vence: {item.fecha_vencimiento}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setShowMovForm(item.id)} className="p-2 rounded-xl bg-green-50 active:scale-95" title="Registrar movimiento">
                      <RotateCcw size={15} className="text-green-600"/>
                    </button>
                    <button onClick={() => setConfirmId(item.id)} className="p-2 rounded-xl bg-red-50 active:scale-95">
                      <Trash2 size={15} className="text-red-500"/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          movs.length === 0 ? <EmptyState icon="📋" message="Sin movimientos registrados"/> :
          movs.map(m => {
            const item = items.find(i => i.id === m.inventario_id)
            return (
              <div key={m.id} className="card fade-in-up">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${m.tipo==='compra'?'bg-green-50':m.tipo==='consumo'?'bg-red-50':'bg-amber-50'}`}>
                    {m.tipo==='compra' ? <ArrowDown size={16} className="text-green-600"/> :
                     m.tipo==='consumo' ? <ArrowUp size={16} className="text-red-500"/> :
                     <RotateCcw size={16} className="text-amber-500"/>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-brand-brown">{item?.nombre ?? 'Ítem'}</p>
                    <p className="text-xs text-gray-500">
                      {m.tipo==='compra'?'+':m.tipo==='consumo'?'-':''}{m.cantidad} {item?.unidad ?? ''} · {m.fecha}
                    </p>
                    {m.notas && <p className="text-xs text-gray-400">{m.notas}</p>}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Item Form */}
      <Modal open={showItemForm} onClose={() => { setShowItemForm(false); setIForm({ nombre:'', categoria:'desayuno', unidad:'kg', stock_actual:'0', stock_minimo:'0', notas:'', fecha_vencimiento:'' }) }} title="Nuevo ítem de inventario">
        <form onSubmit={saveItem} className="space-y-4 mt-2">
          <InputField label="Nombre del producto" value={iForm.nombre} onChange={v=>setIForm(f=>({...f,nombre:v}))} required placeholder="Ej: Harina PAN"/>
          <SelectField label="Categoría" value={iForm.categoria} onChange={v=>setIForm(f=>({...f,categoria:v}))} options={CATEGORIAS}/>
          <InputField label="Unidad de medida" value={iForm.unidad} onChange={v=>setIForm(f=>({...f,unidad:v}))} placeholder="kg, litros, unidades..."/>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Stock actual" value={iForm.stock_actual} onChange={v=>setIForm(f=>({...f,stock_actual:v}))} decimal placeholder="0,0"/>
            <InputField label="Stock mínimo" value={iForm.stock_minimo} onChange={v=>setIForm(f=>({...f,stock_minimo:v}))} decimal placeholder="0,0"/>
          </div>
          <InputField
            label="Fecha de vencimiento (opcional)"
            value={iForm.fecha_vencimiento}
            onChange={v=>setIForm(f=>({...f,fecha_vencimiento:v}))}
            type="date"
          />
          <button type="submit" className="bg-green-600 text-white font-semibold rounded-xl px-5 py-3 active:scale-95 transition-transform w-full">
            + Guardar ítem
          </button>
        </form>
      </Modal>

      {/* Movimiento Form */}
      <Modal open={!!showMovForm} onClose={() => setShowMovForm(null)} title="Registrar movimiento">
        <form onSubmit={saveMov} className="space-y-4 mt-2">
          <SelectField label="Tipo" value={mForm.tipo} onChange={v=>setMForm(f=>({...f,tipo:v}))} options={TIPOS_MOV}/>
          <InputField label="Cantidad" value={mForm.cantidad} onChange={v=>setMForm(f=>({...f,cantidad:v}))} decimal placeholder="0,0" required/>
          <InputField label="Fecha" value={mForm.fecha} onChange={v=>setMForm(f=>({...f,fecha:v}))} type="date"/>
          <InputField label="Notas" value={mForm.notas} onChange={v=>setMForm(f=>({...f,notas:v}))} placeholder="Observación..."/>
          <button type="submit" className="bg-green-600 text-white font-semibold rounded-xl px-5 py-3 active:scale-95 transition-transform w-full">
            ✓ Registrar
          </button>
        </form>
      </Modal>

      <BottomNav/>
    </div>
  )
}
