'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, TrendingUp, TrendingDown, Package, Users } from 'lucide-react'

const TABS = [
  { href: '/dashboard',    label: 'Inicio',    Icon: Home },
  { href: '/ingresos',     label: 'Ingresos',  Icon: TrendingUp },
  { href: '/egresos',      label: 'Egresos',   Icon: TrendingDown },
  { href: '/inventario',   label: 'Inventario',Icon: Package },
  { href: '/proveedores',  label: 'Proveed.',  Icon: Users },
]

export default function BottomNav() {
  const path = usePathname()
  const router = useRouter()
  return (
    <nav className="bottom-nav">
      {TABS.map(({ href, label, Icon }) => (
        <button key={href} onClick={() => router.push(href)}
          className={`nav-item ${path.startsWith(href) ? 'active' : ''}`}>
          <Icon size={20}/>
          <span className="text-[10px]">{label}</span>
        </button>
      ))}
    </nav>
  )
}
