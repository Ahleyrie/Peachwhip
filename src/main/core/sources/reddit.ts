// Reddit NSFW source — browses curated NSFW subreddits (and any subreddit / search)
// using Reddit's public .json endpoints with the user's logged-in session cookies.
//
// Why session-based instead of the API: Reddit disabled self-serve API keys
// (pre-approval only now) AND returns EMPTY listings for NSFW subs unless the
// request carries a logged-in session. So the app has the user log in via
// reddit-auth.ts, and here we fetch .json with credentials:'include' so those
// session cookies are sent. Requires the account to have adult content enabled.
//
// Post media is normalized to the shared MediaItem model:
//   • Reddit-hosted video (is_video)  -> HLS stream (played via hls.js)
//   • redgifs.com links               -> resolved to MP4 via the shared RedgifsClient
//   • galleries (is_gallery)          -> first image (full gallery viewer is future work)
//   • direct images / .gifv / imgur   -> image or MP4
//   • link posts with a preview image -> image
// Text/self posts with no media are skipped. Paging is cursor-based (Reddit `after`).

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

const BASE = 'https://www.reddit.com'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

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

  constructor(
    private readonly fetchImpl: FetchLike,
    private readonly redgifs: RedgifsClient
  ) {}

  async browse(params: BrowseParams = {}): Promise<Feed> {
    const { sort, t } = parseOrder(params.order || this.defaultOrder)
    return this.listing(`/r/${DEFAULT_SUBS.join('+')}/${sort}`, t, params.cursor)
  }

  async search(params: BrowseParams): Promise<Feed> {
    const q = (params.query || '').trim()
    if (!q) return this.browse(params)
    const { sort, t } = parseOrder(params.order || this.defaultOrder)

    // A single token (or an explicit r/name) is treated as a subreddit to browse.
    // If that subreddit 404s (doesn't exist), fall back to a global NSFW search.
    if (!/\s/.test(q)) {
      const sub = q.replace(/^\/?(r\/)?/i, '')
      try {
        return await this.listing(`/r/${sub}/${sort}`, t, params.cursor)
      } catch (e) {
        if (!String((e as Error)?.message || '').includes('404')) throw e
      }
    }

    const qs = new URLSearchParams({
      q,
      include_over_18: 'on',
      sort: 'relevance',
      limit: '40',
      raw_json: '1'
    })
    if (params.cursor) qs.set('after', params.cursor)
    return this.fetchListing(`/search.json?${qs.toString()}`)
  }

  private listing(path: string, t?: string, after?: string): Promise<Feed> {
    const qs = new URLSearchParams({ limit: '40', raw_json: '1' })
    if (t) qs.set('t', t)
    if (after) qs.set('after', after)
    return this.fetchListing(`${path}.json?${qs.toString()}`)
  }

  private async fetchListing(pathWithQuery: string): Promise<Feed> {
    const res = await this.fetchImpl(`${BASE}${pathWithQuery}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      credentials: 'include'
    })
    if (!res.ok) throw new Error(`Reddit request failed: ${res.status}`)
    const json = (await res.json()) as RedditListing
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
  return new RedditSource(ctx.fetch, redgifs)
}
