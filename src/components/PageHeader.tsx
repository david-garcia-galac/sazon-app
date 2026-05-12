'use client'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PageHeaderProps {
  title: string
  subtitle?: string
  colorClass?: string
  onBack?: boolean
  showLogout?: boolean
  right?: React.ReactNode
  children?: React.ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  colorClass = 'header-orange',
  onBack = false,
  showLogout = false,
  right,
  children,
}: PageHeaderProps) {
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div
      className={`${colorClass} px-4 pb-5`}
      style={{ paddingTop: 'max(2.75rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-start gap-3">
        {onBack && (
          <button
            onClick={() => router.back()}
            className="mt-0.5 p-2 rounded-xl bg-black/15 text-white active:scale-90 transition-transform shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft size={18}/>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-extrabold text-xl leading-tight tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-white/75 text-[13px] mt-0.5 font-medium leading-snug">{subtitle}</p>
          )}
        </div>
        {(right || showLogout) && (
          <div className="flex items-center gap-2 shrink-0">
            {right}
            {showLogout && (
              <button
                onClick={logout}
                className="p-2 rounded-xl bg-black/15 text-white active:scale-90 transition-transform"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} className="text-white"/>
              </button>
            )}
          </div>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
