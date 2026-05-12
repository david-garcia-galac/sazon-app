'use client'
import { useEffect, useState, useCallback } from 'react'
import { Save, Plus, Trash2 } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { Toast, useToast, LoadingSpinner, InputField, Modal } from '@/components/ui'
import { BEBIDAS, parseDecimalInput, PRODUCTOS_DEFAULT } from '@/lib/constants'
import type { ProductoCatalog } from '@/lib/constants'

const EMOJI_PRESETS = ['🥤', '🧃', '🍺', '💧', '🍹', '⚡', '🍪', '🍬', '🧁', '🍫', '🥛', '🫙']

function PriceCard({
  emoji, imageSrc, name, value, onChange, onDelete,
}: {
  emoji: string
  imageSrc?: string
  name: string
  value: string
  onChange: (v: string) => void
  onDelete?: () => void
}) {
  return (
    <div className="relative rounded-2xl border-2 border-gray-100 bg-white shadow-sm p-3">
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-50 flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Eliminar">
          <Trash2 size={12} className="text-red-400"/>
        </button>
      )}
      {imageSrc ? (
        <img src={imageSrc} alt={name} className="w-12 h-12 object-contain mb-2"/>
      ) : (
        <div className="text-3xl mb-2">{emoji}</div>
      )}
      <p className="font-bold text-sm text-gray-800 leading-tight pr-6">{name}</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">Por unidad</p>
      <InputField label="Precio (Bs)" value={value} onChange={onChange} decimal placeholder="0,00" />
    </div>
  )
}

export default function ConfiguracionPage() {
  const { toast, show } = useToast()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [empanada, setEmpanada] = useState('')
  const [tasaBcv, setTasaBcv]   = useState('')
  const [productos, setProductos] = useState<ProductoCatalog[]>([])

  const [showAddModal, setShowAddModal] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newEmoji, setNewEmoji] = useState('🥤')
  const [newPrice, setNewPrice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/precios?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((d as { error?: string }).error ?? `${res.status}`)
      setEmpanada(String((d as { empanada_bs: number }).empanada_bs ?? 0))
      setTasaBcv((d as { tasa_bcv?: number | null }).tasa_bcv != null ? String((d as { tasa_bcv: number }).tasa_bcv) : '')
      const cat = (d as { productos_catalog?: ProductoCatalog[] }).productos_catalog
      setProductos(Array.isArray(cat) && cat.length > 0 ? cat : PRODUCTOS_DEFAULT)
    } catch (e) {
      show(e instanceof Error ? e.message : 'Error al cargar configuración', 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { load() }, [load])

  const save = async () => {
    const emp = parseDecimalInput(empanada)
    if (!Number.isFinite(emp) || emp < 0) { show('Precio de empanada no válido', 'error'); return }
    const tasa_bcv = tasaBcv.trim() === '' ? null : parseDecimalInput(tasaBcv)
    if (tasa_bcv != null && (!Number.isFinite(tasa_bcv) || tasa_bcv <= 0)) {
      show('La tasa BCV debe ser mayor a cero si la indicás', 'error'); return
    }
    const precios_bebidas: Record<string, number> = {}
    for (const b of BEBIDAS) precios_bebidas[b.value] = 0
    for (const p of productos) precios_bebidas[p.id] = p.price

    setSaving(true)
    try {
      const res = await fetch('/api/precios', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ empanada_bs: emp, tasa_bcv, precios_bebidas, productos_catalog: productos }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'No se guardó') }
      show('Precios guardados ✓')
      await load()
    } catch (e: unknown) {
      show(String(e instanceof Error ? e.message : 'Error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const updatePrice = (id: string, value: string) => {
    const price = parseDecimalInput(value)
    setProductos((prev) =>
      prev.map((p) => p.id === id ? { ...p, price: Number.isFinite(price) ? Math.max(0, price) : p.price } : p)
    )
  }

  const deleteProduct = (id: string) => setProductos((prev) => prev.filter((p) => p.id !== id))

  const addProduct = () => {
    if (!newName.trim()) { show('Indicá el nombre del producto', 'error'); return }
    const price = parseDecimalInput(newPrice)
    if (!Number.isFinite(price) || price < 0) { show('Precio no válido', 'error'); return }
    const id = newName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    setProductos((prev) => [...prev, { id: `${id}_${Date.now()}`, name: newName.trim(), emoji: newEmoji, price }])
    setNewName(''); setNewEmoji('🥤'); setNewPrice('')
    setShowAddModal(false)
  }

  return (
    <div className="pb-24">
      {toast && <Toast message={toast.message} type={toast.type}/>}

      <PageHeader
        title="Configuración"
        subtitle="Actualizá los precios cuando cambie la tasa"
        colorClass="header-orange"
        onBack
        showLogout
      />

      <div className="px-4 pt-4 space-y-6">
        {loading ? (
          <LoadingSpinner/>
        ) : (
          <>
            {/* Empanada */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Producto principal</p>
              <PriceCard
                emoji=""
                imageSrc="/empanada.png"
                name="Empanada"
                value={empanada}
                onChange={setEmpanada}
              />
            </div>

            {/* BCV */}
            <div className="card p-4 space-y-3">
              <InputField
                label="Tasa referencial BCV (Bs por 1 USD) — solo memo"
                value={tasaBcv}
                onChange={setTasaBcv}
                decimal
                placeholder="Ej. 36,50 (opcional)"
              />
              <p className="text-xs text-gray-500">
                Sirve solo como referencia visual; el total del ingreso se calcula con los precios fijos.
              </p>
            </div>

            {/* Productos extra */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Extras y bebidas</p>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold active:scale-95 transition-transform">
                  <Plus size={13}/> Agregar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {productos.map((prod) => (
                  <PriceCard
                    key={prod.id}
                    emoji={prod.emoji}
                    name={prod.name}
                    value={String(prod.price)}
                    onChange={(v) => updatePrice(prod.id, v)}
                    onDelete={() => deleteProduct(prod.id)}
                  />
                ))}
              </div>
            </div>

            <button type="button" onClick={save} disabled={saving}
              className="btn-primary w-full py-4 disabled:opacity-60">
              <Save size={18}/> {saving ? 'Guardando…' : 'Guardar precios'}
            </button>
          </>
        )}
      </div>

      {/* Modal agregar producto */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Nuevo producto">
        <div className="space-y-4 mt-2">
          <InputField label="Nombre" value={newName} onChange={setNewName} placeholder="Ej. Refresco 250ml" required/>
          <div>
            <label className="label">Ícono</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setNewEmoji(e)}
                  className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all ${newEmoji === e ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-gray-50'}`}>
                  {e}
                </button>
              ))}
            </div>
            <InputField label="O escribí un emoji" value={newEmoji} onChange={setNewEmoji} placeholder="🥤"/>
          </div>
          <InputField label="Precio (Bs)" value={newPrice} onChange={setNewPrice} decimal placeholder="0,00" required/>
          <button type="button" onClick={addProduct} className="btn-primary w-full">
            + Agregar producto
          </button>
        </div>
      </Modal>

      <BottomNav/>
    </div>
  )
}
