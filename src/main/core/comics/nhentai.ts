// nhentai comic source — doujinshi/manga with a clean JSON API and direct,
// unscrambled image URLs (unlike JMComic, which needs AES + image de-scramble).
//
// API:
//   search:  GET https://nhentai.net/api/galleries/search?query=Q&sort=S&page=P
//   browse:  same, with query "*"
//   gallery: GET https://nhentai.net/api/gallery/{id}
// Images: https://i.nhentai.net/galleries/{media_id}/{page}.{ext}
//         covers/thumbs on t.nhentai.net. `t` codes: j=jpg p=png g=gif w=webp.
//
// nhentai is Cloudflare-protected; net.fetch (browser TLS/UA) usually passes, but a
// challenge can still 403 — handled as an error upstream.

import type {
  ComicDetail,
  ComicFeed,
  ComicSource,
  ComicSummary,
  FetchLike,
  SourceContext,
  SourceOrder
} from '../../../shared/types'

const BASE = 'https://nhentai.net'
const IMG = 'https://i.nhentai.net'
const THUMB = 'https://t.nhentai.net'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const ORDERS: SourceOrder[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'popular-week', label: 'Popular (Week)' },
  { value: 'popular-today', label: 'Popular (Today)' },
  { value: 'date', label: 'Recent' }
]

const EXT: Record<string, string> = { j: 'jpg', p: 'png', g: 'gif', w: 'webp' }

interface NhImage {
  t: string
  w: number
  h: number
}
interface NhGallery {
  id: number
  media_id: string
  title: { english?: string; japanese?: string; pretty?: string }
  num_pages: number
  tags?: { type: string; name: string }[]
  images: { pages: NhImage[]; cover: NhImage; thumbnail: NhImage }
}
interface NhSearch {
  result: NhGallery[]
  num_pages: number
  per_page: number
}

function coverUrl(g: NhGallery): string {
  const ext = EXT[g.images?.thumbnail?.t] || EXT[g.images?.cover?.t] || 'jpg'
  return `${THUMB}/galleries/${g.media_id}/cover.${ext}`
}

function language(g: NhGallery): string | undefined {
  const langs = (g.tags || []).filter((t) => t.type === 'language').map((t) => t.name)
  return langs.find((l) => l !== 'translated') || langs[0]
}

function toSummary(g: NhGallery): ComicSummary {
  return {
    id: String(g.id),
    source: 'nhentai',
    title: g.title.pretty || g.title.english || g.title.japanese || `#${g.id}`,
    cover: coverUrl(g),
    pageCount: g.num_pages,
    tags: (g.tags || []).filter((t) => t.type === 'tag').map((t) => t.name).slice(0, 8),
    language: language(g)
  }
}

class NhentaiSource implements ComicSource {
  readonly id = 'nhentai'
  readonly label = 'nhentai'
  readonly orders = ORDERS
  readonly defaultOrder = 'popular'

  private galleryCache = new Map<string, NhGallery>()

  constructor(private readonly fetchImpl: FetchLike) {}

  private async apiGet<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${BASE}${path}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json', Referer: `${BASE}/` }
    })
    if (!res.ok) throw new Error(`nhentai request failed: ${res.status}`)
    return (await res.json()) as T
  }

  private async runSearch(query: string, order: string, page: number): Promise<ComicFeed> {
    const qs = new URLSearchParams({ query, sort: order, page: String(page) })
    const data = await this.apiGet<NhSearch>(`/api/galleries/search?${qs.toString()}`)
    const items = (data.result || []).map(toSummary)
    return { items, page, hasMore: page < (data.num_pages || page) }
  }

  browse(params: { order?: string; page?: number }): Promise<ComicFeed> {
    // Wildcard query returns the whole library, honoring the sort.
    return this.runSearch('*', params.order || this.defaultOrder, params.page ?? 1)
  }

  search(params: { query?: string; order?: string; page?: number }): Promise<ComicFeed> {
    const q = (params.query || '').trim()
    if (!q) return this.browse(params)
    return this.runSearch(q, params.order || this.defaultOrder, params.page ?? 1)
  }

  private async getGallery(id: string): Promise<NhGallery> {
    const cached = this.galleryCache.get(id)
    if (cached) return cached
    const g = await this.apiGet<NhGallery>(`/api/gallery/${id}`)
    this.galleryCache.set(id, g)
    return g
  }

  async detail(id: string): Promise<ComicDetail> {
    const g = await this.getGallery(id)
    return {
      ...toSummary(g),
      chapters: [{ id: 'all', title: 'Read', pageCount: g.num_pages }]
    }
  }

  async images(id: string): Promise<string[]> {
    const g = await this.getGallery(id)
    return g.images.pages.map((p, i) => {
      const ext = EXT[p.t] || 'jpg'
      return `${IMG}/galleries/${g.media_id}/${i + 1}.${ext}`
    })
  }
}

export function createNhentai(ctx: SourceContext): ComicSource {
  return new NhentaiSource(ctx.fetch)
}
