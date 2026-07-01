// Local favorites store — persists whole MediaItems to favorites.json in userData,
// so the Favorites view renders without re-fetching from the source.

import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { MediaItem } from '../shared/types'

let cache: MediaItem[] | null = null

function file(): string {
  return join(app.getPath('userData'), 'favorites.json')
}

function load(): MediaItem[] {
  if (cache) return cache
  try {
    cache = existsSync(file()) ? (JSON.parse(readFileSync(file(), 'utf8')) as MediaItem[]) : []
  } catch {
    cache = []
  }
  return cache
}

function save(): void {
  try {
    writeFileSync(file(), JSON.stringify(cache ?? [], null, 2))
  } catch {
    // Non-fatal.
  }
}

const keyOf = (source: string, id: string): string => `${source}:${id}`

/** Newest first. */
export function listFavorites(): MediaItem[] {
  return [...load()].reverse()
}

export function favoriteKeys(): string[] {
  return load().map((i) => keyOf(i.source, i.id))
}

export function addFavorite(item: MediaItem): void {
  const arr = load()
  if (!arr.some((i) => i.source === item.source && i.id === item.id)) {
    arr.push(item)
    save()
  }
}

export function removeFavorite(source: string, id: string): void {
  cache = load().filter((i) => !(i.source === source && i.id === id))
  save()
}
