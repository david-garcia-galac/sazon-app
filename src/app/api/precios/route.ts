import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureSchemaPatches, neonRows } from '@/lib/db'
import { blankPreciosBebidas } from '@/lib/precios-config'

export const dynamic = 'force-dynamic'

const CFG_ID = 'default'

/** Devuelve un objeto desde TEXT, JSONB o ya parseado por el driver Neon. */
function preciosBebidasFromStored(raw: unknown): Record<string, unknown> {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return {}
}

function rowFromPreciosSelect(rawSel: unknown) {
  type R = {
    id: string
    empanada_bs: string | number
    tasa_bcv: string | number | null
    precios_bebidas: unknown
    updated_at: string | null
  }
  let rows = neonRows<R>(rawSel)
  if (
    !rows.length &&
    rawSel &&
    typeof rawSel === 'object' &&
    !Array.isArray(rawSel) &&
    !('rows' in rawSel) &&
    'empanada_bs' in rawSel &&
    'precios_bebidas' in rawSel
  )
    rows = [rawSel as R]
  return rows[0] ?? null
}

/** Estado vacío: la UI debe poder abrir siempre aunque aún no haya ningún guardado. */
function payloadDefaults() {
  return {
    empanada_bs: 0,
    tasa_bcv: null as number | null,
    precios_bebidas: blankPreciosBebidas(),
    updated_at: null as string | null,
  }
}

export async function GET() {
  try {
    await ensureSchemaPatches()

    const baseBebidas = blankPreciosBebidas()

    const rawSel =
      await sql`SELECT id, empanada_bs, tasa_bcv, precios_bebidas, updated_at FROM precios_config WHERE id = ${CFG_ID} LIMIT 1`

    const r = rowFromPreciosSelect(rawSel)
    if (!r) return NextResponse.json(payloadDefaults())

    const fromDb = preciosBebidasFromStored(r.precios_bebidas)
    const merged: Record<string, number> = { ...baseBebidas }
    for (const k of Object.keys(merged)) {
      const v = fromDb[k]
      merged[k] = v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : 0
    }

    return NextResponse.json({
      empanada_bs: Number(r.empanada_bs),
      tasa_bcv:
        r.tasa_bcv == null || String(r.tasa_bcv) === ''
          ? null
          : Number(r.tasa_bcv),
      precios_bebidas: merged,
      updated_at: r.updated_at,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureSchemaPatches()

    const body = await req.json()
    const emp = Number(body.empanada_bs)
    if (!Number.isFinite(emp) || emp < 0)
      return NextResponse.json({ error: 'Precio de empanada no válido' }, { status: 400 })

    const tasa =
      body.tasa_bcv == null || body.tasa_bcv === ''
        ? null
        : Number(body.tasa_bcv)
    if (tasa != null && (!Number.isFinite(tasa) || tasa <= 0))
      return NextResponse.json({ error: 'Tasa BCV no válida' }, { status: 400 })

    const base = blankPreciosBebidas()
    const inc = body.precios_bebidas as Record<string, unknown>
    const merged = { ...base }
    if (inc && typeof inc === 'object') {
      for (const k of Object.keys(merged)) {
        const v = inc[k]
        if (v !== undefined && v !== null && v !== '')
          merged[k] = Number(v)
      }
    }
    const jsonStr = JSON.stringify(merged)

    const touched = neonRows<{ id: string }>(
      await sql`
        UPDATE precios_config
        SET
          empanada_bs     = ${emp},
          tasa_bcv        = ${tasa},
          precios_bebidas = ${jsonStr},
          updated_at      = NOW()
        WHERE id = ${CFG_ID}
        RETURNING id
      `
    )

    if (!touched.length) {
      try {
        await sql`
          INSERT INTO precios_config (id, empanada_bs, tasa_bcv, precios_bebidas, updated_at)
          VALUES (${CFG_ID}, ${emp}, ${tasa}, ${jsonStr}, NOW())
        `
      } catch (insertErr: unknown) {
        const msg = String(insertErr instanceof Error ? insertErr.message : insertErr)
        if (/duplicate|unique|violates/i.test(msg)) {
          await sql`
            UPDATE precios_config
            SET
              empanada_bs     = ${emp},
              tasa_bcv        = ${tasa},
              precios_bebidas = ${jsonStr},
              updated_at      = NOW()
            WHERE id = ${CFG_ID}
          `
        } else throw insertErr
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
