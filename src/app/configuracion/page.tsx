'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { Toast, useToast, LoadingSpinner, InputField } from '@/components/ui'
import { BEBIDAS, parseDecimalInput } from '@/lib/constants'

type PreciosPayload = {
  empanada_bs: number
  tasa_bcv: number | null
  precios_bebidas: Record<string, number>
}

function PriceCard({ emoji, name, desc, value, onChange, fullWidth = false }: {
  emoji: string; name: string; desc: string; value: string
  onChange: (v: string) => void; fullWidth?: boolean
}) {
  return (
    <div className={`rounded-2xl border-2 border-gray-100 bg-white shadow-sm p-3 ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="text-3xl mb-2">{emoji}</div>
      <p className="font-bold text-sm text-gray-800 leading-tight">{name}</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-3 leading-snug">{desc}</p>
      <InputField label="Precio (Bs)" value={value} onChange={onChange} decimal placeholder="0,00" />
    </div>
  )
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
      const res = await fetch(`/api/precios?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
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
    const emp = parseDecimalInput(empanada)
    if (!Number.isFinite(emp) || emp < 0) {
      show('Precio de empanada no válido', 'error')
      return
    }
    const precios_bebidas: Record<string, number> = {}
    for (const b of BEBIDAS) {
      const v = parseDecimalInput(bebidas[b.value] ?? '0')
      precios_bebidas[b.value] = Number.isFinite(v) ? Math.max(0, v) : 0
    }
    const body: PreciosPayload = {
      empanada_bs: emp,
      tasa_bcv:
        tasaBcv.trim() === '' ? null : parseDecimalInput(tasaBcv),
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
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'No se guardó')
      }
      show('Precios guardados ✓')
      // Releemos desde DB para confirmar que lo persistido es lo que el usuario ve.
      await load()
    } catch (e: unknown) {
      show(String(e instanceof Error ? e.message : 'Error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-24">
      {toast && <Toast message={toast.message} type={toast.type}/>}

      <PageHeader
        title="Configuración"
        subtitle="Actualizá los precios cuando cambie la tasa de cada semana"
        colorClass="header-orange"
        onBack
      />

      <div className="px-4 pt-4 space-y-6">
        {loading ? (
          <LoadingSpinner/>
        ) : (
          <>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Producto principal</p>
              <div className="grid grid-cols-2 gap-3">
                <PriceCard
                  emoji="🥟"
                  name="Empanada"
                  desc="Precio por unidad"
                  value={empanada}
                  onChange={setEmpanada}
                  fullWidth
                />
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <InputField
                label="Tasa referencial BCV (Bs por 1 USD) — solo memo"
                value={tasaBcv}
                onChange={setTasaBcv}
                decimal
                placeholder="Ej. 36,50 (opcional)"
              />
              <p className="text-xs text-gray-500">
                Sirve solo como referencia visual; el total del ingreso se calcula con los precios fijos de arriba.
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Bebidas</p>
              <div className="grid grid-cols-2 gap-3">
                <PriceCard emoji="🥤" name="Coca-Cola"    desc="Por unidad" value={bebidas['coca_cola']    ?? '0'} onChange={(v) => setBebidas((p) => ({ ...p, coca_cola:    v }))} />
                <PriceCard emoji="🧃" name="Jugo Natural" desc="Por unidad" value={bebidas['jugo_natural'] ?? '0'} onChange={(v) => setBebidas((p) => ({ ...p, jugo_natural: v }))} />
                <PriceCard emoji="🍺" name="Malta"        desc="Por unidad" value={bebidas['malta']        ?? '0'} onChange={(v) => setBebidas((p) => ({ ...p, malta:        v }))} />
                <PriceCard emoji="💧" name="Agua"         desc="Por unidad" value={bebidas['agua']         ?? '0'} onChange={(v) => setBebidas((p) => ({ ...p, agua:         v }))} />
              </div>
            </div>

            <button type="button" onClick={() => save()} disabled={saving}
              className="btn-primary w-full py-4 disabled:opacity-60">
              <Save size={18}/> {saving ? 'Guardando…' : 'Guardar precios'}
            </button>
          </>
        )}
      </div>

      <BottomNav/>
    </div>
  )
}
