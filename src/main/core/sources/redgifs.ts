// RedGifs source — a TypeScript port of the endpoints/headers used by the
// `redgifs` Python library (MIT, scrazzz). Uses Node's global fetch (Node 18+).
//
// Auth: GET /v2/auth/temporary -> { token }; sent as `Authorization: Bearer <token>`.
// The temporary token is IP/UA-bound and lasts ~24h, so we cache and refresh it
// (also refreshing eagerly on a 401).

import type {
  BrowseParams,
  Feed,
  FetchLike,
  MediaItem,
  Source,
  SourceContext,
  SourceOrder
} from '../../../shared/types'

const API_BASE = 'https://api.redgifs.com'

// A browser-like UA. RedGifs ties the temp token to the UA that requested it, so
// the same UA must be used for the token fetch, the API calls, AND the media
// requests (the latter is enforced via header injection in the main process).
export const REDGIFS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const ORDERS: SourceOrder[] = [
  { value: 'trending', label: 'Trending' },
  { value: 'top7', label: 'Top (Week)' },
  { value: 'top28', label: 'Top (Month)' },
  { value: 'latest', label: 'Latest' }
]

interface RgMediaUrls {
  sd?: string
  hd?: string
  poster?: string
  thumbnail?: string
  vthumbnail?: string
}

interface RgGif {
  id: string
  userName?: string
  createDate?: number
  hasAudio?: boolean
  width?: number
  height?: number
  likes?: number
  views?: number
  duration?: number
  tags?: string[]
  urls: RgMediaUrls
}

interface RgSearchResponse {
  page: number
  pages: number
  total: number
  gifs: RgGif[]
}

class RedGifsSource implements Source {
  readonly id = 'redgifs'
  readonly label = 'RedGifs'
  readonly searchable = true
  readonly orders = ORDERS
  readonly defaultOrder = 'trending'

  private readonly fetch: FetchLike
  private token: string | null = null
  private tokenFetchedAt = 0
  private tokenPromise: Promise<string> | null = null
  // Refresh a little before the ~24h expiry.
  private static readonly TOKEN_TTL_MS = 23 * 60 * 60 * 1000

  constructor(ctx: SourceContext) {
    this.fetch = ctx.fetch
  }

  private async getToken(force = false): Promise<string> {
    const fresh = this.token && Date.now() - this.tokenFetchedAt < RedGifsSource.TOKEN_TTL_MS
    if (!force && fresh) return this.token as string
    if (this.tokenPromise) return this.tokenPromise

    this.tokenPromise = (async () => {
      const res = await this.fetch(`${API_BASE}/v2/auth/temporary`, {
        headers: { 'User-Agent': REDGIFS_UA }
      })
      if (!res.ok) throw new Error(`RedGifs auth failed: ${res.status}`)
      const data = (await res.json()) as { token?: string }
      if (!data.token) throw new Error('RedGifs auth returned no token')
      this.token = data.token
      this.tokenFetchedAt = Date.now()
      return this.token
    })()

    try {
      return await this.tokenPromise
    } finally {
      this.tokenPromise = null
    }
  }

  private async apiGet<T>(path: string): Promise<T> {
    const doFetch = (token: string) =>
      this.fetch(`${API_BASE}${path}`, {
        headers: { 'User-Agent': REDGIFS_UA, Authorization: `Bearer ${token}` }
      })

    let token = await this.getToken()
    let res = await doFetch(token)
    if (res.status === 401) {
      // Token expired/invalid — refresh once and retry.
      token = await this.getToken(true)
      res = await doFetch(token)
    }
    if (!res.ok) throw new Error(`RedGifs ${path} failed: ${res.status}`)
    return (await res.json()) as T
  }

  private toItem(gif: RgGif): MediaItem {
    const stream = gif.urls.hd || gif.urls.sd
    const thumb = gif.urls.thumbnail || gif.urls.poster || gif.urls.vthumbnail || ''
    const title =
      gif.tags && gif.tags.length ? gif.tags.slice(0, 3).join(' · ') : gif.userName || gif.id
    return {
      id: gif.id,
      source: this.id,
      kind: 'video',
      title,
      author: gif.userName,
      thumbnail: thumb,
      poster: gif.urls.poster || thumb,
      streamUrl: stream,
      width: gif.width,
      height: gif.height,
      duration: gif.duration,
      hasAudio: gif.hasAudio,
      tags: gif.tags,
      views: gif.views,
      likes: gif.likes,
      sourceUrl: `https://www.redgifs.com/watch/${gif.id}`
    }
  }

  private toFeed(data: RgSearchResponse): Feed {
    const items = (data.gifs || []).map((g) => this.toItem(g)).filter((i) => !!i.streamUrl)
    const page = data.page ?? 1
    const pages = data.pages ?? page
    return { items, page, pages, total: data.total ?? items.length, hasMore: page < pages }
  }

  /** Home / trending feed (no search text). */
  async browse(params: BrowseParams = {}): Promise<Feed> {
    const order = params.order || this.defaultOrder
    const count = params.count ?? 40
    const page = params.page ?? 1
    const qs = new URLSearchParams({
      order,
      count: String(count),
      page: String(page),
      type: 'g'
    })
    const data = await this.apiGet<RgSearchResponse>(`/v2/gifs/search?${qs.toString()}`)
    return this.toFeed(data)
  }

  /** Free-text search. Sends both `search_text` and `tags` for API compatibility. */
  async search(params: BrowseParams): Promise<Feed> {
    const query = (params.query || '').trim()
    if (!query) return this.browse(params)
    const order = params.order || this.defaultOrder
    const count = params.count ?? 40
    const page = params.page ?? 1
    const qs = new URLSearchParams({
      search_text: query,
      tags: query,
      order,
      count: String(count),
      page: String(page),
      type: 'g'
    })
    const data = await this.apiGet<RgSearchResponse>(`/v2/gifs/search?${qs.toString()}`)
    return this.toFeed(data)
  }
}

export function createRedgifs(ctx: SourceContext): Source {
  return new RedGifsSource(ctx)
}
