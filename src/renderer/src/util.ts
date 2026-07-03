import { getPref } from './prefs'

/** Open a link externally, honoring the "confirm before external" preference. */
export function openExternal(url: string): void {
  if (!url) return
  if (getPref('confirmExternal', false)) {
    if (!window.confirm(`Open this link in your browser?\n\n${url}`)) return
  }
  void window.peachwhip.app.openExternal(url)
}
