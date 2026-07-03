// Torrents source — searches Sukebei (sukebei.nyaa.si) for NSFW torrents. Results
// carry a magnet URI; the UI can hand it to the OS torrent client or (optionally)
// stream it in-app via WebTorrent.

import * as cheerio from 'cheerio'
import type {
  BrowseParams,
  Feed,
  FetchLike,
  MediaItem,
  Source,
  SourceContext,
  SourceOrder
} from '../../../shared/types'

const BASE = 'https://sukebei.nyaa.si'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const ORDERS: SourceOrder[] = [
  { value: 'seeders', label: 'Most seeders' },
  { value: 'id', label: 'Newest' },
  { value: 'size', label: 'Largest' },
  { value: 'downloads', label: 'Most downloaded' }
]

class TorrentsSource implements Source {
  readonly id = 'torrents'
  readonly label = 'Torrents'
  readonly searchable = true
  readonly orders = ORDERS
  readonly defaultOrder = 'seeders'

  constructor(private readonly fetchImpl: FetchLike) {}

  browse(params: BrowseParams = {}): Promise<Feed> {
    return this.run('', params.order || this.defaultOrder, params.page ?? 1)
  }

  search(params: BrowseParams): Promise<Feed> {
    return this.run((params.query || '').trim(), params.order || this.defaultOrder, params.page ?? 1)
  }

  private async run(query: string, order: string, page: number): Promise<Feed> {
    const qs = new URLSearchParams({ q: query, s: order, o: 'desc', p: String(page) })
    const res = await this.fetchImpl(`${BASE}/?${qs.toString()}`, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`Sukebei request failed: ${res.status}`)
    const $ = cheerio.load(await res.text())

    const items: MediaItem[] = []
    $('table.torrent-list tbody tr').each((_i, el) => {
      const row = $(el)
      const magnet = row.find('a[href^="magnet:"]').attr('href')
      const titleA = row.find('td:nth-child(2) a[href^="/view/"]').not('.comments').first()
      const title = (titleA.attr('title') || titleA.text() || '').trim()
      if (!magnet || !title) return
      const view = titleA.attr('href') || ''
      const size = row.find('td:nth-child(4)').text().trim()
      const seeders = row.find('td:nth-child(6)').text().trim()
      const id = magnet.match(/btih:([a-z0-9]+)/i)?.[1] || view.replace(/\D/g, '') || title
      items.push({
        id,
        source: this.id,
        kind: 'video',
        title,
        thumbnail: '',
        magnet,
        tags: [size, `▲ ${seeders}`].filter(Boolean),
        sourceUrl: view.startsWith('http') ? view : `${BASE}${view}`
      })
    })

    return {
      items,
      page,
      pages: items.length ? page + 1 : page,
      total: items.length,
      hasMore: items.length > 0
    }
  }
}

export function createTorrents(ctx: SourceContext): Source {
  return new TorrentsSource(ctx.fetch)
}
