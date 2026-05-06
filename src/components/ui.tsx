'use client'
import { useState, useEffect } from 'react'
import { X, Camera, Loader2 } from 'lucide-react'
import { uploadFoto } from '@/lib/cloudinary-client'

// ── Toast ─────────────────────────────────────────────
interface ToastProps { message: string; type?: 'success' | 'error' }
export function Toast({ message, type = 'success' }: ToastProps) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 fade-in-up
      ${type === 'success' ? 'toast-success' : 'toast-error'} max-w-xs text-center shadow-xl`}>
      {message}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2800)
  }
  return { toast, show }
}

// ── Modal ─────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}
export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-3xl shadow-2xl fade-in-up max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-brand-brown">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X size={20} className="text-gray-500"/>
          </button>
        </div>
        <div className="px-5 pb-8">{children}</div>
      </div>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────
interface StatCardProps {
  label: string; value: string; sub?: string
  color?: 'green' | 'red' | 'orange' | 'amber'
  icon?: React.ReactNode
}
export function StatCard({ label, value, sub, color = 'orange', icon }: StatCardProps) {
  const colors = {
    green:  'bg-green-50 border-green-100',
    red:    'bg-red-50 border-red-100',
    orange: 'bg-orange-50 border-orange-100',
    amber:  'bg-amber-50 border-amber-100',
  }
  const textColors = {
    green: 'text-green-700', red: 'text-red-700', orange: 'text-brand-orange', amber: 'text-amber-700'
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`text-xl font-bold ${textColors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Photo Picker ──────────────────────────────────────
interface PhotoPickerProps {
  onUpload: (url: string, publicId: string) => void
  existingUrl?: string
}
export function PhotoPicker({ onUpload, existingUrl }: PhotoPickerProps) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(existingUrl ?? '')

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    try {
      const { url, public_id } = await uploadFoto(file)
      onUpload(url, public_id)
    } catch {
      alert('Error al subir la foto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <label className="label">Foto de factura</label>
      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed
        border-orange-200 rounded-xl p-4 cursor-pointer hover:bg-orange-50 transition-colors">
        {loading ? (
          <Loader2 className="animate-spin text-brand-orange" size={28}/>
        ) : preview ? (
          <img src={preview} alt="Factura" className="max-h-40 rounded-xl object-contain"/>
        ) : (
          <>
            <Camera size={28} className="text-brand-orange"/>
            <span className="text-sm text-gray-500">Toca para tomar foto o elegir imagen</span>
          </>
        )}
        <input type="file" accept="image/*" capture="environment" onChange={handle} className="hidden"/>
      </label>
    </div>
  )
}

// ── Select Field ──────────────────────────────────────
interface SelectProps {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
  required?: boolean
}
export function SelectField({ label, value, onChange, options, required }: SelectProps) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-red-400"> *</span>}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="input-field" required={required}
      >
        <option value="">Seleccionar...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Input Field ───────────────────────────────────────
interface InputProps {
  label: string; value: string | number; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; min?: string; step?: string
}
export function InputField({ label, value, onChange, type = 'text', placeholder, required, min, step }: InputProps) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-red-400"> *</span>}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} min={min} step={step}
        className="input-field"
      />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────
export function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
      <span className="text-5xl">{icon}</span>
      <p className="text-sm text-center">{message}</p>
    </div>
  )
}

// ── Loading Spinner ───────────────────────────────────
export function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="animate-spin text-brand-orange" size={32}/>
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────
interface ConfirmProps {
  open: boolean; message: string
  onConfirm: () => void; onCancel: () => void
}
export function ConfirmDialog({ open, message, onConfirm, onCancel }: ConfirmProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl fade-in-up">
        <p className="text-gray-700 text-center mb-5 font-medium">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 rounded-xl py-3 text-gray-600 font-medium active:scale-95 transition-transform">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 text-white rounded-xl py-3 font-medium active:scale-95 transition-transform">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
