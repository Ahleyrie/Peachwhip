// Tiny reactive preferences store over localStorage. UI preferences live here
// (synchronous, instant, no IPC). The main-process settings store is only for
// things the main process needs (Reddit client id, device id).

import { useEffect, useState } from 'react'

const PREFIX = 'pw.'
const listeners = new Set<() => void>()

export function getPref<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key)
    return v === null ? def : (JSON.parse(v) as T)
  } catch {
    return def
  }
}

export function setPref<T>(key: string, val: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(val))
  } catch {
    /* ignore quota */
  }
  listeners.forEach((l) => l())
}

export function usePref<T>(key: string, def: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => getPref(key, def))
  useEffect(() => {
    const l = (): void => setV(getPref(key, def))
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return [v, (nv: T) => setPref(key, nv)]
}

/** Subscribe outside React (e.g. imperative helpers). */
export function onPrefsChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Reset every Peachwhip preference. */
export function resetPrefs(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

/** Export all prefs as a JSON object. */
export function exportPrefs(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => {
        out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k) as string)
      })
  } catch {
    /* ignore */
  }
  return out
}

export function importPrefs(data: Record<string, unknown>): void {
  try {
    Object.entries(data).forEach(([k, v]) => localStorage.setItem(PREFIX + k, JSON.stringify(v)))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}
