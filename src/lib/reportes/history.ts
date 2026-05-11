'use client'
import type { ReportHistoryItem } from './types'

const KEY = 'sazon.reportes.history.v1'
const MAX = 30

function safeRead(): ReportHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as ReportHistoryItem[]) : []
  } catch {
    return []
  }
}

function safeWrite(items: ReportHistoryItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
  } catch {
    // QuotaExceeded u otro: ignoramos silenciosamente para no romper el flujo.
  }
}

export function listHistory(): ReportHistoryItem[] {
  return safeRead()
}

export function addHistory(item: ReportHistoryItem): ReportHistoryItem[] {
  const items = [item, ...safeRead().filter((x) => x.id !== item.id)]
  safeWrite(items)
  return items
}

export function clearHistory(): void {
  safeWrite([])
}

export function removeHistory(id: string): ReportHistoryItem[] {
  const items = safeRead().filter((x) => x.id !== id)
  safeWrite(items)
  return items
}
