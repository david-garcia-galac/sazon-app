'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { LoadingSpinner, Toast, useToast } from '@/components/ui'
import { hoy } from '@/lib/constants'
import { buildReportPdf, downloadBlob } from '@/lib/reportes/pdf'
import {
  listHistory,
  removeHistory as removeFromHistory,
} from '@/lib/reportes/history'
import type {
  ReportConfig,
  ReportData,
  ReportHistoryItem,
} from '@/lib/reportes/types'

import ReportForm from './components/ReportForm'
import ReportPreview from './components/ReportPreview'
import WhatsAppSender from './components/WhatsAppSender'
import HistoryList from './components/HistoryList'

const defaultConfig = (): ReportConfig => ({
  type: 'resumen',
  range: 'diario',
  desde: hoy(),
  hasta: hoy(),
})

export default function ReportesPage() {
  const [config, setConfig] = useState<ReportConfig>(() => defaultConfig())
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<ReportHistoryItem[]>([])
  const { toast, show } = useToast()

  // El historial es localStorage → solo en cliente.
  useEffect(() => {
    setHistory(listHistory())
  }, [])

  const fetchData = useCallback(
    async (cfg: ReportConfig) => {
      setLoading(true)
      try {
        const qs = new URLSearchParams({
          type: cfg.type,
          range: cfg.range,
          desde: cfg.desde,
          hasta: cfg.hasta,
          _: String(Date.now()),
        }).toString()
        const res = await fetch(`/api/reportes/data?${qs}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        const j = (await res.json().catch(() => ({}))) as
          | ReportData
          | { error?: string }
        if (!res.ok) {
          throw new Error(
            (j as { error?: string }).error ?? `Error ${res.status}`
          )
        }
        setData(j as ReportData)
      } catch (e) {
        show(e instanceof Error ? e.message : 'Error al cargar datos', 'error')
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [show]
  )

  // Carga inicial + cada vez que cambia la configuración.
  useEffect(() => {
    fetchData(config)
  }, [config, fetchData])

  const handleDownload = useMemo(
    () => () => {
      if (!data) return
      const { blob, filename } = buildReportPdf(data)
      downloadBlob(blob, filename)
      show('PDF descargado ✓')
    },
    [data, show]
  )

  const removeHistory = (id: string) => {
    const next = removeFromHistory(id)
    setHistory(next)
  }

  return (
    <div className="pb-28">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <PageHeader
        title="Reportes"
        subtitle="Generá PDF y enviá por WhatsApp"
        colorClass="header-orange"
        onBack
        right={
          <button
            type="button"
            onClick={handleDownload}
            disabled={!data}
            className="p-2 rounded-xl bg-white/20 text-white active:scale-90 disabled:opacity-50"
            aria-label="Descargar PDF"
          >
            <Download size={16} />
          </button>
        }
      />

      <div className="px-4 pt-4 space-y-4">
        <ReportForm value={config} onChange={setConfig} />

        {loading && <LoadingSpinner />}

        {!loading && data && (
          <>
            <ReportPreview data={data} />
            <WhatsAppSender
              data={data}
              onSent={(item) =>
                setHistory((prev) => [item, ...prev.filter((p) => p.id !== item.id)])
              }
              onShowToast={show}
            />
          </>
        )}

        <section>
          <p className="section-title">Historial reciente</p>
          <HistoryList items={history} onRemove={removeHistory} />
        </section>
      </div>

      <BottomNav />
    </div>
  )
}
