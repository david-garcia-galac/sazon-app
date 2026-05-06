'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { Toast, useToast, LoadingSpinner, InputField } from '@/components/ui'
import { BEBIDAS } from '@/lib/constants'

type PreciosPayload = {
  empanada_bs: number
  tasa_bcv: number | null
  precios_bebidas: Record<string, number>
}

export default function ConfiguracionPage() {
  const router = useRouter()
  const { toast, show } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [empanada, setEmpanada] = useState('')
  const [tasaBcv, setTasaBcv] = useState('')
  const [bebidas, setBebidas] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/precios')
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof (d as { error?: string }).error === 'string'
            ? (d as { error: string }).error
            : `${res.status} ${res.statusText}`
        throw new Error(msg)
      }
      if (
        !(d && typeof (d as PreciosPayload).precios_bebidas === 'object') ||
        (d as PreciosPayload).precios_bebidas == null
      ) {
        throw new Error('Respuesta inválida del servidor')
      }
      const p = d as PreciosPayload
      setEmpanada(String(p.empanada_bs))
      setTasaBcv(p.tasa_bcv != null ? String(p.tasa_bcv) : '')
      const next: Record<string, string> = {}
      for (const b of BEBIDAS) next[b.value] = String(p.precios_bebidas[b.value] ?? 0)
      setBebidas(next)
    } catch (e) {
      show(
        e instanceof Error ? e.message : 'Error al cargar configuración',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    const emp = parseFloat(empanada)
    if (!Number.isFinite(emp) || emp < 0) {
      show('Precio de empanada no válido', 'error')
      return
    }
    const precios_bebidas: Record<string, number> = {}
    for (const b of BEBIDAS) {
      const v = parseFloat(bebidas[b.value] ?? '0')
      precios_bebidas[b.value] = Number.isFinite(v) ? Math.max(0, v) : 0
    }
    const body: PreciosPayload = {
      empanada_bs: emp,
      tasa_bcv:
        tasaBcv.trim() === '' ? null : Number(tasaBcv),
      precios_bebidas,
    }
    if (
      body.tasa_bcv != null &&
      (!Number.isFinite(body.tasa_bcv) || body.tasa_bcv <= 0)
    ) {
      show('La tasa BCV debe ser mayor a cero si la indicás', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/precios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'No se guardó')
      }
      show('Precios guardados ✓')
    } catch (e: unknown) {
      show(String(e instanceof Error ? e.message : 'Error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-24">
      {toast && <Toast message={toast.message} type={toast.type}/>}

      <div className="bg-brand-orange px-4 pt-10 pb-5 safe-top">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white/20 text-white shrink-0"
            aria-label="Volver">
            <ArrowLeft size={20}/>
          </button>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight">Configuración</h1>
            <p className="text-orange-100 text-xs mt-1">
              Precios por empanada y bebida (Bs.). Actualizalos cuando cambie la tasa referencial de
              cada semana según convenga para el margen del negocio.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {loading ? (
          <LoadingSpinner/>
        ) : (
          <>
            <div className="card p-4 space-y-4">
              <InputField
                label="Precio por empanada (Bs)"
                value={empanada}
                onChange={setEmpanada}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
              <InputField
                label="Tasa referencial BCV (Bs por 1 USD) — sólo ayuda memo"
                value={tasaBcv}
                onChange={setTasaBcv}
                type="number"
                step="0.01"
                placeholder="Ej. 36.50 (opcional)"
              />
              <p className="text-xs text-gray-500">
                El campo BCV sirve solo como referencia en este panel para recordar la tasa con la que
                afinaste esta semana; el total del ingreso se arma con los precios fijos que cargues
                aquí arriba.
              </p>
            </div>

            <div>
              <h2 className="section-title mb-3">Precio de bebida (Bs cada una)</h2>
              <div className="space-y-3">
                {BEBIDAS.map((b) => (
                  <div key={b.value} className="card p-4">
                    <InputField
                      label={b.label}
                      value={bebidas[b.value] ?? '0'}
                      onChange={(v) => setBebidas((prev) => ({ ...prev, [b.value]: v }))}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button type="button" onClick={() => save()} disabled={saving} className="btn-primary w-full py-4">
              <Save size={18}/> {saving ? 'Guardando…' : 'Guardar precios'}
            </button>
          </>
        )}
      </div>

      <BottomNav/>
    </div>
  )
}
