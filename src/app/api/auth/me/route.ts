import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
}

export async function GET() {
  const session = await getSession()
  return NextResponse.json(
    {
      authenticated: !!session,
      role: session?.role ?? null,
    },
    { headers: NO_STORE }
  )
}
