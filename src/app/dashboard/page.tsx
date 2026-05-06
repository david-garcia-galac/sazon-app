'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, AlertCircle, LogOut, Wifi, WifiOff, Plus, Settings } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { DashboardDiaResumen, type PeriodoDetalleIngresos } from '@/components/DashboardDiaResumen'
import { LoadingSpinner, Toast, useToast } from '@/components/ui'
import { formatBs, hoy } from '@/lib/constants'
import { getSyncQueue, clearSyncItem } from '@/lib/idb'

type IngresoTab = 'bs' | 'usd' | 'conc'

interface DashData {
  diaResumen?: string
  hoy: { ingresos: number; egresos: number; ventas: number; saldo: number }
  deudasPendientes: Array<{
    id: string
    proveedor_nombre: string
    monto_total: number
    monto_pagado: number
    moneda: string
    fecha_vencimiento?: string
  }>
  ingresosDetalleHoy?: PeriodoDetalleIngresos
}

export default function DashboardPage() {
  const [data, setData]     = useState<DashData | null>(null)
  const [fechaDia, setFechaDia] = useState(() => hoy())
  const [ingTab, setIngTab] = useState<IngresoTab>('bs')
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

  const load = useCallback(async (background = false) => {
    try {
      if (!background) setLoading(true)
      const res = await fetch(
        `/api/dashboard?hoy=${encodeURIComponent(hoy())}&dia=${encodeURIComponent(fechaDia)}`
      )
      if (res.ok) setData(await res.json())
      else if (!background) show('No se pudo cargar el resumen', 'error')
    } catch {
      if (!background) show('Sin conexión o error al cargar', 'error')
    } finally {
      if (!background) setLoading(false)
    }
  }, [show, fechaDia])

  useEffect(() => {
    load(false)
  }, [load])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') load(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

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
        load(true)
      }
    } catch { show('Error al sincronizar', 'error') } finally { setSyncing(false) }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const tabBtn = (active: boolean) =>
    `flex-1 py-2 px-2 text-xs font-semibold rounded-xl transition-colors ${
      active ? 'bg-white text-brand-orange shadow-sm' : 'text-orange-100 active:bg-white/10'
    }`

  return (
    <div className="pb-24">
      {toast && <Toast message={toast.message} type={toast.type}/>}

      {/* Header */}
      <div
        className="bg-brand-orange px-4 pb-5"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
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
        <p className="text-orange-100 text-xs mt-2 ml-1 capitalize">
          {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="px-4 pt-3 space-y-4">

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
            <div className="sticky top-0 z-10 -mx-1 px-1 pt-2 pb-3 bg-gradient-to-b from-white from-80% to-transparent">
              <div className="flex rounded-2xl bg-orange-500/90 p-1 gap-1 shadow-inner">
                <button type="button" className={tabBtn(ingTab === 'bs')} onClick={() => setIngTab('bs')}>
                  Bs.
                </button>
                <button type="button" className={tabBtn(ingTab === 'usd')} onClick={() => setIngTab('usd')}>
                  USD
                </button>
                <button type="button" className={tabBtn(ingTab === 'conc')} onClick={() => setIngTab('conc')}>
                  Conciliación
                </button>
              </div>
              {ingTab === 'conc' && (
                <p className="text-xs text-gray-600 mt-2 px-0.5">
                  Compara cobros en bolívares con el equivalente en Bs de los efectivos USD (según la tasa al registrar) para revisar todo lo entrante.
                </p>
              )}
            </div>

            <DashboardDiaResumen
              fechaValue={fechaDia}
              onFechaChange={setFechaDia}
              ingTab={ingTab}
              detalle={
                data?.ingresosDetalleHoy ?? {
                  bs: { total: 0, efectivo: 0, pago_movil: 0, transferencia: 0, ventas: 0 },
                  usd: { totalUsd: 0, equivBs: 0, ventas: 0 },
                  conciliacion: {
                    ingresosBolivares: 0,
                    bolivaresEquivUsd: 0,
                    totalBolivares: 0,
                    totalDivisaUsd: 0,
                    ventasTotal: 0,
                  },
                }
              }
              agg={{
                egresos: data?.hoy?.egresos ?? 0,
                saldo: data?.hoy?.saldo ?? 0,
              }}
            />

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
              <button
                type="button"
                onClick={() => router.push('/configuracion')}
                className="mt-3 w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-orange-200 text-brand-brown font-semibold text-sm bg-white active:scale-[0.98] transition-transform">
                <Settings size={18}/> Precios empanadas y bebidas
              </button>
            </section>
          </>
        )}
      </div>
      <BottomNav/>
    </div>
  )
}
