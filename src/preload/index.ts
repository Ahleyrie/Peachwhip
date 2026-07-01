import { contextBridge, ipcRenderer } from 'electron'
import type { BrowseParams, Feed, SourceInfo, UpdateState } from '../shared/types'

// The single, typed surface the renderer is allowed to touch. Everything else
// (Node, Electron internals) stays out of the web context.
const api = {
  media: {
    sources: (): Promise<SourceInfo[]> => ipcRenderer.invoke('media:sources'),
    browse: (source: string, params: BrowseParams): Promise<Feed> =>
      ipcRenderer.invoke('media:browse', source, params),
    search: (source: string, params: BrowseParams): Promise<Feed> =>
      ipcRenderer.invoke('media:search', source, params)
  },
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version')
  },
  settings: {
    get: (key: string): Promise<string | undefined> => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string | undefined): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value)
  },
  reddit: {
    isLoggedIn: (): Promise<boolean> => ipcRenderer.invoke('reddit:isLoggedIn'),
    login: (): Promise<boolean> => ipcRenderer.invoke('reddit:login'),
    logout: (): Promise<void> => ipcRenderer.invoke('reddit:logout')
  },
  update: {
    check: (): Promise<UpdateState> => ipcRenderer.invoke('update:check'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onStatus: (cb: (status: UpdateState) => void): (() => void) => {
      const listener = (_e: unknown, status: UpdateState): void => cb(status)
      ipcRenderer.on('update:status', listener)
      return () => ipcRenderer.removeListener('update:status', listener)
    }
  }
}

export type PeachwhipApi = typeof api

contextBridge.exposeInMainWorld('peachwhip', api)
