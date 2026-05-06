'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, AlertCircle, LogOut, Wifi, WifiOff, Plus } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { StatCard, LoadingSpinner, Toast, useToast } from '@/components/ui'
import { formatBs, hoy, inicioSemana, inicioMes } from '@/lib/constants'
import { getSyncQueue, clearSyncItem } from '@/lib/idb'

interface DashData {
  hoy: { ingresos: number; egresos: number; ventas: number; saldo: number }
  semana: { ingresos: number; egresos: number; saldo: number }
  mes: { ingresos: number; egresos: number; saldo: number }
  deudasPendientes: Array<{ id: string; proveedor_nombre: string; monto_total: number; monto_pagado: number; moneda: string; fecha_vencimiento?: string }>
}

export default function DashboardPage() {
  const [data, setData]     = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [syncing, setSyncing] = useState(false)
  const { toast, show } = useToast()
  const router = useRouter()

  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?hoy=${hoy()}&semana=${inicioSemana()}&mes=${inicioMes()}`)
      if (res.ok) setData(await res.json())
    } catch { /* offline */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const sync = async () => {
    setSyncing(true)
    try {
      const queue = await getSyncQueue()
      if (!queue.length) { show('Todo está sincronizado ✓'); setSyncing(false); return }
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: queue }),
      })
      if (res.ok) {
        const { synced } = await res.json()
        for (const item of queue) await clearSyncItem(item.id)
        show(`${synced} registro(s) sincronizados ✓`)
        load()
      }
    } catch { show('Error al sincronizar', 'error') } finally { setSyncing(false) }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="pb-24">
      {toast && <Toast message={toast.message} type={toast.type}/>}

      {/* Header */}
      <div
        className="bg-brand-orange px-4 pb-5"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        {/* Fila: logo + nombre + acciones */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white/40 flex-shrink-0 bg-white/10">
              <img src="/sazon-logo.jpeg" alt="Logo" className="w-full h-full object-contain"/>
            </div>
            <h1 className="text-white font-bold text-base leading-tight truncate">
              El Sazón de Amparo
            </h1>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {online
              ? <Wifi size={15} className="text-green-300"/>
              : <WifiOff size={15} className="text-orange-300"/>}
            <button onClick={sync} disabled={syncing} className="p-2 rounded-xl bg-white/20 active:scale-95">
              <RefreshCw size={15} className={`text-white ${syncing ? 'animate-spin' : ''}`}/>
            </button>
            <button onClick={logout} className="p-2 rounded-xl bg-white/20 active:scale-95">
              <LogOut size={15} className="text-white"/>
            </button>
          </div>
        </div>
        {/* Fecha en línea propia para evitar solapamiento */}
        <p className="text-orange-100 text-xs mt-2 ml-1 capitalize">
          {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="px-4 pt-3 space-y-4">

        {/* Alertas deudas */}
        {data && data.deudasPendientes.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                {data.deudasPendientes.length} deuda(s) pendiente(s)
              </p>
              {data.deudasPendientes.slice(0,2).map(d => (
                <p key={d.id} className="text-xs text-amber-600 mt-0.5">
                  • {d.proveedor_nombre}: {formatBs(d.monto_total - d.monto_pagado)} pendiente
                </p>
              ))}
              <button onClick={() => router.push('/proveedores')} className="text-xs text-amber-700 font-medium mt-1 underline">
                Ver todas →
              </button>
            </div>
          </div>
        )}

        {loading ? <LoadingSpinner/> : (
          <>
            {/* Hoy */}
            <section>
              <h2 className="section-title">📅 Hoy</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Ventas" value={`${data?.hoy.ventas ?? 0}`} color="orange" icon="🍽️"/>
                <StatCard label="Ingresos" value={formatBs(data?.hoy.ingresos ?? 0)} color="green" icon="💵"/>
                <StatCard label="Egresos" value={formatBs(data?.hoy.egresos ?? 0)} color="red" icon="📤"/>
                <StatCard
                  label="Saldo del día"
                  value={formatBs(data?.hoy.saldo ?? 0)}
                  color={(data?.hoy.saldo ?? 0) >= 0 ? 'green' : 'red'}
                  icon="💰"
                />
              </div>
            </section>

            {/* Esta semana */}
            <section>
              <h2 className="section-title">📊 Esta semana</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Ingresos" value={formatBs(data?.semana.ingresos ?? 0)} color="green"/>
                <StatCard label="Egresos"  value={formatBs(data?.semana.egresos ?? 0)}  color="red"/>
              </div>
              <div className="mt-3">
                <StatCard
                  label="Balance semanal"
                  value={formatBs(data?.semana.saldo ?? 0)}
                  color={(data?.semana.saldo ?? 0) >= 0 ? 'green' : 'red'}
                />
              </div>
            </section>

            {/* Este mes */}
            <section>
              <h2 className="section-title">📈 Este mes</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Ingresos" value={formatBs(data?.mes.ingresos ?? 0)} color="green"/>
                <StatCard label="Egresos"  value={formatBs(data?.mes.egresos ?? 0)}  color="red"/>
              </div>
              <div className="mt-3">
                <StatCard
                  label="Balance mensual"
                  value={formatBs(data?.mes.saldo ?? 0)}
                  color={(data?.mes.saldo ?? 0) >= 0 ? 'green' : 'red'}
                />
              </div>
            </section>

            {/* Accesos rápidos */}
            <section>
              <h2 className="section-title">⚡ Acceso rápido</h2>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => router.push('/ingresos?nuevo=1')}
                  className="btn-primary py-4 text-sm">
                  <Plus size={18}/> Nuevo ingreso
                </button>
                <button onClick={() => router.push('/egresos?nuevo=1')}
                  className="bg-red-500 text-white font-semibold rounded-xl px-5 py-4
                  active:scale-95 transition-transform flex items-center justify-center gap-2 text-sm">
                  <Plus size={18}/> Nuevo egreso
                </button>
              </div>
            </section>
          </>
        )}
      </div>
      <BottomNav/>
    </div>
  )
}
