// Comic source registry — parallel to the media registry, but for the comic model.

import type {
  ComicDetail,
  ComicFeed,
  ComicSource,
  ComicSourceInfo,
  SourceContext
} from '../../../shared/types'
import { createNhentai } from './nhentai'

let sources: ComicSource[] = []
let byId = new Map<string, ComicSource>()

export function initComics(ctx: SourceContext): void {
  sources = [createNhentai(ctx)]
  byId = new Map(sources.map((s) => [s.id, s]))
}

export function listComicSources(): ComicSourceInfo[] {
  return sources.map(({ id, label, orders, defaultOrder }) => ({ id, label, orders, defaultOrder }))
}

function get(id: string): ComicSource {
  const s = byId.get(id)
  if (!s) throw new Error(`Unknown comic source: ${id}`)
  return s
}

export function comicBrowse(
  sourceId: string,
  params: { order?: string; page?: number }
): Promise<ComicFeed> {
  return get(sourceId).browse(params)
}

export function comicSearch(
  sourceId: string,
  params: { query?: string; order?: string; page?: number }
): Promise<ComicFeed> {
  return get(sourceId).search(params)
}

export function comicDetail(sourceId: string, id: string): Promise<ComicDetail> {
  return get(sourceId).detail(id)
}

export function comicImages(sourceId: string, id: string, chapterId: string): Promise<string[]> {
  return get(sourceId).images(id, chapterId)
}
