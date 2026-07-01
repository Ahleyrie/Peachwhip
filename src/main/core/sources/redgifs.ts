// RedGifs — a TypeScript port of the endpoints/headers used by the `redgifs`
// Python library (MIT, scrazzz). Split into:
//   • RedgifsClient — auth + raw API calls (reused by the Reddit source to resolve
//     redgifs.com links into playable MP4s)
//   • RedGifsSource — the browsable Source built on top of the client
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

export interface RgGif {
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

/** Normalized playable media extracted from a single gif. */
export interface RgResolved {
  streamUrl?: string
  poster?: string
  thumbnail?: string
  hasAudio?: boolean
  duration?: number
  width?: number
  height?: number
}

/** Extract a redgifs id from a watch/embed URL, or null if it isn't one. */
export function extractRedgifsId(url: string): string | null {
  const m = url.match(/redgifs\.com\/(?:watch|ifr|i)\/([A-Za-z0-9]+)/i)
  return m ? m[1] : null
}

export class RedgifsClient {
  constructor(private readonly fetchImpl: FetchLike) {}

  private token: string | null = null
  private tokenFetchedAt = 0
  private tokenPromise: Promise<string> | null = null
  // Refresh a little before the ~24h expiry.
  private static readonly TOKEN_TTL_MS = 23 * 60 * 60 * 1000

  private async getToken(force = false): Promise<string> {
    const fresh = this.token && Date.now() - this.tokenFetchedAt < RedgifsClient.TOKEN_TTL_MS
    if (!force && fresh) return this.token as string
    if (this.tokenPromise) return this.tokenPromise

    this.tokenPromise = (async () => {
      const res = await this.fetchImpl(`${API_BASE}/v2/auth/temporary`, {
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

  async apiGet<T>(path: string): Promise<T> {
    const doFetch = (token: string) =>
      this.fetchImpl(`${API_BASE}${path}`, {
        headers: { 'User-Agent': REDGIFS_UA, Authorization: `Bearer ${token}` }
      })

    let token = await this.getToken()
    let res = await doFetch(token)
    if (res.status === 401) {
      token = await this.getToken(true)
      res = await doFetch(token)
    }
    if (!res.ok) throw new Error(`RedGifs ${path} failed: ${res.status}`)
    return (await res.json()) as T
  }

  async getGif(id: string): Promise<RgGif | null> {
    try {
      const r = await this.apiGet<{ gif: RgGif }>(`/v2/gifs/${id}`)
      return r.gif ?? null
    } catch {
      return null
    }
  }

  /** Resolve a redgifs id into normalized playable media (used by other sources). */
  async resolve(id: string): Promise<RgResolved | null> {
    const gif = await this.getGif(id)
    if (!gif) return null
    return {
      streamUrl: gif.urls.hd || gif.urls.sd,
      poster: gif.urls.poster,
      thumbnail: gif.urls.thumbnail || gif.urls.poster,
      hasAudio: gif.hasAudio,
      duration: gif.duration,
      width: gif.width,
      height: gif.height
    }
  }
}

class RedGifsSource implements Source {
  readonly id = 'redgifs'
  readonly label = 'RedGifs'
  readonly searchable = true
  readonly orders = ORDERS
  readonly defaultOrder = 'trending'

  constructor(private readonly client: RedgifsClient) {}

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

  async browse(params: BrowseParams = {}): Promise<Feed> {
    const order = params.order || this.defaultOrder
    const count = params.count ?? 40
    const page = params.page ?? 1
    const qs = new URLSearchParams({ order, count: String(count), page: String(page), type: 'g' })
    const data = await this.client.apiGet<RgSearchResponse>(`/v2/gifs/search?${qs.toString()}`)
    return this.toFeed(data)
  }

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
    const data = await this.client.apiGet<RgSearchResponse>(`/v2/gifs/search?${qs.toString()}`)
    return this.toFeed(data)
  }
}

export function createRedgifsClient(ctx: SourceContext): RedgifsClient {
  return new RedgifsClient(ctx.fetch)
}

export function createRedgifsSource(client: RedgifsClient): Source {
  return new RedGifsSource(client)
}
