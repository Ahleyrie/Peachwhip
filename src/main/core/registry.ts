// Source registry — the single place the rest of the app looks up content sources.
// `initCore` is called once from the main process with a SourceContext (which
// carries the Chromium-backed fetch). Add a new source in `buildSources` and it
// automatically appears in the UI's source tabs.

import type { BrowseParams, Feed, Source, SourceContext, SourceInfo } from '../../shared/types'
import { createRedgifsClient, createRedgifsSource } from './sources/redgifs'
import { createReddit } from './sources/reddit'
import { createTube } from './sources/tube'
import { createTorrents } from './sources/torrents'

let sources: Source[] = []
let byId = new Map<string, Source>()

function buildSources(ctx: SourceContext): Source[] {
  // RedGifs client is shared: it also resolves redgifs.com links inside Reddit posts.
  const redgifs = createRedgifsClient(ctx)
  return [
    createRedgifsSource(redgifs),
    createReddit(ctx, redgifs),
    createTube(ctx),
    createTorrents(ctx)
  ]
}

export function initCore(ctx: SourceContext): void {
  sources = buildSources(ctx)
  byId = new Map(sources.map((s) => [s.id, s]))
}

export function listSources(): SourceInfo[] {
  return sources.map(({ id, label, searchable, orders, defaultOrder }) => ({
    id,
    label,
    searchable,
    orders,
    defaultOrder
  }))
}

function getSource(id: string): Source {
  const s = byId.get(id)
  if (!s) throw new Error(`Unknown source: ${id}`)
  return s
}

export function browse(sourceId: string, params: BrowseParams): Promise<Feed> {
  return getSource(sourceId).browse(params)
}

export function search(sourceId: string, params: BrowseParams): Promise<Feed> {
  return getSource(sourceId).search(params)
}
