// Reddit NSFW source — browses curated NSFW subreddits (and any subreddit / search)
// via Reddit's OAuth API. Inspired by the RedHotSubs client.
//
// Reddit locked down the public *.json endpoints (they now 403), so we use the
// sanctioned path: userless "installed client" OAuth against oauth.reddit.com.
// That needs a free Reddit API client id (created once at reddit.com/prefs/apps),
// stored in settings as `redditClientId`. Until it's set, calls throw
// REDDIT_SETUP_REQUIRED and the UI shows a setup panel.
//
// Post media is normalized to the shared MediaItem model:
//   • Reddit-hosted video (is_video)  -> HLS stream (played via hls.js)
//   • redgifs.com links               -> resolved to MP4 via the shared RedgifsClient
//   • galleries (is_gallery)          -> first image (full gallery viewer is future work)
//   • direct images / .gifv / imgur   -> image or MP4
//   • link posts with a preview image -> image
// Text/self posts with no media are skipped. Paging is cursor-based (Reddit `after`).

import { randomBytes } from 'crypto'
import type {
  BrowseParams,
  Feed,
  FetchLike,
  MediaItem,
  Source,
  SourceContext,
  SourceOrder
} from '../../../shared/types'
import { RedgifsClient, extractRedgifsId } from './redgifs'

const OAUTH_BASE = 'https://oauth.reddit.com'
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
const INSTALLED_CLIENT_GRANT = 'https://oauth.reddit.com/grants/installed_client'
// Reddit expects a unique, descriptive User-Agent (not a generic browser string).
const APP_UA = 'Peachwhip/0.1.0 (desktop app)'

/** Thrown when no Reddit client id is configured; the UI turns this into a setup panel. */
export const REDDIT_SETUP_REQUIRED = 'REDDIT_SETUP_REQUIRED'

// A conservative default feed of popular, legal adult subreddits. Users can type
// any subreddit into the search box to browse it directly.
const DEFAULT_SUBS = [
  'nsfw',
  'gonewild',
  'RealGirls',
  'nsfw_gifs',
  'holdthemoan',
  'BustyPetite',
  'Amateur',
  'porn'
]

const ORDERS: SourceOrder[] = [
  { value: 'hot', label: 'Hot' },
  { value: 'top-week', label: 'Top (Week)' },
  { value: 'top-month', label: 'Top (Month)' },
  { value: 'top-all', label: 'Top (All)' },
  { value: 'new', label: 'New' },
  { value: 'rising', label: 'Rising' }
]

function parseOrder(order: string): { sort: string; t?: string } {
  if (order.startsWith('top')) return { sort: 'top', t: order.split('-')[1] || 'week' }
  return { sort: order }
}

// ---- Minimal shapes of the Reddit JSON we read (raw_json=1 -> unescaped URLs) ----

interface RedditImagePreview {
  url: string
  width: number
  height: number
}
interface RedditPreview {
  images?: { source?: RedditImagePreview; resolutions?: RedditImagePreview[] }[]
}
interface RedditVideo {
  hls_url?: string
  fallback_url?: string
  width?: number
  height?: number
  duration?: number
}
interface RedditMediaMeta {
  s?: { u?: string; gif?: string; mp4?: string }
}
interface RedditPost {
  id: string
  title: string
  author: string
  subreddit_name_prefixed?: string
  permalink: string
  ups?: number
  url?: string
  domain?: string
  post_hint?: string
  is_video?: boolean
  is_gallery?: boolean
  preview?: RedditPreview
  media?: { reddit_video?: RedditVideo }
  media_metadata?: Record<string, RedditMediaMeta>
  gallery_data?: { items?: { media_id: string }[] }
}
interface RedditListing {
  data?: { after?: string | null; children?: { kind: string; data: RedditPost }[] }
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp)(\?|$)/i

/** Pick a mid-sized preview resolution for grid thumbnails; fall back to source. */
function pickThumb(post: RedditPost): string | undefined {
  const img = post.preview?.images?.[0]
  if (!img) return undefined
  const res = img.resolutions || []
  const mid = res.find((r) => r.width >= 640) || res[res.length - 1]
  return mid?.url || img.source?.url
}

function previewSource(post: RedditPost): string | undefined {
  return post.preview?.images?.[0]?.source?.url
}

export class RedditSource implements Source {
  readonly id = 'reddit'
  readonly label = 'Reddit'
  readonly searchable = true
  readonly orders = ORDERS
  readonly defaultOrder = 'hot'

  private token: string | null = null
  private tokenExpiresAt = 0
  private tokenPromise: Promise<string> | null = null

  constructor(
    private readonly fetchImpl: FetchLike,
    private readonly redgifs: RedgifsClient,
    private readonly getSetting: (key: string) => string | undefined,
    private readonly setSetting: (key: string, value: string | undefined) => void
  ) {}

  private deviceId(): string {
    let id = this.getSetting('redditDeviceId')
    if (!id) {
      id = randomBytes(16).toString('hex')
      this.setSetting('redditDeviceId', id)
    }
    return id
  }

  private async getToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() < this.tokenExpiresAt) return this.token
    if (this.tokenPromise) return this.tokenPromise

    const clientId = this.getSetting('redditClientId')
    if (!clientId) throw new Error(REDDIT_SETUP_REQUIRED)

    this.tokenPromise = (async () => {
      const auth = Buffer.from(`${clientId}:`).toString('base64')
      const body = `grant_type=${encodeURIComponent(INSTALLED_CLIENT_GRANT)}&device_id=${this.deviceId()}`
      const res = await this.fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': APP_UA
        },
        body
      })
      if (!res.ok) throw new Error(`Reddit auth failed: ${res.status} (check your client id)`)
      const data = (await res.json()) as { access_token?: string; expires_in?: number }
      if (!data.access_token) throw new Error('Reddit auth returned no token')
      this.token = data.access_token
      this.tokenExpiresAt = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000
      return this.token
    })()

    try {
      return await this.tokenPromise
    } finally {
      this.tokenPromise = null
    }
  }

  private async api<T>(pathWithQuery: string): Promise<T> {
    const call = async (token: string) =>
      this.fetchImpl(`${OAUTH_BASE}${pathWithQuery}`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': APP_UA }
      })

    let token = await this.getToken()
    let res = await call(token)
    if (res.status === 401) {
      token = await this.getToken(true)
      res = await call(token)
    }
    if (!res.ok) throw new Error(`Reddit request failed: ${res.status}`)
    return (await res.json()) as T
  }

  async browse(params: BrowseParams = {}): Promise<Feed> {
    const { sort, t } = parseOrder(params.order || this.defaultOrder)
    return this.listing(`/r/${DEFAULT_SUBS.join('+')}/${sort}`, t, params.cursor)
  }

  async search(params: BrowseParams): Promise<Feed> {
    const q = (params.query || '').trim()
    if (!q) return this.browse(params)
    const { sort, t } = parseOrder(params.order || this.defaultOrder)

    if (/\s/.test(q)) {
      // Multi-word => global NSFW search.
      const qs = new URLSearchParams({
        q,
        include_over_18: 'on',
        sort: 'relevance',
        limit: '40',
        raw_json: '1'
      })
      if (params.cursor) qs.set('after', params.cursor)
      return this.fetchListing(`/search?${qs.toString()}`)
    }

    // Single token => treat as a subreddit name.
    const sub = q.replace(/^\/?(r\/)?/i, '')
    return this.listing(`/r/${sub}/${sort}`, t, params.cursor)
  }

  private listing(path: string, t?: string, after?: string): Promise<Feed> {
    const qs = new URLSearchParams({ limit: '40', raw_json: '1' })
    if (t) qs.set('t', t)
    if (after) qs.set('after', after)
    return this.fetchListing(`${path}?${qs.toString()}`)
  }

  private async fetchListing(pathWithQuery: string): Promise<Feed> {
    const json = await this.api<RedditListing>(pathWithQuery)
    const children = (json.data?.children || []).filter((c) => c.kind === 't3')
    const mapped = await Promise.all(children.map((c) => this.toItem(c.data)))
    const items = mapped.filter((i): i is MediaItem => i !== null)
    const after = json.data?.after || undefined
    return {
      items,
      page: 1,
      pages: after ? 2 : 1,
      total: items.length,
      hasMore: !!after,
      nextCursor: after
    }
  }

  private base(post: RedditPost): Omit<MediaItem, 'kind'> {
    return {
      id: post.id,
      source: this.id,
      title: post.title,
      author: post.author,
      thumbnail: pickThumb(post) || '',
      likes: post.ups,
      tags: post.subreddit_name_prefixed ? [post.subreddit_name_prefixed] : undefined,
      sourceUrl: `https://www.reddit.com${post.permalink}`
    }
  }

  private async toItem(post: RedditPost): Promise<MediaItem | null> {
    const b = this.base(post)
    const url = post.url || ''

    // 1) RedGifs link -> resolve to a playable MP4.
    const rgId = extractRedgifsId(url)
    if (rgId) {
      const r = await this.redgifs.resolve(rgId)
      if (r?.streamUrl) {
        return {
          ...b,
          kind: 'video',
          streamUrl: r.streamUrl,
          poster: r.poster,
          thumbnail: r.thumbnail || b.thumbnail,
          hasAudio: r.hasAudio,
          duration: r.duration,
          width: r.width,
          height: r.height
        }
      }
      // Resolution failed — fall through to a preview image if we have one.
    }

    // 2) Reddit-hosted video -> HLS (has audio), else the video-only fallback MP4.
    const rv = post.media?.reddit_video
    if (post.is_video && rv && (rv.hls_url || rv.fallback_url)) {
      return {
        ...b,
        kind: 'video',
        streamUrl: rv.hls_url || rv.fallback_url,
        poster: previewSource(post),
        hasAudio: !!rv.hls_url,
        duration: rv.duration,
        width: rv.width,
        height: rv.height
      }
    }

    // 3) Gallery -> first image (full gallery viewer is future work).
    if (post.is_gallery && post.media_metadata && post.gallery_data?.items?.length) {
      const count = post.gallery_data.items.length
      const firstId = post.gallery_data.items[0].media_id
      const meta = post.media_metadata[firstId]?.s
      const imageUrl = meta?.u || meta?.gif
      if (imageUrl) {
        return {
          ...b,
          kind: 'image',
          imageUrl,
          thumbnail: b.thumbnail || imageUrl,
          title: `${post.title} (${count})`
        }
      }
    }

    // 4) imgur .gifv -> MP4.
    if (/\.gifv$/i.test(url)) {
      return {
        ...b,
        kind: 'video',
        streamUrl: url.replace(/\.gifv$/i, '.mp4'),
        poster: previewSource(post)
      }
    }

    // 5) Direct image.
    if (post.post_hint === 'image' || IMAGE_RE.test(url) || post.domain === 'i.redd.it') {
      const imageUrl = previewSource(post) || url
      return { ...b, kind: 'image', imageUrl, thumbnail: b.thumbnail || imageUrl }
    }

    // 6) Link post that at least has a preview image.
    const prev = previewSource(post)
    if (prev) return { ...b, kind: 'image', imageUrl: prev, thumbnail: b.thumbnail || prev }

    // 7) No usable media.
    return null
  }
}

export function createReddit(ctx: SourceContext, redgifs: RedgifsClient): Source {
  return new RedditSource(ctx.fetch, redgifs, ctx.getSetting, ctx.setSetting)
}
