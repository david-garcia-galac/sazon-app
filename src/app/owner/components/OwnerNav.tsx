'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, FileText } from 'lucide-react'

/** Bottom nav minimalista para rol dueño: solo dashboard ejecutivo y reportes. */
const TABS = [
  { href: '/owner', label: 'Resumen', Icon: Home },
  { href: '/reportes', label: 'Reportes', Icon: FileText },
]

export default function OwnerNav() {
  const path = usePathname()
  const router = useRouter()
  return (
    <nav className="bottom-nav">
      {TABS.map(({ href, label, Icon }) => {
        const active = path === href || path.startsWith(`${href}/`)
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            className={`nav-item ${active ? 'active' : ''}`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all duration-200 ${active ? 'bg-orange-50' : ''}`}
            >
              <Icon size={active ? 21 : 19} strokeWidth={active ? 2.5 : 1.8} />
            </div>
            <span
              className={`text-[10px] font-${active ? 'bold' : 'medium'} tracking-wide`}
            >
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
