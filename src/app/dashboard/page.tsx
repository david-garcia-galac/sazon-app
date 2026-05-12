'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, LogOut, Wifi, WifiOff, Plus, Settings, FileText } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { DashboardDiaResumen, type PeriodoDetalleIngresos } from '@/components/DashboardDiaResumen'
import InternalUseBanner, { DISCLAIMER_INTERNO } from '@/components/InternalUseBanner'
import { LoadingSpinner, Toast, useToast } from '@/components/ui'
import { hoy } from '@/lib/constants'
import { getSyncQueue, clearSyncItem } from '@/lib/idb'

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
  const [data, setData]         = useState<DashData | null>(null)
  const [fechaDia, setFechaDia] = useState(() => hoy())
  const [loading, setLoading]   = useState(true)
  const [online, setOnline]     = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [syncing, setSyncing]   = useState(false)
  const { toast, show }         = useToast()
  const router                  = useRouter()

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
        `/api/dashboard?hoy=${encodeURIComponent(hoy())}&dia=${encodeURIComponent(fechaDia)}&_=${Date.now()}`,
        { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
      )
      if (res.ok) setData(await res.json())
      else if (!background) show('No se pudo cargar el resumen', 'error')
    } catch {
      if (!background) show('Sin conexión o error al cargar', 'error')
    } finally {
      if (!background) setLoading(false)
    }
  }, [show, fechaDia])

  useEffect(() => { load(false) }, [load])

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load(true) }
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

  return (
    <div className="pb-24">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div
        className="bg-brand-orange px-4 pb-6"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white/40 flex-shrink-0 bg-white/10">
              <img src="/sazon-logo.jpeg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-base leading-tight truncate">
                El Sazón de Amparo
              </h1>
              <p className="text-orange-100 text-xs capitalize mt-0.5">
                {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {online
              ? <Wifi size={15} className="text-green-300" />
              : <WifiOff size={15} className="text-orange-300" />}
            <button onClick={sync} disabled={syncing} className="p-2 rounded-xl bg-white/20 active:scale-95">
              <RefreshCw size={15} className={`text-white ${syncing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={logout} className="p-2 rounded-xl bg-white/20 active:scale-95">
              <LogOut size={15} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <InternalUseBanner message={DISCLAIMER_INTERNO} />

        {loading ? <LoadingSpinner /> : (
          <>
            <DashboardDiaResumen
              fechaValue={fechaDia}
              onFechaChange={setFechaDia}
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
              <p className="section-title">Acceso rápido</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => router.push('/ingresos?nuevo=1')}
                  className="btn-primary py-4 text-sm font-bold"
                >
                  <Plus size={18} /> Nuevo ingreso
                </button>
                <button
                  onClick={() => router.push('/egresos?nuevo=1')}
                  className="btn-danger py-4 text-sm font-bold"
                >
                  <Plus size={18} /> Nuevo egreso
                </button>
              </div>
              <button
                type="button"
                onClick={() => router.push('/configuracion')}
                className="mt-3 w-full btn-secondary py-4 text-sm"
              >
                <Settings size={18} /> Precios empanadas y bebidas
              </button>
              <button
                type="button"
                onClick={() => router.push('/reportes')}
                className="mt-3 w-full btn-secondary py-4 text-sm"
              >
                <FileText size={18} /> Reportes y envío por WhatsApp
              </button>
            </section>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
