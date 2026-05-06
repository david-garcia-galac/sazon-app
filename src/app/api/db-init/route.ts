import { NextResponse } from 'next/server'
import { initDB } from '@/lib/db'

export async function GET() {
  try {
    await initDB()
    return NextResponse.json({ ok: true, message: 'Base de datos inicializada' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
