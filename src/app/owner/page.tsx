'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Coffee, Handshake, Timer, UtensilsCrossed } from 'lucide-react'
import { LoadingSpinner, Toast, useToast } from '@/components/ui'
import InternalUseBanner, { DISCLAIMER_INTERNO } from '@/components/InternalUseBanner'
import { hoy } from '@/lib/constants'
import type { OwnerAlert, OwnerMetrics, OwnerRange } from '@/lib/owner/types'

import OwnerHeader from './components/OwnerHeader'
import OwnerNav from './components/OwnerNav'
import RangeSelector from './components/RangeSelector'
import KpiGrid from './components/KpiGrid'
import SalesTrendChart from './components/SalesTrendChart'
import OrderMixChart from './components/OrderMixChart'
import HourlyHeatmap from './components/HourlyHeatmap'
import TopProductsCard from './components/TopProductsCard'
import AlertsList from './components/AlertsList'
import InsightsList from './components/InsightsList'
import DetailModal from './components/DetailModal'

function fmtBs(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export default function OwnerPage() {
  const today = useMemo(() => hoy(), [])
  const [range, setRange] = useState<OwnerRange>({
    key: 'hoy',
    desde: today,
    hasta: today,
  })
  const [data, setData] = useState<OwnerMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<OwnerAlert | null>(null)
  const { toast, show } = useToast()

  const fetchMetrics = useCallback(
    async (r: OwnerRange) => {
      setLoading(true)
      try {
        const qs = new URLSearchParams({
          range: r.key,
          desde: r.desde,
          hasta: r.hasta,
          _: String(Date.now()),
        }).toString()
        const res = await fetch(`/api/owner/metrics?${qs}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        const j = (await res.json().catch(() => ({}))) as
          | OwnerMetrics
          | { error?: string }
        if (!res.ok) {
          throw new Error((j as { error?: string }).error ?? `Error ${res.status}`)
        }
        setData(j as OwnerMetrics)
      } catch (e) {
        show(e instanceof Error ? e.message : 'No se pudieron cargar las métricas', 'error')
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [show]
  )

  useEffect(() => {
    fetchMetrics(range)
  }, [range, fetchMetrics])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchMetrics(range)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [range, fetchMetrics])

  return (
    <div className="pb-28">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <OwnerHeader />

      <div className="px-4 pt-4 space-y-4">
        <InternalUseBanner message={DISCLAIMER_INTERNO} storageKey="sazon.banner.disclaimer.owner" />

        <RangeSelector value={range} onChange={setRange} today={today} />

        {loading || !data ? (
          <LoadingSpinner />
        ) : (
          <>
            <KpiGrid kpis={data.kpis} />

            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Handshake size={14} className="text-orange-500" />
                  <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide">
                    Deudores activos
                  </p>
                </div>
                <p className="text-2xl font-extrabold text-gray-900">{data.deudores.count}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">clientes con saldo pendiente</p>
              </div>
              <div className="card p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Handshake size={14} className="text-orange-500" />
                  <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide">
                    Total adeudado
                  </p>
                </div>
                <p className="text-2xl font-extrabold text-gray-900">
                  ${data.deudores.totalUsd.toFixed(2)}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">USD sin mora</p>
              </div>
            </div>

            <SalesTrendChart trend={data.salesTrend30} compare={data.weekCompare} />

            <OrderMixChart mix={data.orderMix} />

            <HourlyHeatmap cells={data.heatmap} />

            <TopProductsCard
              topDesayuno={data.topDesayuno}
              topAlmuerzo={data.topAlmuerzo}
              topMargen={data.topMargen}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Coffee size={14} className="text-orange-500" />
                  <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide">
                    Desayuno (8–10h)
                  </p>
                </div>
                <p className="text-base font-extrabold text-gray-900">
                  {data.comparativaHoraria.desayuno.ordenes} órdenes
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Bs {fmtBs(data.comparativaHoraria.desayuno.ingresoBs)} · ticket{' '}
                  Bs {fmtBs(data.comparativaHoraria.desayuno.ticketPromedio)}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-[10.5px] text-gray-400">
                  <Timer size={11} /> Prep prom. {data.prepTime.desayuno} min
                </div>
              </div>
              <div className="card p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <UtensilsCrossed size={14} className="text-orange-500" />
                  <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide">
                    Almuerzo (12–14h)
                  </p>
                </div>
                <p className="text-base font-extrabold text-gray-900">
                  {data.comparativaHoraria.almuerzo.ordenes} órdenes
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Bs {fmtBs(data.comparativaHoraria.almuerzo.ingresoBs)} · ticket{' '}
                  Bs {fmtBs(data.comparativaHoraria.almuerzo.ticketPromedio)}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-[10.5px] text-gray-400">
                  <Timer size={11} /> Prep prom. {data.prepTime.almuerzo} min
                </div>
              </div>
            </div>

            <AlertsList alerts={data.alerts} onSeeDetail={setDetail} />
            <InsightsList insights={data.insights} />
          </>
        )}
      </div>

      <DetailModal alert={detail} onClose={() => setDetail(null)} />

      <OwnerNav />
    </div>
  )
}
