'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Camera, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadFoto } from '@/lib/cloudinary-client'

// ── Toast ──────────────────────────────────────────────────
interface ToastProps { message: string; type?: 'success' | 'error' }
export function Toast({ message, type = 'success' }: ToastProps) {
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 toast-anim
      flex items-center gap-2.5 max-w-[88vw] px-5 py-3.5 rounded-2xl text-sm font-semibold
      ${type === 'success' ? 'toast-success' : 'toast-error'}`}>
      {type === 'success'
        ? <CheckCircle size={16} className="shrink-0 text-emerald-400"/>
        : <AlertCircle size={16} className="shrink-0 text-red-200"/>}
      <span>{message}</span>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)
  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])
  return { toast, show }
}

// ── Modal ──────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-[1.75rem] slide-up"
        style={{ maxHeight: '92dvh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full"/>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 sticky top-0 bg-white z-10"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h2 className="text-[17px] font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition-transform"
          >
            <X size={16} className="text-gray-500"/>
          </button>
        </div>
        <div className="px-5 pb-10 pt-4">{children}</div>
      </div>
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────
interface StatCardProps {
  label: string; value: string; sub?: string
  color?: 'green' | 'red' | 'orange' | 'amber'
  icon?: React.ReactNode
}
export function StatCard({ label, value, sub, color = 'orange', icon }: StatCardProps) {
  const bg = { green: 'bg-emerald-50', red: 'bg-red-50', orange: 'bg-orange-50', amber: 'bg-amber-50' }
  const border = { green: 'border-emerald-100', red: 'border-red-100', orange: 'border-orange-100', amber: 'border-amber-100' }
  const text = { green: 'text-emerald-700', red: 'text-red-600', orange: 'text-orange-600', amber: 'text-amber-700' }
  const sub_text = { green: 'text-emerald-500', red: 'text-red-400', orange: 'text-orange-400', amber: 'text-amber-500' }
  return (
    <div className={`rounded-2xl border p-4 ${bg[color]} ${border[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.07em]">{label}</span>
        {icon && <span className="text-base">{icon}</span>}
      </div>
      <p className={`text-[22px] font-extrabold leading-tight ${text[color]}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 font-medium ${sub_text[color]}`}>{sub}</p>}
    </div>
  )
}

// ── Image compression ──────────────────────────────────────
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024 // 3.5 MB — por debajo del límite de Vercel

function compressToBlob(img: HTMLImageElement, maxW: number, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const scale = Math.min(1, maxW / Math.max(img.width, img.height, 1))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = async () => {
      URL.revokeObjectURL(url)
      // Intentos en orden descendente de calidad hasta que quepa en MAX_UPLOAD_BYTES
      const attempts: [number, number][] = [
        [1200, 0.75],
        [900,  0.65],
        [700,  0.55],
        [500,  0.45],
      ]
      for (const [maxW, quality] of attempts) {
        const blob = await compressToBlob(img, maxW, quality)
        if (blob && blob.size <= MAX_UPLOAD_BYTES) {
          resolve(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
          return
        }
      }
      // Último recurso: calidad mínima
      const blob = await compressToBlob(img, 400, 0.35)
      resolve(blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── Photo Picker ───────────────────────────────────────────
interface PhotoPickerProps {
  onUpload: (url: string, publicId: string) => void
  existingUrl?: string
}
export function PhotoPicker({ onUpload, existingUrl }: PhotoPickerProps) {
  const [phase, setPhase] = useState<'idle' | 'compressing' | 'uploading'>('idle')
  const [preview, setPreview] = useState(existingUrl ?? '')
  const busy = phase !== 'idle'

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setPhase('compressing')
    try {
      const compressed = await compressImage(file)
      setPhase('uploading')
      const { url, public_id } = await uploadFoto(compressed)
      onUpload(url, public_id)
    } catch (err: any) {
      setPreview('')
      alert(err?.message ?? 'Error al subir la foto. Intenta de nuevo.')
    } finally {
      setPhase('idle')
    }
  }

  return (
    <div>
      <label className="label">Foto de factura</label>
      <label className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl p-5 transition-all
        border-2 border-dashed
        ${busy
          ? 'border-orange-300 bg-orange-50 cursor-wait'
          : preview
            ? 'border-orange-200 bg-white cursor-pointer'
            : 'border-gray-200 bg-gray-50 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50'
        }`}>
        {busy ? (
          <>
            <Loader2 className="animate-spin text-orange-500" size={30}/>
            <p className="text-sm font-semibold text-orange-600">
              {phase === 'compressing' ? 'Comprimiendo imagen…' : 'Subiendo foto…'}
            </p>
            <p className="text-xs text-orange-400">
              {phase === 'compressing' ? 'Optimizando para subida rápida' : 'Guardando en la nube'}
            </p>
          </>
        ) : preview ? (
          <div className="relative">
            <img src={preview} alt="Factura" className="max-h-44 rounded-xl object-contain shadow-sm"/>
            <div className="mt-2 flex items-center gap-1.5 justify-center text-xs text-orange-500 font-semibold">
              <Camera size={13}/> Toca para cambiar
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
              <Camera size={22} className="text-orange-500"/>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">Agregar foto de factura</p>
              <p className="text-xs text-gray-400 mt-0.5">Toca para tomar foto o elegir imagen</p>
            </div>
          </>
        )}
        <input type="file" accept="image/*" capture="environment" onChange={handle} className="hidden" disabled={busy}/>
      </label>
    </div>
  )
}

// ── Select Field ───────────────────────────────────────────
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
        <option value="">Seleccionar…</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Input Field ────────────────────────────────────────────
interface InputProps {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  min?: string
  step?: string
  decimal?: boolean
}
export function InputField({ label, value, onChange, type = 'text', placeholder, required, min, step, decimal }: InputProps) {
  const useDecimal = decimal === true
  return (
    <div>
      <label className="label">{label}{required && <span className="text-red-400"> *</span>}</label>
      <input
        type={useDecimal ? 'text' : type}
        inputMode={useDecimal ? 'decimal' : undefined}
        lang={useDecimal ? 'es' : undefined}
        autoComplete={useDecimal ? 'off' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={useDecimal ? undefined : min}
        step={useDecimal ? undefined : step}
        className="input-field"
      />
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────
export function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-3xl">
        {icon}
      </div>
      <p className="text-sm text-gray-400 font-medium text-center">{message}</p>
    </div>
  )
}

// ── Loading Spinner ────────────────────────────────────────
export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-[3px] border-orange-100"/>
        <div className="absolute inset-0 w-10 h-10 rounded-full border-[3px] border-transparent border-t-orange-500 animate-spin"/>
      </div>
      <p className="text-xs text-gray-400 font-medium">Cargando…</p>
    </div>
  )
}

// ── Confirm Dialog ─────────────────────────────────────────
interface ConfirmProps {
  open: boolean; message: string
  onConfirm: () => void; onCancel: () => void
}
export function ConfirmDialog({ open, message, onConfirm, onCancel }: ConfirmProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm slide-up shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={22} className="text-red-500"/>
        </div>
        <p className="text-gray-800 text-center mb-5 font-semibold text-[15px]">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 rounded-2xl py-3 text-gray-600 font-semibold active:scale-95 transition-transform bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 btn-danger py-3 rounded-2xl"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
