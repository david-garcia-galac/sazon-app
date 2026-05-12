'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, TrendingUp, TrendingDown, Package,
  Users, Settings, FileText, Handshake,
} from 'lucide-react'

type Role = 'admin' | 'owner' | 'cajero' | null

interface Tab { href: string; label: string; Icon: typeof Home }

const ADMIN_TABS: Tab[] = [
  { href: '/dashboard',    label: 'Inicio',    Icon: Home },
  { href: '/ingresos',     label: 'Ingresos',  Icon: TrendingUp },
  { href: '/egresos',      label: 'Egresos',   Icon: TrendingDown },
  { href: '/inventario',   label: 'Stock',     Icon: Package },
  { href: '/proveedores',  label: 'Proveed.',  Icon: Users },
  { href: '/deudores',     label: 'Deudores',  Icon: Handshake },
  { href: '/configuracion',label: 'Ajustes',   Icon: Settings },
]

const OWNER_TABS: Tab[] = [
  { href: '/owner',    label: 'Resumen',  Icon: Home },
  { href: '/reportes', label: 'Reportes', Icon: FileText },
]

const CAJERO_TABS: Tab[] = [
  { href: '/deudores', label: 'Deudores', Icon: Handshake },
]

export default function BottomNav() {
  const path   = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<Role>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.role) setRole(d.role as Role)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const tabs =
    role === 'owner'  ? OWNER_TABS  :
    role === 'cajero' ? CAJERO_TABS :
    ADMIN_TABS

  return (
    <nav className="bottom-nav">
      {tabs.map(({ href, label, Icon }) => {
        const active = path === href || path.startsWith(`${href}/`)
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            className={`nav-item ${active ? 'active' : ''}`}
          >
            <div className={`p-1.5 rounded-xl transition-all duration-200 ${active ? 'bg-orange-50' : ''}`}>
              <Icon size={active ? 21 : 19} strokeWidth={active ? 2.5 : 1.8}/>
            </div>
            <span className={`text-[9.5px] font-${active ? 'bold' : 'medium'} tracking-wide`}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
