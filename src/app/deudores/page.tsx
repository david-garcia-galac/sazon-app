'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, Plus, MessageCircle, AlertCircle, Receipt, X, ChevronLeft } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { Modal, Toast, useToast, ConfirmDialog, EmptyState, LoadingSpinner, SelectField, InputField } from '@/components/ui'
import { parseDecimalInput, hoy, formatoFechaLista } from '@/lib/constants'

// ── Types ────────────────────────────────────────────────────────────────────
type Deudor = {
  id: string; nombre: string; telefono: string | null
  limite_usd: number; total_consumido: number; total_pagado: number
  saldo: number; dias_atraso: number; mora: number; total_pagar: number
}
type Cliente = { id: string; nombre: string; telefono: string | null; limite_usd: number }
type HistorialItem = {
  id: string; tipo: 'consumo' | 'pago'; descripcion: string
  monto_usd: number; fecha: string; created_at: string
}

// ── Constants ────────────────────────────────────────────────────────────────
const FORMAS_PAGO = [
  { value: 'efectivo',     label: '💵 Efectivo' },
  { value: 'transferencia',label: '🏦 Transferencia' },
  { value: 'datos_prepago',label: '📱 Datos Prepago' },
]
const DESCRIPCIONES = [
  { value: 'Desayuno',             label: '🥟 Desayuno' },
  { value: 'Almuerzo',             label: '☀️ Almuerzo' },
  { value: 'Desayuno y bebida',    label: '🥟🥤 Desayuno y bebida' },
  { value: 'Almuerzo y bebida',    label: '☀️🥤 Almuerzo y bebida' },
  { value: 'Varios',               label: '📦 Varios' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const fUSD = (n: number) => `$${n.toFixed(2)}`

function waUrl(telefono: string, nombre: string, total: number) {
  const phone = telefono.replace(/\D/g, '')
  const text  = `Hola ${nombre}, tienes una deuda pendiente de ${fUSD(total)} USD en el restaurante. Por favor cancela a la brevedad. ¡Gracias! 🙏`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DeudoresPage() {
  const { toast, show } = useToast()

  // Lista principal
  const [deudores, setDeudores] = useState<Deudor[]>([])
  const [loading, setLoading]   = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // Modal: nueva deuda (multi-step)
  const [showNuevaDeuda, setShowNuevaDeuda] = useState(false)
  const [ndStep, setNdStep]       = useState<'buscar' | 'consumo'>('buscar')
  const [ndQuery, setNdQuery]     = useState('')
  const [ndResultados, setNdResultados] = useState<Cliente[]>([])
  const [ndBuscando, setNdBuscando]     = useState(false)
  const [ndCliente, setNdCliente]       = useState<Cliente | null>(null)
  const [ndDesc, setNdDesc]   = useState('Desayuno')
  const [ndMonto, setNdMonto] = useState('')
  const [ndSaving, setNdSaving] = useState(false)
  const ndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Modal: nuevo cliente (anidado dentro de nueva deuda)
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [ncNombre,   setNcNombre]   = useState('')
  const [ncTelefono, setNcTelefono] = useState('')
  const [ncSaving,   setNcSaving]   = useState(false)

  // Modal: registrar pago
  const [showPago, setShowPago]         = useState<Deudor | null>(null)
  const [pagoMonto,     setPagoMonto]   = useState('')
  const [pagoFormaPago, setPagoFormaPago] = useState('efectivo')
  const [pagoNotas,     setPagoNotas]   = useState('')
  const [pagoSaving,    setPagoSaving]  = useState(false)

  // Modal: historial
  const [historialDeudor,  setHistorialDeudor]  = useState<Deudor | null>(null)
  const [historialItems,   setHistorialItems]   = useState<HistorialItem[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)

  // ── Data loading ────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/deudores', { cache: 'no-store' })
      if (res.ok) setDeudores(await res.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Búsqueda de clientes en modal nueva deuda (debounced)
  useEffect(() => {
    if (!ndQuery.trim()) { setNdResultados([]); return }
    if (ndTimer.current) clearTimeout(ndTimer.current)
    setNdBuscando(true)
    ndTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/deudores/clientes?q=${encodeURIComponent(ndQuery)}`, { cache: 'no-store' })
        if (res.ok) setNdResultados(await res.json())
      } catch {} finally { setNdBuscando(false) }
    }, 350)
  }, [ndQuery])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const crearCliente = async () => {
    if (!ncNombre.trim()) { show('Indicá el nombre del cliente', 'error'); return }
    setNcSaving(true)
    try {
      const res = await fetch('/api/deudores/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: ncNombre, telefono: ncTelefono }),
      })
      const j = await res.json()
      if (!res.ok) { show(j.error ?? 'Error', 'error'); return }
      setNdCliente(j as Cliente)
      setNdStep('consumo')
      setShowNuevoCliente(false)
      setNcNombre(''); setNcTelefono('')
    } catch { show('Error al crear cliente', 'error') }
    finally { setNcSaving(false) }
  }

  const registrarConsumo = async () => {
    if (!ndCliente) return
    const monto = parseDecimalInput(ndMonto)
    if (!ndDesc.trim()) { show('Indicá qué consumió', 'error'); return }
    if (!isFinite(monto) || monto <= 0) { show('Monto no válido', 'error'); return }
    setNdSaving(true)
    try {
      const res = await fetch('/api/deudores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: ndCliente.id, descripcion: ndDesc, monto_usd: monto }),
      })
      const j = await res.json()
      if (!res.ok) { show(j.error ?? 'Error al registrar', 'error'); return }
      show('Consumo registrado ✓')
      setShowNuevaDeuda(false)
      resetNuevaDeuda()
      cargar()
    } catch { show('Error al registrar consumo', 'error') }
    finally { setNdSaving(false) }
  }

  const resetNuevaDeuda = () => {
    setNdStep('buscar'); setNdQuery(''); setNdResultados([]); setNdCliente(null)
    setNdDesc('Desayuno'); setNdMonto('')
  }

  const registrarPago = async () => {
    if (!showPago) return
    const monto = parseDecimalInput(pagoMonto)
    if (!isFinite(monto) || monto <= 0) { show('Monto no válido', 'error'); return }
    setPagoSaving(true)
    try {
      const res = await fetch('/api/deudores/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: showPago.id, monto_usd: monto, forma_pago: pagoFormaPago, notas: pagoNotas }),
      })
      const j = await res.json()
      if (!res.ok) { show(j.error ?? 'Error', 'error'); return }
      show('Pago registrado ✓')
      setShowPago(null); setPagoMonto(''); setPagoFormaPago('efectivo'); setPagoNotas('')
      cargar()
    } catch { show('Error al registrar pago', 'error') }
    finally { setPagoSaving(false) }
  }

  const abrirHistorial = async (d: Deudor) => {
    setHistorialDeudor(d)
    setHistorialItems([])
    setHistorialLoading(true)
    try {
      const res = await fetch(`/api/deudores/${d.id}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setHistorialItems(data.historial ?? [])
      }
    } catch {} finally { setHistorialLoading(false) }
  }

  const abrirPago = (d: Deudor) => {
    setShowPago(d)
    setPagoMonto(d.total_pagar.toFixed(2))
    setPagoFormaPago('efectivo')
    setPagoNotas('')
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtrados = deudores.filter((d) =>
    !busqueda ||
    d.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (d.telefono ?? '').includes(busqueda)
  )
  const stats = {
    count:       deudores.length,
    total_saldo: deudores.reduce((s, d) => s + d.saldo, 0),
    total_mora:  deudores.reduce((s, d) => s + d.total_pagar, 0),
    con_mora:    deudores.filter((d) => d.mora > 0).length,
  }
  const conTelefono = deudores.filter((d) => d.telefono && d.dias_atraso >= 3)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="pb-20">
      {toast && <Toast message={toast.message} type={toast.type}/>}

      <PageHeader
        title="Deudores"
        subtitle={`${stats.count} activos · ${fUSD(stats.total_mora)} total`}
        colorClass="header-orange"
        showLogout
      />

      {/* Stats strip */}
      <div className="px-4 pt-3 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="text-2xl font-extrabold text-brand-orange">{stats.count}</p>
          <p className="text-[10px] text-gray-400 font-medium">Deudores</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-extrabold text-brand-brown">{fUSD(stats.total_saldo)}</p>
          <p className="text-[10px] text-gray-400 font-medium">Sin mora</p>
        </div>
        <div className="card p-3 text-center">
          <p className={`text-lg font-extrabold ${stats.con_mora > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {fUSD(stats.total_mora)}
          </p>
          <p className="text-[10px] text-gray-400 font-medium">Con mora</p>
        </div>
      </div>

      {/* Buscar + Nueva deuda */}
      <div className="px-4 pt-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar deudor…"
            className="input-field pl-9 text-sm"
          />
        </div>
        <button
          onClick={() => { setShowNuevaDeuda(true); resetNuevaDeuda() }}
          className="flex items-center gap-1 px-4 py-2.5 rounded-2xl bg-orange-500 text-white font-bold text-sm active:scale-95 transition-transform shrink-0">
          <Plus size={16}/> Deuda
        </button>
      </div>

      {/* WhatsApp masivo si hay deudores con +3 días y teléfono */}
      {conTelefono.length > 0 && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-between gap-2">
          <p className="text-xs text-green-700 font-medium">
            {conTelefono.length} deudor{conTelefono.length > 1 ? 'es' : ''} con +3 días de atraso
          </p>
          <button
            onClick={() => conTelefono.forEach((d) => window.open(waUrl(d.telefono!, d.nombre, d.total_pagar), '_blank'))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-500 text-white text-xs font-bold active:scale-95 transition-transform shrink-0">
            <MessageCircle size={13}/> Enviar WA
          </button>
        </div>
      )}

      {/* Lista de deudores */}
      <div className="px-4 pt-3 space-y-3">
        {loading ? <LoadingSpinner/> : filtrados.length === 0 ? (
          <EmptyState icon="🤝" message={busqueda ? 'Sin resultados' : 'No hay deudores activos'}/>
        ) : filtrados.map((d) => (
          <div key={d.id} className={`card fade-in-up ${d.mora > 0 ? 'border-l-4 border-red-400' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {/* Nombre + badges */}
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="font-bold text-gray-800 text-sm leading-tight">{d.nombre}</span>
                  {d.mora > 0 && (
                    <span className="chip-red flex items-center gap-0.5">
                      <AlertCircle size={10}/> Mora
                    </span>
                  )}
                  {d.dias_atraso > 0 && d.mora === 0 && (
                    <span className="chip-amber">{d.dias_atraso}d</span>
                  )}
                </div>
                {d.telefono && (
                  <p className="text-xs text-gray-400 mb-1">📱 {d.telefono}</p>
                )}
                {/* Montos */}
                <p className="text-xl font-extrabold text-brand-brown">{fUSD(d.saldo)}</p>
                {d.mora > 0 && (
                  <p className="text-xs text-red-500 mt-0.5">
                    +{fUSD(d.mora)} mora · <strong>Total: {fUSD(d.total_pagar)}</strong>
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {d.dias_atraso} día{d.dias_atraso !== 1 ? 's' : ''} · límite {fUSD(d.limite_usd)}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => abrirPago(d)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold active:scale-95 transition-transform">
                  💲 Cobrar
                </button>
                <button
                  onClick={() => abrirHistorial(d)}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold active:scale-95 transition-transform">
                  <Receipt size={12} className="inline mr-0.5"/> Historial
                </button>
                {d.telefono && (
                  <a
                    href={waUrl(d.telefono, d.nombre, d.total_pagar)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-green-100 text-green-700 text-xs font-bold text-center active:scale-95 transition-transform">
                    💬 WA
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal: Nueva deuda ─────────────────────────────────────────────── */}
      <Modal
        open={showNuevaDeuda}
        onClose={() => { setShowNuevaDeuda(false); resetNuevaDeuda() }}
        title="Nueva deuda"
      >
        {ndStep === 'buscar' ? (
          <div className="space-y-4 mt-2">
            <div>
              <label className="label">Buscar cliente</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  value={ndQuery}
                  onChange={(e) => setNdQuery(e.target.value)}
                  placeholder="Nombre o teléfono…"
                  className="input-field pl-9"
                  autoFocus
                />
              </div>
            </div>

            {ndBuscando && <p className="text-xs text-gray-400 text-center">Buscando…</p>}

            {ndResultados.length > 0 && (
              <div className="space-y-2">
                {ndResultados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setNdCliente(c); setNdStep('consumo') }}
                    className="w-full text-left p-3 rounded-2xl bg-gray-50 border border-gray-100 active:bg-orange-50 active:border-orange-200 transition-colors">
                    <p className="font-bold text-sm text-gray-800">{c.nombre}</p>
                    {c.telefono && <p className="text-xs text-gray-400">📱 {c.telefono}</p>}
                    <p className="text-xs text-gray-400">Límite: {fUSD(c.limite_usd)}</p>
                  </button>
                ))}
              </div>
            )}

            {ndQuery.trim() && ndResultados.length === 0 && !ndBuscando && (
              <p className="text-xs text-gray-400 text-center">Sin resultados para &quot;{ndQuery}&quot;</p>
            )}

            <button
              type="button"
              onClick={() => setShowNuevoCliente(true)}
              className="w-full py-2.5 rounded-2xl border-2 border-dashed border-orange-300 text-orange-500 text-sm font-bold active:scale-95 transition-transform">
              + Crear nuevo cliente
            </button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <button
              type="button"
              onClick={() => { setNdStep('buscar'); setNdCliente(null) }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <ChevronLeft size={14}/> Cambiar cliente
            </button>

            <div className="p-3 rounded-2xl bg-orange-50 border border-orange-100">
              <p className="font-bold text-gray-800">{ndCliente?.nombre}</p>
              {ndCliente?.telefono && <p className="text-xs text-gray-500">📱 {ndCliente.telefono}</p>}
              <p className="text-xs text-gray-500">Límite: {fUSD(ndCliente?.limite_usd ?? 10)}</p>
            </div>

            <SelectField
              label="Consumo"
              value={ndDesc}
              onChange={setNdDesc}
              options={DESCRIPCIONES}
              required
            />
            <InputField
              label="Monto (USD)"
              value={ndMonto}
              onChange={setNdMonto}
              decimal
              placeholder="0.00"
              required
            />
            <button
              type="button"
              onClick={registrarConsumo}
              disabled={ndSaving}
              className="btn-primary w-full disabled:opacity-60">
              {ndSaving ? 'Registrando…' : '+ Registrar consumo'}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Modal: Nuevo cliente ───────────────────────────────────────────── */}
      <Modal
        open={showNuevoCliente}
        onClose={() => setShowNuevoCliente(false)}
        title="Nuevo cliente"
      >
        <div className="space-y-4 mt-2">
          <InputField label="Nombre" value={ncNombre} onChange={setNcNombre} placeholder="Nombre completo" required/>
          <InputField label="Teléfono (opcional)" value={ncTelefono} onChange={setNcTelefono} placeholder="04XX-XXX-XXXX"/>
          <p className="text-xs text-gray-400">Límite de crédito: $10.00 USD</p>
          <button
            type="button"
            onClick={crearCliente}
            disabled={ncSaving}
            className="btn-primary w-full disabled:opacity-60">
            {ncSaving ? 'Creando…' : '+ Crear cliente'}
          </button>
        </div>
      </Modal>

      {/* ── Modal: Registrar pago ─────────────────────────────────────────── */}
      <Modal
        open={!!showPago}
        onClose={() => setShowPago(null)}
        title="Registrar pago"
      >
        {showPago && (
          <div className="space-y-4 mt-2">
            {/* Resumen deuda */}
            <div className="p-3 rounded-2xl bg-gray-50 space-y-1">
              <p className="font-bold text-gray-800">{showPago.nombre}</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Saldo pendiente</span>
                <span className="font-bold text-brand-brown">{fUSD(showPago.saldo)}</span>
              </div>
              {showPago.mora > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-500">Mora (5%)</span>
                  <span className="font-bold text-red-500">+{fUSD(showPago.mora)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1 mt-1">
                <span className="font-bold text-gray-700">Total a pagar</span>
                <span className="font-extrabold text-brand-orange">{fUSD(showPago.total_pagar)}</span>
              </div>
              {showPago.dias_atraso > 0 && (
                <p className="text-xs text-gray-400 pt-1">⏱ {showPago.dias_atraso} días de atraso</p>
              )}
            </div>

            <InputField
              label="Monto pagado (USD)"
              value={pagoMonto}
              onChange={setPagoMonto}
              decimal
              placeholder="0.00"
              required
            />
            <SelectField
              label="Forma de pago"
              value={pagoFormaPago}
              onChange={setPagoFormaPago}
              options={FORMAS_PAGO}
              required
            />
            <InputField
              label="Notas (opcional)"
              value={pagoNotas}
              onChange={setPagoNotas}
              placeholder="Referencia, observación…"
            />
            <button
              type="button"
              onClick={registrarPago}
              disabled={pagoSaving}
              className="btn-primary w-full disabled:opacity-60">
              {pagoSaving ? 'Registrando…' : '✓ Registrar pago'}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Modal: Historial ─────────────────────────────────────────────── */}
      <Modal
        open={!!historialDeudor}
        onClose={() => setHistorialDeudor(null)}
        title={historialDeudor ? `Historial · ${historialDeudor.nombre}` : 'Historial'}
      >
        <div className="mt-2">
          {historialLoading ? (
            <LoadingSpinner/>
          ) : historialItems.length === 0 ? (
            <EmptyState icon="📋" message="Sin movimientos registrados"/>
          ) : (
            <div className="space-y-2">
              {historialItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl ${
                    item.tipo === 'consumo' ? 'bg-red-50' : 'bg-emerald-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                    item.tipo === 'consumo' ? 'bg-red-100' : 'bg-emerald-100'
                  }`}>
                    {item.tipo === 'consumo' ? '🍽️' : '💳'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.descripcion}</p>
                    <p className="text-xs text-gray-400">{formatoFechaLista(item.fecha)}</p>
                  </div>
                  <p className={`font-bold text-sm shrink-0 ${
                    item.tipo === 'consumo' ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {item.tipo === 'consumo' ? '+' : '-'}{fUSD(item.monto_usd)}
                  </p>
                </div>
              ))}
              {/* Saldo actual al final del historial */}
              {historialDeudor && (
                <div className="flex justify-between items-center pt-2 px-3 border-t border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Saldo actual</span>
                  <span className="font-extrabold text-brand-orange">{fUSD(historialDeudor.total_pagar)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <BottomNav/>
    </div>
  )
}
