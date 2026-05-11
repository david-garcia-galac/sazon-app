import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureSchemaPatches, neonRows } from '@/lib/db'
import { blankPreciosBebidas } from '@/lib/precios-config'
import { logDbFail, logDbOk } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const CFG_ID = 'default'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
}

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) },
  })
}

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
    if (!r) {
      logDbOk('precios', 'get', { cfg_id: CFG_ID, found: false })
      return jsonNoStore(payloadDefaults())
    }

    const fromDb = preciosBebidasFromStored(r.precios_bebidas)
    const merged: Record<string, number> = { ...baseBebidas }
    for (const k of Object.keys(merged)) {
      const v = fromDb[k]
      merged[k] = v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : 0
    }

    logDbOk('precios', 'get', {
      cfg_id: CFG_ID,
      found: true,
      empanada_bs: Number(r.empanada_bs),
      tasa_bcv: r.tasa_bcv,
      updated_at: r.updated_at,
    })

    return jsonNoStore({
      empanada_bs: Number(r.empanada_bs),
      tasa_bcv:
        r.tasa_bcv == null || String(r.tasa_bcv) === ''
          ? null
          : Number(r.tasa_bcv),
      precios_bebidas: merged,
      updated_at: r.updated_at,
    })
  } catch (e: any) {
    logDbFail('precios', 'get', e, { cfg_id: CFG_ID })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  let emp: number | undefined
  let tasa: number | null | undefined
  let jsonStr: string | undefined

  try {
    await ensureSchemaPatches()

    const body = await req.json()
    emp = Number(body.empanada_bs)
    if (!Number.isFinite(emp) || emp < 0) {
      logDbFail('precios', 'put', new Error('empanada_bs inválido'), {
        cfg_id: CFG_ID,
        empanada_bs: body.empanada_bs,
      })
      return jsonNoStore({ error: 'Precio de empanada no válido' }, { status: 400 })
    }

    tasa =
      body.tasa_bcv == null || body.tasa_bcv === ''
        ? null
        : Number(body.tasa_bcv)
    if (tasa != null && (!Number.isFinite(tasa) || tasa <= 0)) {
      logDbFail('precios', 'put', new Error('tasa_bcv inválida'), {
        cfg_id: CFG_ID,
        tasa_bcv: body.tasa_bcv,
      })
      return jsonNoStore({ error: 'Tasa BCV no válida' }, { status: 400 })
    }

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
    jsonStr = JSON.stringify(merged)

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

    if (touched.length) {
      logDbOk('precios', 'put.update', {
        cfg_id: CFG_ID,
        empanada_bs: emp,
        tasa_bcv: tasa,
        bebidas_keys: Object.keys(merged).length,
      })
      return jsonNoStore({ ok: true, mode: 'update' })
    }

    try {
      await sql`
        INSERT INTO precios_config (id, empanada_bs, tasa_bcv, precios_bebidas, updated_at)
        VALUES (${CFG_ID}, ${emp}, ${tasa}, ${jsonStr}, NOW())
      `
      logDbOk('precios', 'put.insert', {
        cfg_id: CFG_ID,
        empanada_bs: emp,
        tasa_bcv: tasa,
        bebidas_keys: Object.keys(merged).length,
      })
      return jsonNoStore({ ok: true, mode: 'insert' })
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
        logDbOk('precios', 'put.update-after-conflict', {
          cfg_id: CFG_ID,
          empanada_bs: emp,
          tasa_bcv: tasa,
        })
        return jsonNoStore({ ok: true, mode: 'update-after-conflict' })
      }
      throw insertErr
    }
  } catch (e: any) {
    logDbFail('precios', 'put', e, {
      cfg_id: CFG_ID,
      empanada_bs: emp,
      tasa_bcv: tasa,
    })
    return jsonNoStore({ error: e.message }, { status: 500 })
  }
}
