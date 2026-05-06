import { NextRequest, NextResponse } from 'next/server'
import { checkPin, createSession, COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { pin } = await req.json()
  const role = checkPin(pin)
  if (!role) return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })

  const token = await createSession(role)
  const res = NextResponse.json({ ok: true, role })
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
