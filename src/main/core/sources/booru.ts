// Boorus source — image/gif/video boards with clean JSON APIs (Rule34, Gelbooru,
// Danbooru). Pick the board from the order dropdown. Search is tag-based.

import type {
  BrowseParams,
  Feed,
  FetchLike,
  MediaItem,
  Source,
  SourceContext,
  SourceOrder
} from '../../../shared/types'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface RawPost {
  id: string
  fileUrl?: string
  thumb?: string
  tags: string
  width?: number
  height?: number
  pageUrl: string
}

interface Board {
  value: string
  label: string
  firstPage: number
  json: (query: string, page: number) => string
  extract: (data: any) => any[]
  map: (raw: any) => RawPost
}

const BOARDS: Record<string, Board> = {
  rule34: {
    value: 'rule34',
    label: 'Rule34',
    firstPage: 0,
    json: (q, p) =>
      `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=40&pid=${p}&tags=${encodeURIComponent(q)}`,
    extract: (d) => (Array.isArray(d) ? d : []),
    map: (r) => ({
      id: String(r.id),
      fileUrl: r.file_url,
      thumb: r.preview_url || r.sample_url,
      tags: r.tags || '',
      width: r.width,
      height: r.height,
      pageUrl: `https://rule34.xxx/index.php?page=post&s=view&id=${r.id}`
    })
  },
  gelbooru: {
    value: 'gelbooru',
    label: 'Gelbooru',
    firstPage: 0,
    json: (q, p) =>
      `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=40&pid=${p}&tags=${encodeURIComponent(q)}`,
    extract: (d) => (Array.isArray(d) ? d : d?.post || []),
    map: (r) => ({
      id: String(r.id),
      fileUrl: r.file_url,
      thumb: r.preview_url,
      tags: r.tags || '',
      width: r.width,
      height: r.height,
      pageUrl: `https://gelbooru.com/index.php?page=post&s=view&id=${r.id}`
    })
  },
  danbooru: {
    value: 'danbooru',
    label: 'Danbooru',
    firstPage: 1,
    json: (q, p) =>
      `https://danbooru.donmai.us/posts.json?limit=40&page=${p}&tags=${encodeURIComponent(q)}`,
    extract: (d) => (Array.isArray(d) ? d : []),
    map: (r) => ({
      id: String(r.id),
      fileUrl: r.file_url || r.large_file_url,
      thumb: r.preview_file_url || r.large_file_url,
      tags: r.tag_string || '',
      width: r.image_width,
      height: r.image_height,
      pageUrl: `https://danbooru.donmai.us/posts/${r.id}`
    })
  }
}

const ORDERS: SourceOrder[] = Object.values(BOARDS).map((b) => ({ value: b.value, label: b.label }))
const VIDEO_RE = /\.(mp4|webm|m4v)(\?|$)/i

class BooruSource implements Source {
  readonly id = 'booru'
  readonly label = 'Boorus'
  readonly searchable = true
  readonly orders = ORDERS
  readonly defaultOrder = 'rule34'

  constructor(private readonly fetchImpl: FetchLike) {}

  browse(params: BrowseParams = {}): Promise<Feed> {
    return this.run('', params.order || this.defaultOrder, params.page ?? 1)
  }

  search(params: BrowseParams): Promise<Feed> {
    return this.run((params.query || '').trim(), params.order || this.defaultOrder, params.page ?? 1)
  }

  private async run(query: string, order: string, page: number): Promise<Feed> {
    const board = BOARDS[order] || BOARDS[this.defaultOrder]
    const sitePage = board.firstPage + (page - 1)
    const res = await this.fetchImpl(board.json(query, sitePage), {
      headers: { 'User-Agent': UA, Accept: 'application/json' }
    })
    if (!res.ok) throw new Error(`${board.label} request failed: ${res.status}`)
    const raws = board.extract(await res.json()).map((r) => board.map(r))

    const items: MediaItem[] = raws
      .filter((r: RawPost) => !!r.fileUrl)
      .map((r: RawPost) => {
        const isVideo = VIDEO_RE.test(r.fileUrl as string)
        const tags = r.tags.split(/\s+/).filter(Boolean)
        return {
          id: `${board.value}-${r.id}`,
          source: this.id,
          kind: isVideo ? 'video' : 'image',
          title: tags.slice(0, 3).join(' · ') || `#${r.id}`,
          thumbnail: r.thumb || '',
          streamUrl: isVideo ? r.fileUrl : undefined,
          imageUrl: isVideo ? undefined : r.fileUrl,
          width: r.width,
          height: r.height,
          tags: tags.slice(0, 12),
          sourceUrl: r.pageUrl
        }
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

export function createBooru(ctx: SourceContext): Source {
  return new BooruSource(ctx.fetch)
}
