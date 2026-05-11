'use client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function OwnerHeader() {
  const router = useRouter()
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' })
    router.push('/login')
  }
  return (
    <div
      className="header-orange px-4 pb-5"
      style={{ paddingTop: 'max(2.75rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white/40 flex-shrink-0 bg-white/10">
            <img src="/sazon-logo.jpeg" alt="Logo" className="w-full h-full object-contain"/>
          </div>
          <div className="min-w-0">
            <p className="text-white/70 text-[11px] font-bold tracking-wide uppercase">Panel dueño</p>
            <h1 className="text-white font-extrabold text-lg leading-tight truncate">
              El Sazón de Amparo
            </h1>
          </div>
        </div>
        <button
          onClick={logout}
          aria-label="Cerrar sesión"
          className="p-2 rounded-xl bg-white/20 active:scale-90"
        >
          <LogOut size={15} className="text-white"/>
        </button>
      </div>
      <p className="text-white/85 text-xs mt-2 ml-1 capitalize">
        {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
    </div>
  )
}
