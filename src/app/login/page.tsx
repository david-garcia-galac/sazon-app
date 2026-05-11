'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
import { DISCLAIMER_INTERNO } from '@/components/InternalUseBanner'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { role?: string }
        const target = data.role === 'owner' ? '/owner' : '/dashboard'
        router.push(target)
      } else {
        setError('PIN incorrecto')
        setPin('')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-orange-500 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-orange-100 mx-auto mb-4">
              <img src="/sazon-logo.jpeg" alt="Logo" className="w-full h-full object-contain"/>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">El Sazón de Amparo</h1>
            <p className="text-gray-500 text-sm mt-1">Ingresa tu PIN para continuar</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="••••"
              className="input-field text-center text-2xl tracking-widest"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !pin}
              className="btn-primary w-full py-4 text-base disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <div
          role="note"
          className="flex items-start gap-2.5 rounded-2xl bg-white/15 backdrop-blur-sm px-3.5 py-3 border border-white/25"
        >
          <Info size={15} className="text-white shrink-0 mt-0.5"/>
          <p className="flex-1 text-[12px] leading-snug text-white/95 font-medium">
            {DISCLAIMER_INTERNO}
          </p>
        </div>
      </div>
    </div>
  )
}
