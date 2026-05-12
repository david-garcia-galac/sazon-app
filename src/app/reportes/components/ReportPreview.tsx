'use client'
import { useEffect, useMemo, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { formatBs, formatUSD, formatoFechaLista, labelCategoria } from '@/lib/constants'
import { buildReportPdf, downloadBlob } from '@/lib/reportes/pdf'
import {
  REPORT_RANGE_LABELS,
  REPORT_TYPE_LABELS,
  type ReportData,
} from '@/lib/reportes/types'

interface Props {
  data: ReportData
}

export default function ReportPreview({ data }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [filename, setFilename] = useState<string>('reporte.pdf')

  // Reconstruimos el PDF cuando cambia la data. Liberamos object URLs viejos.
  useEffect(() => {
    const { blob, filename: fn } = buildReportPdf(data)
    const url = URL.createObjectURL(blob)
    setPdfUrl(url)
    setFilename(fn)
    return () => URL.revokeObjectURL(url)
  }, [data])

  const handleDownload = () => {
    const { blob, filename: fn } = buildReportPdf(data)
    downloadBlob(blob, fn)
  }

  const cfgLabel = useMemo(
    () =>
      `${REPORT_TYPE_LABELS[data.config.type]} · ${REPORT_RANGE_LABELS[data.config.range]}`,
    [data.config]
  )

  const showIngresos =
    data.config.type === 'ingresos' || data.config.type === 'resumen'
  const showEgresos =
    data.config.type === 'egresos' || data.config.type === 'resumen'

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.07em]">
              Vista previa
            </p>
            <p className="text-[15px] font-extrabold text-gray-900 leading-tight truncate">
              {cfgLabel}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.config.desde === data.config.hasta
                ? data.config.desde
                : `${data.config.desde} → ${data.config.hasta}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="btn-secondary py-2.5 px-3 text-xs"
          >
            <Download size={14} /> PDF
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Mini
            label="Ingresos Bs"
            value={`Bs ${formatBs(data.totales.ingresosBs).replace(' Bs', '')}`}
            sub={data.totales.ingresosUsd > 0 ? `+ ${formatUSD(data.totales.ingresosUsd)} USD` : undefined}
            color="green"
          />
          {data.totales.ingresosEquivBs > 0 && (
            <Mini
              label="Divisas (equiv. Bs)"
              value={`Bs ${formatBs(data.totales.ingresosEquivBs).replace(' Bs', '')}`}
              sub={formatUSD(data.totales.ingresosUsd)}
              color="green"
            />
          )}
          <Mini
            label="Egresos"
            value={`Bs ${formatBs(data.totales.egresosBs).replace(' Bs', '')}`}
            sub={data.totales.egresosUsd > 0 ? `${formatUSD(data.totales.egresosUsd)} USD` : undefined}
            color="red"
          />
          <Mini
            label="Saldo total"
            value={`Bs ${formatBs(data.totales.saldoBs).replace(' Bs', '')}`}
            color={data.totales.saldoBs >= 0 ? 'green' : 'red'}
          />
          <Mini label="Ventas" value={String(data.totales.ventas)} color="orange" />
        </div>
      </div>

      {/* Listados compactos */}
      {showIngresos && (
        <Section title={`Ingresos (${data.ingresos.length})`}>
          {data.ingresos.length === 0 ? (
            <Empty msg="Sin ingresos en el rango" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.ingresos.slice(0, 30).map((r) => {
                const tipoLabel =
                  r.tipo === 'desayuno' ? '🥟 Empanadas' :
                  r.tipo === 'almuerzo' ? '☀️ Almuerzo'  :
                  r.tipo === 'bebida'   ? `🥤 ${(r.bebida ?? '').replace(/_/g, ' ')}` :
                  r.tipo
                const pagoLabel =
                  r.forma_pago === 'pago_movil'   ? 'Pago móvil'    :
                  r.forma_pago === 'transferencia' ? 'Punto de Venta' :
                  r.forma_pago
                return (
                  <li key={r.id} className="flex items-center justify-between py-2.5 gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {tipoLabel}
                        {r.moneda === 'USD' && (
                          <span className="ml-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">USD</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatoFechaLista(r.fecha)} · {pagoLabel}
                        {r.moneda === 'USD' && r.tasa ? ` · tasa ${r.tasa}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-emerald-700">
                        {r.moneda === 'USD'
                          ? formatUSD(Number(r.monto_usd ?? 0))
                          : formatBs(Number(r.monto))}
                      </p>
                      {r.moneda === 'USD' && (
                        <p className="text-[10px] text-gray-400">≈ {formatBs(Number(r.monto))}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {data.ingresos.length > 30 && (
            <p className="text-xs text-gray-400 mt-2">
              + {data.ingresos.length - 30} más en el PDF completo
            </p>
          )}
        </Section>
      )}

      {showEgresos && (
        <Section title={`Egresos (${data.egresos.length})`}>
          {data.egresos.length === 0 ? (
            <Empty msg="Sin egresos en el rango" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.egresos.slice(0, 30).map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {labelCategoria(r.categoria)}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {formatoFechaLista(r.fecha)} ·{' '}
                      {r.proveedor ?? r.descripcion ?? r.forma_pago}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-red-600 shrink-0">
                    {r.moneda === 'USD' ? formatUSD(Number(r.monto)) : formatBs(Number(r.monto))}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {data.egresos.length > 30 && (
            <p className="text-xs text-gray-400 mt-2">
              + {data.egresos.length - 30} más en el PDF completo
            </p>
          )}
        </Section>
      )}

      {/* PDF embebido (en mobile se ve mal en algunos browsers; lo mostramos solo cuando hay altura) */}
      {pdfUrl && (
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={15} className="text-orange-500" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              PDF generado
            </p>
            <span className="ml-auto text-[11px] text-gray-400 truncate">{filename}</span>
          </div>
          <iframe
            title="PDF preview"
            src={pdfUrl}
            className="w-full rounded-xl border border-gray-200 bg-gray-50"
            style={{ height: '60vh', minHeight: 360 }}
          />
        </div>
      )}
    </div>
  )
}

function Mini({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: 'green' | 'red' | 'orange'
}) {
  const bg = { green: 'bg-emerald-50', red: 'bg-red-50', orange: 'bg-orange-50' }
  const text = { green: 'text-emerald-700', red: 'text-red-600', orange: 'text-orange-600' }
  return (
    <div className={`rounded-2xl ${bg[color]} p-3`}>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-[17px] font-extrabold ${text[color]} leading-tight mt-0.5`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="section-title">{title}</p>
      {children}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-gray-400 py-3">{msg}</p>
}
