// Local media lists (history, watch-later) + a "seen" key set, in localStorage.

import type { MediaItem } from '@shared/types'

const P = 'pwlist.'
const key = (i: MediaItem): string => `${i.source}:${i.id}`

function read<T>(k: string): T[] {
  try {
    const v = localStorage.getItem(P + k)
    return v ? (JSON.parse(v) as T[]) : []
  } catch {
    return []
  }
}
function write(k: string, v: unknown): void {
  try {
    localStorage.setItem(P + k, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function getList(name: string): MediaItem[] {
  return read<MediaItem>(name)
}
export function addToList(name: string, item: MediaItem, cap = 300): void {
  const arr = read<MediaItem>(name).filter((i) => key(i) !== key(item))
  arr.unshift(item)
  write(name, arr.slice(0, cap))
}
export function removeFromList(name: string, item: MediaItem): void {
  write(
    name,
    read<MediaItem>(name).filter((i) => key(i) !== key(item))
  )
}
export function clearList(name: string): void {
  write(name, [])
}
export function inList(name: string, item: MediaItem): boolean {
  return read<MediaItem>(name).some((i) => key(i) === key(item))
}

// "Seen" keys for the hide-seen feature.
export function markSeen(k: string): void {
  const s = read<string>('seen')
  if (!s.includes(k)) {
    s.unshift(k)
    write('seen', s.slice(0, 4000))
  }
}
export function getSeen(): Set<string> {
  return new Set(read<string>('seen'))
}
