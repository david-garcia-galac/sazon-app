/**
 * Logs estructurados para operaciones de DB (visibles en Vercel Logs y consola local).
 *
 * Convención:
 *   [db:ok]   → la operación llegó a Postgres y se confirmó.
 *   [db:fail] → no se pudo escribir/leer en Postgres (red, SQL, validación de driver…).
 *
 * El payload va como JSON en una sola línea para que sea grep-friendly en Vercel.
 */

type LogPayload = Record<string, unknown>

function safeStringify(o: LogPayload): string {
  try {
    return JSON.stringify(o)
  } catch {
    return '"[unserializable]"'
  }
}

export function logDbOk(scope: string, action: string, info: LogPayload = {}): void {
  console.log(
    `[db:ok] ${scope}.${action} ${safeStringify({ at: new Date().toISOString(), ...info })}`
  )
}

export function logDbFail(scope: string, action: string, err: unknown, info: LogPayload = {}): void {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  console.error(
    `[db:fail] ${scope}.${action} ${safeStringify({
      at: new Date().toISOString(),
      message,
      stack,
      ...info,
    })}`
  )
}
