'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[app error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-5">
      <span className="text-5xl">😕</span>
      <div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">Algo salió mal</h1>
        <p className="text-sm text-gray-500">
          Ocurrió un error inesperado. Podés intentar de nuevo o volver al inicio.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          className="bg-brand-orange text-white font-semibold rounded-xl py-3 active:scale-95 transition-transform"
        >
          Intentar de nuevo
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="border border-gray-300 text-gray-700 font-semibold rounded-xl py-3 active:scale-95 transition-transform"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  )
}
