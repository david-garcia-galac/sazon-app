'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, TrendingUp, TrendingDown, Package, Users, Settings } from 'lucide-react'

const TABS = [
  { href: '/dashboard',     label: 'Inicio',    Icon: Home },
  { href: '/ingresos',      label: 'Ingresos',  Icon: TrendingUp },
  { href: '/egresos',       label: 'Egresos',   Icon: TrendingDown },
  { href: '/inventario',    label: 'Stock',     Icon: Package },
  { href: '/proveedores',   label: 'Proveed.',  Icon: Users },
  { href: '/configuracion', label: 'Ajustes',   Icon: Settings },
]

export default function BottomNav() {
  const path = usePathname()
  const router = useRouter()
  return (
    <nav className="bottom-nav">
      {TABS.map(({ href, label, Icon }) => {
        const active = path.startsWith(href)
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            className={`nav-item ${active ? 'active' : ''}`}
          >
            <div className={`p-1.5 rounded-xl transition-all duration-200 ${
              active ? 'bg-orange-50' : ''
            }`}>
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
