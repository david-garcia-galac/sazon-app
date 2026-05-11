import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-change-in-production'
)
const COOKIE = 'sazon_session'

export type UserRole = 'admin' | 'owner'

export interface SessionPayload {
  role: UserRole
  iat?: number
  exp?: number
}

/** Landing recomendada para cada rol (también la usa el redirect del login). */
export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/dashboard',
  owner: '/owner',
}

/**
 * Whitelist de rutas por rol.
 *
 * - `owner` accede solo a su panel ejecutivo + a Reportes (porque el spec
 *   permite que envíe PDFs ejecutivos por WhatsApp/internet).
 * - `admin` accede a todo excepto a `/owner`.
 *
 * El middleware aplica esta lista sobre rutas de UI (no APIs). Las APIs se
 * filtran aparte porque algunas son lectura compartida y otras escritura.
 */
const OWNER_UI_PREFIXES = ['/owner', '/reportes']
const ADMIN_FORBIDDEN_PREFIXES = ['/owner']

/** APIs que SOLO el owner puede llamar. Las demás siguen abiertas a admin. */
const OWNER_ONLY_API_PREFIXES = ['/api/owner']

/** APIs prohibidas para owner (todo lo "fino" del admin). */
const ADMIN_ONLY_API_PREFIXES = [
  '/api/ingresos',
  '/api/egresos',
  '/api/inventario',
  '/api/proveedores',
  '/api/precios',
  '/api/dashboard',
  '/api/db-init',
  '/api/sync',
]

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname.startsWith('/api/')) {
    if (OWNER_ONLY_API_PREFIXES.some((p) => pathname.startsWith(p))) return role === 'owner'
    if (role === 'owner' && ADMIN_ONLY_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      // El owner puede consumir los reportes para generar PDFs (que son agregados).
      if (pathname.startsWith('/api/reportes')) return true
      return false
    }
    return true
  }

  if (role === 'owner') {
    return OWNER_UI_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  }

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
  if (pin === process.env.ADMIN_PIN) return 'admin'
  if (pin === process.env.OWNER_PIN) return 'owner'
  return null
}

export { COOKIE }
