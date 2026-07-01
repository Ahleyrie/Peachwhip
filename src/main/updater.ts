// Self-update wiring using electron-updater.
//
// In production the app checks the `publish` feed from electron-builder.yml
// (point it at Cloudflare R2). In dev there is no packaged app, so checks are
// short-circuited to a "dev" status instead of throwing.

import { app, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateState } from '../shared/types'

const { autoUpdater } = electronUpdater

let wired = false

export function setupUpdater(getWindow: () => BrowserWindow | null): void {
  if (wired) return
  wired = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (status: UpdateState): void => {
    getWindow()?.webContents.send('update:status', status)
  }

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => send({ state: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (err) => send({ state: 'error', message: String(err?.message || err) }))
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) return { state: 'dev' }
  try {
    await autoUpdater.checkForUpdates()
    return { state: 'checking' }
  } catch (err) {
    return { state: 'error', message: String((err as Error)?.message || err) }
  }
}

/** Called from the renderer's "Restart & Update" button once state is "ready". */
export function quitAndInstall(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall()
}
