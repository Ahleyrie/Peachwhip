import { contextBridge, ipcRenderer } from 'electron'
import type {
  BrowseParams,
  ComicDetail,
  ComicFeed,
  ComicSourceInfo,
  Feed,
  MediaItem,
  SourceInfo,
  UpdateState
} from '../shared/types'

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
  comics: {
    sources: (): Promise<ComicSourceInfo[]> => ipcRenderer.invoke('comics:sources'),
    browse: (source: string, params: { order?: string; page?: number }): Promise<ComicFeed> =>
      ipcRenderer.invoke('comics:browse', source, params),
    search: (
      source: string,
      params: { query?: string; order?: string; page?: number }
    ): Promise<ComicFeed> => ipcRenderer.invoke('comics:search', source, params),
    detail: (source: string, id: string): Promise<ComicDetail> =>
      ipcRenderer.invoke('comics:detail', source, id),
    images: (source: string, id: string, chapterId: string): Promise<string[]> =>
      ipcRenderer.invoke('comics:images', source, id, chapterId)
  },
  torrent: {
    stream: (magnet: string): Promise<string> => ipcRenderer.invoke('torrent:stream', magnet),
    stop: (): Promise<void> => ipcRenderer.invoke('torrent:stop')
  },
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url)
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
  favorites: {
    list: (): Promise<MediaItem[]> => ipcRenderer.invoke('favorites:list'),
    keys: (): Promise<string[]> => ipcRenderer.invoke('favorites:keys'),
    add: (item: MediaItem): Promise<void> => ipcRenderer.invoke('favorites:add', item),
    remove: (source: string, id: string): Promise<void> =>
      ipcRenderer.invoke('favorites:remove', source, id)
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
