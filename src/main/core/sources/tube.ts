// Tube source — search across major tube sites (Pornhub, xVideos, RedTube, YouPorn).
// The search URL builders + HTML parsers are adapted from the `pornsearch` library
// (MIT, LucasLeandro1204), but run through Electron's net.fetch (browser TLS/UA to
// get past basic Cloudflare) instead of the library's global fetch.
//
// Tube sites don't expose direct stream URLs (extracting them is fragile and breaks
// often), so playback uses each site's official embed player (embedUrl -> iframe).
// This is best-effort: sites change markup and rate-limit; results degrade to empty.

import * as cheerio from 'cheerio'
import type {
  BrowseParams,
  Feed,
  FetchLike,
  MediaItem,
  Source,
  SourceOrder,
  SourceContext
} from '../../../shared/types'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface RawResult {
  title: string
  url: string
  duration?: string
  thumb?: string
  embed?: string
}

interface TubeSite {
  value: string
  label: string
  firstPage: number
  json?: boolean
  buildUrl: (query: string, page: number) => string
  parse: (bodyOrDoc: string) => RawResult[]
  embed: (pageUrl: string) => string | undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function text($: cheerio.CheerioAPI, el: any, sel: string): string {
  return $(el).find(sel).first().text().trim()
}

const SITES: Record<string, TubeSite> = {
  pornhub: {
    value: 'pornhub',
    label: 'Pornhub',
    firstPage: 1,
    buildUrl: (q, p) =>
      `https://www.pornhub.com/video/search?search=${encodeURIComponent(q)}&page=${p}`,
    parse: (body) => {
      const $ = cheerio.load(body)
      return $('ul.videos li.pcVideoListItem, ul.videos.search-video-thumbs li')
        .map((_i, el) => {
          const a = $(el).find('a').first()
          const href = a.attr('href')
          if (!href || !href.includes('view_video')) return undefined
          const img = $(el).find('img').first()
          const thumb =
            img.attr('data-mediumthumb') || img.attr('data-thumb_url') || img.attr('src') || ''
          return {
            title: (a.attr('title') || $(el).find('.title a').text() || '').trim(),
            url: href.startsWith('http') ? href : `https://www.pornhub.com${href}`,
            duration: text($, el, '.duration'),
            thumb: thumb.replace(/\([^)]*\)/g, '')
          }
        })
        .get()
        .filter(Boolean) as RawResult[]
    },
    embed: (url) => {
      const m = url.match(/viewkey=([a-z0-9]+)/i)
      return m ? `https://www.pornhub.com/embed/${m[1]}` : undefined
    }
  },

  xvideos: {
    value: 'xvideos',
    label: 'xVideos',
    firstPage: 0,
    buildUrl: (q, p) => `https://www.xvideos.com/?k=${encodeURIComponent(q)}&p=${p}`,
    parse: (body) => {
      const $ = cheerio.load(body)
      return $('#content .mozaique .thumb-block')
        .map((_i, el) => {
          const a = $(el).find('p a').first()
          const href = a.attr('href')
          if (!href) return undefined
          const img = $(el).find('.thumb img').first()
          const thumb = img.attr('data-src') || img.attr('src') || ''
          return {
            title: a.text().trim(),
            url: `https://www.xvideos.com${href}`,
            duration: text($, el, '.duration'),
            thumb: thumb.replace('THUMBNUM', '5')
          }
        })
        .get()
        .filter(Boolean) as RawResult[]
    },
    embed: (url) => {
      const m = url.match(/xvideos\.com\/video\.?([a-z0-9]+)/i)
      return m ? `https://www.xvideos.com/embedframe/${m[1]}` : undefined
    }
  },

  redtube: {
    value: 'redtube',
    label: 'RedTube',
    firstPage: 1,
    json: true,
    buildUrl: (q, p) =>
      `https://api.redtube.com/?data=redtube.Videos.searchVideos&output=json&thumbsize=big&search=${encodeURIComponent(q)}&page=${p}`,
    parse: (body) => {
      try {
        const data = JSON.parse(body) as {
          videos?: { video: { title: string; url: string; duration: string; default_thumb: string } }[]
        }
        return (data.videos || []).map(({ video }) => ({
          title: video.title,
          url: video.url,
          duration: video.duration,
          thumb: video.default_thumb
        }))
      } catch {
        return []
      }
    },
    embed: (url) => {
      const m = url.match(/redtube\.com\/(\d+)/)
      return m ? `https://embed.redtube.com/?id=${m[1]}` : undefined
    }
  },

  youporn: {
    value: 'youporn',
    label: 'YouPorn',
    firstPage: 1,
    buildUrl: (q, p) =>
      `https://www.youporn.com/search/?query=${encodeURIComponent(q)}&page=${p}`,
    parse: (body) => {
      const $ = cheerio.load(body)
      return $('div.video-box, .video-box-wrapper')
        .map((_i, el) => {
          const a = $(el).find('a').first()
          const href = a.attr('href')
          if (!href) return undefined
          const img = $(el).find('.thumb-image, img').first()
          const thumb = img.attr('data-src') || img.attr('data-original') || img.attr('src') || ''
          return {
            title: (text($, el, '.video-title-text') || a.attr('title') || '').trim(),
            url: href.startsWith('http') ? href : `https://www.youporn.com${href}`,
            duration: text($, el, '.video-duration'),
            thumb
          }
        })
        .get()
        .filter(Boolean) as RawResult[]
    },
    embed: (url) => {
      const m = url.match(/(?:watch|embed)\/(\d+)/)
      return m ? `https://www.youporn.com/embed/${m[1]}/` : undefined
    }
  },

  eporner: {
    value: 'eporner',
    label: 'Eporner',
    firstPage: 1,
    json: true,
    buildUrl: (q, p) =>
      `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(q)}&per_page=40&page=${p}&thumbsize=medium&order=top-weekly&format=json&lq=1`,
    parse: (body) => {
      try {
        const data = JSON.parse(body) as {
          videos?: { title: string; url: string; length_sec?: number; embed?: string; default_thumb?: { src?: string } }[]
        }
        return (data.videos || []).map((v) => ({
          title: v.title,
          url: v.url,
          duration: v.length_sec
            ? `${Math.floor(v.length_sec / 60)}:${String(v.length_sec % 60).padStart(2, '0')}`
            : undefined,
          thumb: v.default_thumb?.src,
          embed: v.embed
        }))
      } catch {
        return []
      }
    },
    embed: () => undefined
  }
}

const ORDERS: SourceOrder[] = Object.values(SITES).map((s) => ({ value: s.value, label: s.label }))

function parseDuration(d?: string): number | undefined {
  if (!d) return undefined
  const parts = d
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10))
  if (parts.some((n) => Number.isNaN(n))) return undefined
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

class TubeSource implements Source {
  readonly id = 'tube'
  readonly label = 'Tube'
  readonly searchable = true
  readonly orders = ORDERS
  readonly defaultOrder = 'redtube'

  constructor(private readonly fetchImpl: FetchLike) {}

  // Tube sites are search-only; browsing with no query returns nothing.
  async browse(): Promise<Feed> {
    return { items: [], page: 1, pages: 1, total: 0, hasMore: false }
  }

  async search(params: BrowseParams): Promise<Feed> {
    const query = (params.query || '').trim()
    const site = SITES[params.order || this.defaultOrder] || SITES[this.defaultOrder]
    if (!query) return this.browse()

    const appPage = params.page ?? 1
    const sitePage = site.firstPage + (appPage - 1)
    const res = await this.fetchImpl(site.buildUrl(query, sitePage), {
      headers: { 'User-Agent': UA, Accept: site.json ? 'application/json' : 'text/html' }
    })
    if (!res.ok) throw new Error(`${site.label} request failed: ${res.status}`)
    const body = await res.text()
    const raw = site.parse(body)

    const items: MediaItem[] = raw.map((r) => {
      const embedUrl = r.embed || site.embed(r.url)
      const embedId = embedUrl?.match(/(\d+|[a-z0-9]+)\/?$/i)?.[1]
      return {
        id: `${site.value}-${embedId || encodeURIComponent(r.url)}`,
        source: this.id,
        kind: 'video',
        title: r.title || site.label,
        thumbnail: r.thumb || '',
        duration: parseDuration(r.duration),
        embedUrl,
        sourceUrl: r.url,
        tags: [site.label]
      }
    })

    return {
      items,
      page: appPage,
      pages: items.length ? appPage + 1 : appPage,
      total: items.length,
      hasMore: items.length > 0
    }
  }
}

export function createTube(ctx: SourceContext): Source {
  return new TubeSource(ctx.fetch)
}
