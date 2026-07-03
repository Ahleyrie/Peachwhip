// Tiny persistent settings store (JSON in the app's userData dir). Reused for the
// Reddit API credentials now, and future config (proxy, favorites location, etc.).

import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export type Settings = Record<string, string | undefined>

let cache: Settings | null = null

function file(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): Settings {
  if (cache) return cache
  try {
    cache = existsSync(file()) ? (JSON.parse(readFileSync(file(), 'utf8')) as Settings) : {}
  } catch {
    cache = {}
  }
  return cache
}

export function getSetting(key: string): string | undefined {
  return getSettings()[key]
}

export function clearAllSettings(): void {
  cache = {}
  try {
    writeFileSync(file(), '{}')
  } catch {
    /* ignore */
  }
}

export function setSetting(key: string, value: string | undefined): void {
  const s = getSettings()
  if (value === undefined || value === '') delete s[key]
  else s[key] = value
  try {
    writeFileSync(file(), JSON.stringify(s, null, 2))
  } catch {
    // Non-fatal: settings just won't persist across restarts.
  }
}
