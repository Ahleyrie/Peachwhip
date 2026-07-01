// Registers all IPC handlers the renderer can call via the preload bridge.

import { app, ipcMain, type BrowserWindow } from 'electron'
import type { BrowseParams } from '../shared/types'
import { browse, listSources, search } from './core/registry'
import { checkForUpdates, quitAndInstall } from './updater'

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('media:sources', () => listSources())

  ipcMain.handle('media:browse', (_e, sourceId: string, params: BrowseParams) =>
    browse(sourceId, params ?? {})
  )

  ipcMain.handle('media:search', (_e, sourceId: string, params: BrowseParams) =>
    search(sourceId, params ?? {})
  )

  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:install', () => {
    quitAndInstall()
  })

  // Keep a reference to the window getter available for future push events.
  void getWindow
}
