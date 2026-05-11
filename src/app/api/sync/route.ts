import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_TABLES = new Set([
  'ingresos', 'egresos', 'proveedores',
  'deudas_proveedor', 'pagos_proveedor',
  'inventario', 'movimientos_inventario', 'tasa_cambio',
])

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { items } = await req.json()
  let synced = 0

  for (const item of items) {
    try {
      const { tabla, accion, payload } = item as {
        tabla: string
        accion: 'create' | 'update' | 'delete'
        payload: Record<string, unknown>
      }
      if (!VALID_TABLES.has(tabla)) continue

      if (accion === 'delete') {
        await sql(`DELETE FROM ${tabla} WHERE id = $1`, [payload.id])
      } else {
        const cols = Object.keys(payload)
        const vals = Object.values(payload)
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ')
        const updateClauses = cols
          .filter(c => c !== 'id')
          .map(c => `${c} = EXCLUDED.${c}`)
          .join(', ')
        await sql(
          `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updateClauses}`,
          vals
        )
      }
      synced++
    } catch {
      // continúa con los demás items
    }
  }

  return NextResponse.json({ ok: true, synced })
}
