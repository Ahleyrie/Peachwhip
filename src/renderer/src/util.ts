import { getPref } from './prefs'

/** Lightweight non-cryptographic hash — a deterrent for the PIN lock, not real security. */
export function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return String(h >>> 0)
}

/** Open a link externally, honoring the "confirm before external" preference. */
export function openExternal(url: string): void {
  if (!url) return
  if (getPref('confirmExternal', false)) {
    if (!window.confirm(`Open this link in your browser?\n\n${url}`)) return
  }
  void window.peachwhip.app.openExternal(url)
}
