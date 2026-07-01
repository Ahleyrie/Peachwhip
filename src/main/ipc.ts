// Registers all IPC handlers the renderer can call via the preload bridge.

import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import type { BrowseParams } from '../shared/types'
import { browse, listSources, search } from './core/registry'
import { checkForUpdates, quitAndInstall } from './updater'
import { getSetting, setSetting } from './settings'
import { isRedditLoggedIn, openRedditLogin, redditLogout } from './reddit-auth'
import { addFavorite, favoriteKeys, listFavorites, removeFavorite } from './favorites'
import type { MediaItem } from '../shared/types'

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('media:sources', () => listSources())

  ipcMain.handle('media:browse', (_e, sourceId: string, params: BrowseParams) =>
    browse(sourceId, params ?? {})
  )

  ipcMain.handle('media:search', (_e, sourceId: string, params: BrowseParams) =>
    search(sourceId, params ?? {})
  )

  ipcMain.handle('settings:get', (_e, key: string) => getSetting(key))
  ipcMain.handle('settings:set', (_e, key: string, value: string | undefined) =>
    setSetting(key, value)
  )

  ipcMain.handle('reddit:isLoggedIn', () => isRedditLoggedIn())
  ipcMain.handle('reddit:login', () => openRedditLogin(getWindow()))
  ipcMain.handle('reddit:logout', () => redditLogout())

  ipcMain.handle('favorites:list', () => listFavorites())
  ipcMain.handle('favorites:keys', () => favoriteKeys())
  ipcMain.handle('favorites:add', (_e, item: MediaItem) => addFavorite(item))
  ipcMain.handle('favorites:remove', (_e, source: string, id: string) =>
    removeFavorite(source, id)
  )

  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:openExternal', (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })

  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:install', () => {
    quitAndInstall()
  })
}
