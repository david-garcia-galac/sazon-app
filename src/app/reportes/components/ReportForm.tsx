'use client'
import { useMemo } from 'react'
import { Calendar, FileText, Layers } from 'lucide-react'
import { fechaLocal, hoy, inicioSemana } from '@/lib/constants'
import {
  REPORT_RANGE_LABELS,
  REPORT_TYPE_LABELS,
  type ReportConfig,
  type ReportRange,
  type ReportType,
} from '@/lib/reportes/types'

interface Props {
  value: ReportConfig
  onChange: (next: ReportConfig) => void
}

function rangoSemanaActual(): { desde: string; hasta: string } {
  return { desde: inicioSemana(), hasta: hoy() }
}

function rangoDia(d: string): { desde: string; hasta: string } {
  return { desde: d, hasta: d }
}

export default function ReportForm({ value, onChange }: Props) {
  const today = useMemo(() => hoy(), [])

  const setType = (type: ReportType) => onChange({ ...value, type })

  const setRange = (range: ReportRange) => {
    if (range === 'diario') {
      onChange({ ...value, range, ...rangoDia(value.desde || today) })
    } else {
      onChange({ ...value, range, ...rangoSemanaActual() })
    }
  }

  const setDesde = (desde: string) => {
    if (value.range === 'diario') onChange({ ...value, desde, hasta: desde })
    else {
      const hasta = value.hasta < desde ? desde : value.hasta
      onChange({ ...value, desde, hasta })
    }
  }

  const setHasta = (hasta: string) => {
    const desde = hasta < value.desde ? hasta : value.desde
    onChange({ ...value, desde, hasta })
  }

  const opcionesTipo: ReportType[] = ['ingresos', 'egresos', 'resumen']
  const opcionesRango: ReportRange[] = ['diario', 'semanal']

  const today10 = fechaLocal(new Date())

  return (
    <div className="card p-4 space-y-5">
      {/* Tipo */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <FileText size={16} className="text-orange-500" />
          <label className="label mb-0">Tipo de reporte</label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {opcionesTipo.map((t) => {
            const active = value.type === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-2xl border px-3 py-2.5 text-xs font-bold tracking-wide transition-all active:scale-[0.97] ${
                  active
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                {REPORT_TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Rango */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Layers size={16} className="text-orange-500" />
          <label className="label mb-0">Rango</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {opcionesRango.map((r) => {
            const active = value.range === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-2xl border px-3 py-2.5 text-xs font-bold tracking-wide transition-all active:scale-[0.97] ${
                  active
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                {REPORT_RANGE_LABELS[r]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Fechas */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Calendar size={16} className="text-orange-500" />
          <label className="label mb-0">
            {value.range === 'diario' ? 'Día' : 'Desde / Hasta'}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={value.desde}
            max={today10}
            onChange={(e) => setDesde(e.target.value)}
            className="input-field"
          />
          <input
            type="date"
            value={value.hasta}
            max={today10}
            disabled={value.range === 'diario'}
            onChange={(e) => setHasta(e.target.value)}
            className="input-field disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {value.range === 'diario'
            ? 'Reporte de un solo día.'
            : 'Por defecto: lunes de esta semana hasta hoy. Podés ajustarlo.'}
        </p>
      </div>
    </div>
  )
}
