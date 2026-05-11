'use client'
import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { Modal, Toast, useToast, ConfirmDialog, EmptyState, LoadingSpinner, InputField, SelectField } from '@/components/ui'
import { formatBs, FORMAS_PAGO_EGRESO, MONEDAS, hoy, parseDecimalInput } from '@/lib/constants'
import { generateId } from '@/lib/idb'

interface Proveedor { id: string; nombre: string; categoria?: string; telefono?: string; tiene_credito: boolean; notas?: string }
interface Deuda { id: string; proveedor_id: string; proveedor_nombre: string; monto_total: number; monto_pagado: number; moneda: string; fecha_compra: string; fecha_vencimiento?: string; estado: string; notas?: string }

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [deudas, setDeudas]           = useState<Deuda[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'proveedores'|'deudas'>('deudas')
  const [showProvForm, setShowProvForm] = useState(false)
  const [showDeudaForm, setShowDeudaForm] = useState(false)
  const [showPagoForm, setShowPagoForm]   = useState<string|null>(null)
  const [expandedProv, setExpandedProv]   = useState<string|null>(null)
  const [confirmId, setConfirmId]         = useState<{id:string;type:string}|null>(null)
  const { toast, show } = useToast()

  const [pForm, setPForm] = useState({ nombre:'', categoria:'', telefono:'', tiene_credito: false, notas:'' })
  const [dForm, setDForm] = useState({ proveedor_id:'', monto_total:'', moneda:'BS', fecha_compra: hoy(), fecha_vencimiento:'', notas:'' })
  const [pagoForm, setPagoForm] = useState({ monto:'', fecha: hoy(), forma_pago:'efectivo', notas:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proveedores')
      if (res.ok) { const d = await res.json(); setProveedores(d.proveedores); setDeudas(d.deudas) }
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const saveProveedor = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/proveedores', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ _type:'proveedor', id: generateId(), ...pForm }),
    })
    show('Proveedor guardado ✓'); setShowProvForm(false)
    setPForm({ nombre:'', categoria:'', telefono:'', tiene_credito:false, notas:'' }); load()
  }

  const saveDeuda = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/proveedores', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ _type:'deuda', id: generateId(), monto_pagado:0, estado:'pendiente', ...dForm, monto_total: parseDecimalInput(dForm.monto_total) }),
    })
    show('Deuda registrada ✓'); setShowDeudaForm(false)
    setDForm({ proveedor_id:'', monto_total:'', moneda:'BS', fecha_compra: hoy(), fecha_vencimiento:'', notas:'' }); load()
  }

  const savePago = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showPagoForm) return
    await fetch('/api/proveedores', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ _type:'pago', id: generateId(), deuda_id: showPagoForm, ...pagoForm, monto: parseDecimalInput(pagoForm.monto) }),
    })
    show('Pago registrado ✓'); setShowPagoForm(null)
    setPagoForm({ monto:'', fecha: hoy(), forma_pago:'efectivo', notas:'' }); load()
  }

  const del = async (id: string, type: string) => {
    await fetch('/api/proveedores', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, _type: type }) })
    show('Eliminado', 'error'); setConfirmId(null); load()
  }

  const deudas_pend = deudas.filter(d => d.estado !== 'pagado')
  const total_pendiente = deudas_pend.reduce((s,d) => s + (Number(d.monto_total) - Number(d.monto_pagado)), 0)

  return (
    <div className="pb-20">
      {toast && <Toast message={toast.message} type={toast.type}/>}
      <ConfirmDialog open={!!confirmId} message="¿Eliminar este registro?" onConfirm={() => del(confirmId!.id, confirmId!.type)} onCancel={() => setConfirmId(null)}/>

      <PageHeader
        title="Proveedores"
        subtitle={`Deuda total: ${formatBs(total_pendiente)}`}
        colorClass="header-brown"
        right={
          <div className="flex gap-2">
            <button onClick={() => setShowDeudaForm(true)}
              className="px-3 h-9 rounded-xl bg-black/15 text-white text-xs font-bold active:scale-90 transition-transform">
              + Deuda
            </button>
            <button onClick={() => setShowProvForm(true)}
              className="px-3 h-9 rounded-xl bg-black/15 text-white text-xs font-bold active:scale-90 transition-transform">
              + Prov.
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-orange-100 bg-white px-4">
        {(['deudas','proveedores'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors
              ${tab===t ? 'border-brand-brown text-brand-brown' : 'border-transparent text-gray-400'}`}>
            {t === 'deudas' ? `💳 Deudas (${deudas_pend.length})` : '👥 Proveedores'}
          </button>
        ))}
      </div>

      <div className="px-4 mt-4 space-y-3">
        {loading ? <LoadingSpinner/> : tab === 'deudas' ? (
          deudas.length === 0 ? <EmptyState icon="✅" message="Sin deudas pendientes"/> :
          deudas.map(d => {
            const pendiente = Number(d.monto_total) - Number(d.monto_pagado)
            return (
              <div key={d.id} className="card fade-in-up">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg
                        ${d.estado==='pagado' ? 'bg-green-100 text-green-700' :
                          d.estado==='parcial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {d.estado==='pagado' ? '✅ Pagado' : d.estado==='parcial' ? '⏳ Parcial' : '🔴 Pendiente'}
                      </span>
                    </div>
                    <p className="font-bold text-brand-brown">{d.proveedor_nombre}</p>
                    <p className="text-sm text-gray-600">Total: {formatBs(Number(d.monto_total))} · Pagado: {formatBs(Number(d.monto_pagado))}</p>
                    {d.estado !== 'pagado' && <p className="text-base font-bold text-red-600 mt-0.5">Pendiente: {formatBs(pendiente)}</p>}
                    {d.fecha_vencimiento && <p className="text-xs text-gray-400 mt-0.5">Vence: {d.fecha_vencimiento}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    {d.estado !== 'pagado' && (
                      <button onClick={() => setShowPagoForm(d.id)} className="p-2 rounded-xl bg-green-50 active:scale-95">
                        <DollarSign size={15} className="text-green-600"/>
                      </button>
                    )}
                    <button onClick={() => setConfirmId({id:d.id,type:'deuda'})} className="p-2 rounded-xl bg-red-50 active:scale-95">
                      <Trash2 size={15} className="text-red-500"/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          proveedores.length === 0 ? <EmptyState icon="👥" message="Sin proveedores registrados"/> :
          proveedores.map(p => (
            <div key={p.id} className="card fade-in-up">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-brand-brown">{p.nombre}</p>
                  {p.categoria && <p className="text-xs text-gray-500">{p.categoria}</p>}
                  {p.telefono && <p className="text-xs text-gray-400">📞 {p.telefono}</p>}
                  {p.tiene_credito && <span className="chip-amber text-xs">Crédito</span>}
                </div>
                <button onClick={() => setConfirmId({id:p.id,type:'proveedor'})} className="p-2 rounded-xl bg-red-50 active:scale-95">
                  <Trash2 size={15} className="text-red-500"/>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Proveedor */}
      <Modal open={showProvForm} onClose={() => setShowProvForm(false)} title="Nuevo proveedor">
        <form onSubmit={saveProveedor} className="space-y-4 mt-2">
          <InputField label="Nombre" value={pForm.nombre} onChange={v=>setPForm(f=>({...f,nombre:v}))} required placeholder="Nombre del proveedor"/>
          <InputField label="Categoría" value={pForm.categoria} onChange={v=>setPForm(f=>({...f,categoria:v}))} placeholder="Ej: Carnicería"/>
          <InputField label="Teléfono" value={pForm.telefono} onChange={v=>setPForm(f=>({...f,telefono:v}))} placeholder="Ej: 0412-1234567"/>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="credito" checked={pForm.tiene_credito} onChange={e=>setPForm(f=>({...f,tiene_credito:e.target.checked}))} className="w-5 h-5 accent-brand-orange"/>
            <label htmlFor="credito" className="text-sm text-gray-700">Maneja crédito / cuenta pendiente</label>
          </div>
          <button type="submit" className="btn-primary">+ Guardar proveedor</button>
        </form>
      </Modal>

      {/* Modal: Deuda */}
      <Modal open={showDeudaForm} onClose={() => setShowDeudaForm(false)} title="Registrar deuda">
        <form onSubmit={saveDeuda} className="space-y-4 mt-2">
          <SelectField label="Proveedor" value={dForm.proveedor_id} onChange={v=>setDForm(f=>({...f,proveedor_id:v}))}
            options={proveedores.map(p=>({value:p.id,label:p.nombre}))} required/>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Moneda" value={dForm.moneda} onChange={v=>setDForm(f=>({...f,moneda:v}))} options={MONEDAS}/>
            <InputField label="Monto total" value={dForm.monto_total} onChange={v=>setDForm(f=>({...f,monto_total:v}))} decimal placeholder="0,00" required/>
          </div>
          <InputField label="Fecha de compra" value={dForm.fecha_compra} onChange={v=>setDForm(f=>({...f,fecha_compra:v}))} type="date"/>
          <InputField label="Fecha de vencimiento (opcional)" value={dForm.fecha_vencimiento} onChange={v=>setDForm(f=>({...f,fecha_vencimiento:v}))} type="date"/>
          <InputField label="Notas" value={dForm.notas} onChange={v=>setDForm(f=>({...f,notas:v}))} placeholder="Descripción de la compra..."/>
          <button type="submit" className="bg-brand-brown text-white font-semibold rounded-xl px-5 py-3 active:scale-95 transition-transform w-full">
            + Registrar deuda
          </button>
        </form>
      </Modal>

      {/* Modal: Pago */}
      <Modal open={!!showPagoForm} onClose={() => setShowPagoForm(null)} title="Registrar pago">
        <form onSubmit={savePago} className="space-y-4 mt-2">
          <InputField label="Monto pagado" value={pagoForm.monto} onChange={v=>setPagoForm(f=>({...f,monto:v}))} decimal placeholder="0,00" required/>
          <InputField label="Fecha" value={pagoForm.fecha} onChange={v=>setPagoForm(f=>({...f,fecha:v}))} type="date"/>
          <SelectField label="Forma de pago" value={pagoForm.forma_pago} onChange={v=>setPagoForm(f=>({...f,forma_pago:v}))} options={FORMAS_PAGO_EGRESO}/>
          <button type="submit" className="bg-green-500 text-white font-semibold rounded-xl px-5 py-3 active:scale-95 transition-transform w-full">
            ✓ Confirmar pago
          </button>
        </form>
      </Modal>

      <BottomNav/>
    </div>
  )
}
