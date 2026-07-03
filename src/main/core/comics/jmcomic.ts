// JMComic / 18comic source — the source Jasmine uses. EXPERIMENTAL/UNVERIFIED here
// (blocked by the dev network's adult filter). API/CDN hosts recovered from Jasmine;
// signing + AES + image de-scramble follow the known JMComic mobile-API scheme.
//
// Requests: headers `token = md5(ts + APP_TOKEN_SECRET)`, `tokenparam = "ts,version"`.
// Responses: { code, data } where data is base64 AES-256-ECB ciphertext; key =
// md5(ts + APP_DATA_SECRET) (same ts as the request), PKCS7-padded, → JSON.
// Images on some albums are vertically scrambled into N strips; N is derived from
// md5(photoId + filename) and the page is reassembled on a <canvas> in the renderer.
// We pass N to the renderer via a `#pw_scramble=N` fragment on the image URL.

import { createHash, createDecipheriv } from 'crypto'
import type {
  ComicDetail,
  ComicFeed,
  ComicSource,
  ComicSummary,
  FetchLike,
  SourceContext,
  SourceOrder
} from '../../../shared/types'

// Recovered from Jasmine (base64-decoded).
const API_HOSTS = ['www.cdnbea.net', 'www.cdnhth.net', 'www.cdngwc.cc', 'www.cdnhth.club']
const IMG_HOST = 'cdn-msp.jmapiproxy1.cc'

const APP_VERSION = '1.7.9'
const APP_TOKEN_SECRET = '18comicAPPContent'
const APP_DATA_SECRET = '185Hcomic3PAPP7R'
const UA = 'okhttp/3.12.1'
const SCRAMBLE_ID = 220980

const ORDERS: SourceOrder[] = [
  { value: 'mr', label: 'Recent' },
  { value: 'mv', label: 'Most viewed' },
  { value: 'tf', label: 'Most liked' }
]

function md5hex(s: string): string {
  return createHash('md5').update(s).digest('hex')
}

function decodeData(dataB64: string, ts: number): string {
  const key = Buffer.from(md5hex(`${ts}${APP_DATA_SECRET}`), 'utf8') // 32 bytes -> AES-256
  const decipher = createDecipheriv('aes-256-ecb', key, null)
  decipher.setAutoPadding(true)
  const out = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
  return out.toString('utf8')
}

/** Strips (num) that a photo image is scrambled into; <=1 means no scramble. */
export function jmScrambleNum(photoId: string, filenameNoExt: string): number {
  const id = parseInt(photoId, 10)
  if (!id || id < SCRAMBLE_ID) return 1
  if (id < 268850) return 10
  const x = id < 421926 ? 10 : 8
  const s = md5hex(`${id}${filenameNoExt}`)
  let num = s.charCodeAt(s.length - 1)
  num %= x
  return num * 2 + 2
}

class JMComicSource implements ComicSource {
  readonly id = 'jmcomic'
  readonly label = 'JMComic'
  readonly orders = ORDERS
  readonly defaultOrder = 'mv'

  constructor(private readonly fetchImpl: FetchLike) {}

  private async apiGet<T = any>(path: string): Promise<T> {
    const ts = Math.floor(Date.now() / 1000)
    const headers = {
      token: md5hex(`${ts}${APP_TOKEN_SECRET}`),
      tokenparam: `${ts},${APP_VERSION}`,
      'User-Agent': UA,
      Accept: 'application/json'
    }
    let lastErr: unknown
    for (const host of API_HOSTS) {
      try {
        const res = await this.fetchImpl(`https://${host}${path}`, { headers })
        if (!res.ok) {
          lastErr = new Error(`JMComic ${host} ${res.status}`)
          continue
        }
        const body = (await res.json()) as { code?: number; data?: string }
        if (body.code !== 200 || typeof body.data !== 'string') {
          lastErr = new Error('JMComic bad response')
          continue
        }
        return JSON.parse(decodeData(body.data, ts)) as T
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('JMComic request failed')
  }

  private cover(id: string | number): string {
    return `https://${IMG_HOST}/media/albums/${id}_3x4.jpg`
  }

  private toSummary(a: any): ComicSummary {
    return {
      id: String(a.id),
      source: 'jmcomic',
      title: a.name || a.title || `#${a.id}`,
      cover: this.cover(a.id),
      tags: Array.isArray(a.tags) ? a.tags.slice(0, 8) : undefined,
      language: a.category?.title
    }
  }

  private toFeed(data: any, page: number): ComicFeed {
    const content: any[] = data?.content || data?.list || []
    const items = content.filter((a) => a && a.id).map((a) => this.toSummary(a))
    return { items, page, hasMore: items.length > 0 }
  }

  async browse(params: { order?: string; page?: number }): Promise<ComicFeed> {
    const order = params.order || this.defaultOrder
    const page = params.page ?? 1
    const data = await this.apiGet(`/categories/filter?o=${order}&c=&page=${page}`)
    return this.toFeed(data, page)
  }

  async search(params: { query?: string; order?: string; page?: number }): Promise<ComicFeed> {
    const q = (params.query || '').trim()
    if (!q) return this.browse(params)
    const order = params.order || this.defaultOrder
    const page = params.page ?? 1
    const data = await this.apiGet(
      `/search?search_query=${encodeURIComponent(q)}&o=${order}&page=${page}`
    )
    return this.toFeed(data, page)
  }

  async detail(id: string): Promise<ComicDetail> {
    const a = await this.apiGet(`/album?id=${id}`)
    const series: any[] = Array.isArray(a.series) ? a.series : []
    const chapters =
      series.length > 0
        ? series.map((s, i) => ({ id: String(s.id), title: s.name || `Chapter ${i + 1}` }))
        : [{ id: String(id), title: 'Read' }]
    const author = Array.isArray(a.author) ? a.author.join(', ') : a.author
    return {
      ...this.toSummary(a),
      description: author ? `by ${author}` : undefined,
      chapters
    }
  }

  async images(_id: string, chapterId: string): Promise<string[]> {
    const data = await this.apiGet(`/chapter?id=${chapterId}`)
    const files: string[] = data?.images || []
    return files.map((filename) => {
      const noExt = filename.replace(/\.[a-z0-9]+$/i, '')
      const num = jmScrambleNum(chapterId, noExt)
      const url = `https://${IMG_HOST}/media/photos/${chapterId}/${filename}`
      return num > 1 ? `${url}#pw_scramble=${num}` : url
    })
  }
}

export function createJmcomic(ctx: SourceContext): ComicSource {
  return new JMComicSource(ctx.fetch)
}
