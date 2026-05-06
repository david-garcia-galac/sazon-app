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
