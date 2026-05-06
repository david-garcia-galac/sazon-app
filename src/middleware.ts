import { NextRequest, NextResponse } from 'next/server'
import { verifySession, COOKIE } from '@/lib/auth'

const PUBLIC = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.startsWith('/static')) return NextResponse.next()

  const token = req.cookies.get(COOKIE)?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sazon-logo.jpeg|logo.png|icon-192.png|manifest.json).*)'],
}
