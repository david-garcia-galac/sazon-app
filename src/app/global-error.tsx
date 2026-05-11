'use client'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error]', error)
  }, [error])

  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 antialiased max-w-lg mx-auto">
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
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
              style={{ background: '#E87D2B' }}
              className="text-white font-semibold rounded-xl py-3 active:scale-95 transition-transform"
            >
              Intentar de nuevo
            </button>
            <a
              href="/dashboard"
              style={{ border: '1px solid #d1d5db' }}
              className="text-gray-700 font-semibold rounded-xl py-3 active:scale-95 transition-transform text-center"
            >
              Volver al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
