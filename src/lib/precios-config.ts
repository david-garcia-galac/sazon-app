import { BEBIDAS } from '@/lib/constants'

export function blankPreciosBebidas(): Record<string, number> {
  const o: Record<string, number> = {}
  for (const b of BEBIDAS) o[b.value] = 0
  return o
}
