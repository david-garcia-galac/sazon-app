import { NextRequest, NextResponse } from 'next/server'
import { verifySession, canAccessPath, ROLE_HOME, COOKIE } from '@/lib/auth'

const PUBLIC = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.startsWith('/static')) return NextResponse.next()

  const token = req.cookies.get(COOKIE)?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const session = await verifySession(token)
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  if (!canAccessPath(session.role, pathname)) {
    // API: 403 limpio para que el front muestre error.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'No autorizado para este recurso' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    // UI: mando a la home del rol (admin → /dashboard, owner → /owner).
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sazon-logo.jpeg|logo.png|icon-192.png|manifest.json).*)'],
}
