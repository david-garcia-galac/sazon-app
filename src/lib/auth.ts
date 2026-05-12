import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-change-in-production'
)
const COOKIE = 'sazon_session'

export type UserRole = 'admin' | 'owner' | 'cajero'

export interface SessionPayload {
  role: UserRole
  iat?: number
  exp?: number
}

/** Landing recomendada para cada rol. */
export const ROLE_HOME: Record<UserRole, string> = {
  admin:  '/dashboard',
  owner:  '/owner',
  cajero: '/deudores',
}

const OWNER_UI_PREFIXES   = ['/owner', '/reportes']
const CAJERO_UI_PREFIXES  = ['/deudores']
const ADMIN_FORBIDDEN_PREFIXES = ['/owner']

const OWNER_ONLY_API_PREFIXES = ['/api/owner']
const CAJERO_ALLOWED_API_PREFIXES = ['/api/deudores', '/api/auth', '/api/precios']
const ADMIN_ONLY_API_PREFIXES = [
  '/api/ingresos', '/api/egresos', '/api/inventario',
  '/api/proveedores', '/api/precios', '/api/dashboard',
  '/api/db-init', '/api/sync',
]

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname.startsWith('/api/')) {
    if (role === 'cajero')
      return CAJERO_ALLOWED_API_PREFIXES.some((p) => pathname.startsWith(p))
    if (OWNER_ONLY_API_PREFIXES.some((p) => pathname.startsWith(p))) return role === 'owner'
    if (role === 'owner' && ADMIN_ONLY_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      if (pathname.startsWith('/api/reportes')) return true
      return false
    }
    return true
  }

  if (role === 'cajero')
    return CAJERO_UI_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (role === 'owner')
    return OWNER_UI_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  // admin
  return !ADMIN_FORBIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function createSession(role: UserRole): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifySession(token)
}

export function checkPin(pin: string): UserRole | null {
  if (pin === process.env.ADMIN_PIN)  return 'admin'
  if (pin === process.env.OWNER_PIN)  return 'owner'
  if (pin === process.env.CAJERO_PIN) return 'cajero'
  return null
}

export { COOKIE }
