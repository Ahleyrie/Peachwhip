// Unified content model shared between the main-process "core" and the renderer.
// Every source (RedGifs today; Reddit, comics, tube sites later) maps its native
// payload onto these types so the UI only ever speaks one language.

export type MediaKind = 'video' | 'image' | 'gallery'

export interface MediaItem {
  /** Stable per-source id. */
  id: string
  /** Source id, e.g. "redgifs". */
  source: string
  kind: MediaKind
  title: string
  author?: string
  /** Small still used in the grid. */
  thumbnail: string
  /** Larger still / video poster. */
  poster?: string
  /** Direct video URL for `video` items. */
  streamUrl?: string
  /** Direct image URL for `image` items. */
  imageUrl?: string
  width?: number
  height?: number
  /** Seconds. */
  duration?: number
  hasAudio?: boolean
  tags?: string[]
  views?: number
  likes?: number
  /** Canonical page on the origin site. */
  sourceUrl?: string
}

export interface Feed {
  items: MediaItem[]
  page: number
  pages: number
  total: number
  hasMore: boolean
  /** Opaque continuation token for cursor-based sources (e.g. Reddit's `after`). */
  nextCursor?: string
}

export interface BrowseParams {
  /** Search text; omitted/empty means "browse" (home/trending). */
  query?: string
  /** Source-specific ordering key (see Source.orders). */
  order?: string
  /** Page number for page-based sources (e.g. RedGifs). */
  page?: number
  count?: number
  /** Continuation token for cursor-based sources (e.g. Reddit). */
  cursor?: string
}

export interface SourceOrder {
  value: string
  label: string
}

export interface SourceInfo {
  id: string
  label: string
  /** Whether this source supports free-text search. */
  searchable: boolean
  orders: SourceOrder[]
  defaultOrder: string
}

/** Contract every content source implements in the core. */
export interface Source extends SourceInfo {
  browse(params: BrowseParams): Promise<Feed>
  search(params: BrowseParams): Promise<Feed>
}

// ---- Networking (injected into sources) ----
//
// Sources never call global fetch directly. The main process injects a fetch
// backed by Electron's Chromium network stack (`net.fetch`), which uses a real
// browser TLS fingerprint + cookie handling. That sidesteps two things at once:
// newer Node/OpenSSL rejecting Cloudflare's TLS renegotiation, and Cloudflare
// bot-blocking of non-browser clients — both common across adult sources.

export interface FetchResponseLike {
  ok: boolean
  status: number
  json(): Promise<any>
  text(): Promise<string>
}

export type FetchLike = (
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
    /** 'include' sends the session's cookies (used for the Reddit session). */
    credentials?: 'include' | 'omit' | 'same-origin'
  }
) => Promise<FetchResponseLike>

export interface SourceContext {
  fetch: FetchLike
  /** Read a persisted setting (e.g. a source's API credentials). */
  getSetting: (key: string) => string | undefined
  /** Persist a setting (e.g. a generated device id). */
  setSetting: (key: string, value: string | undefined) => void
}

// ---- Update / app status surfaced to the renderer ----

export type UpdateState =
  | { state: 'idle' }
  | { state: 'dev' }
  | { state: 'checking' }
  | { state: 'none' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }
