import { NextResponse } from 'next/server'
import { initDB } from '@/lib/db'

/** Crea todas las tablas y aplica parches (precios_config, cantidad_bebida). Llamalo una vez si falla /api/precios. */
export async function GET() {
  try {
    await initDB()
    return NextResponse.json({
      ok: true,
      message:
        'Base inicializada: tablas + precios_config y columna ingresos.cantidad_bebida si faltaban.',
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
