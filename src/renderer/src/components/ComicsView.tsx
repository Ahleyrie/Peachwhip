import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComicDetail, ComicSourceInfo, ComicSummary } from '@shared/types'
import { ComicReader } from './ComicReader'

interface ReaderState {
  detail: ComicDetail
  images: string[]
}

export function ComicsView(): JSX.Element {
  const [sources, setSources] = useState<ComicSourceInfo[]>([])
  const [sourceId, setSourceId] = useState('')
  const [order, setOrder] = useState('')
  const [queryInput, setQueryInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')

  const [items, setItems] = useState<ComicSummary[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [opening, setOpening] = useState(false)
  const [reader, setReader] = useState<ReaderState | null>(null)

  const reqId = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const src = sources.find((s) => s.id === sourceId)

  useEffect(() => {
    void window.peachwhip.comics.sources().then((list) => {
      setSources(list)
      if (list.length) {
        setSourceId(list[0].id)
        setOrder(list[0].defaultOrder)
      }
    })
  }, [])

  const load = useCallback(
    async (opts: { page: number; append: boolean }) => {
      if (!sourceId || !order) return
      const mine = ++reqId.current
      setLoading(true)
      setError(null)
      try {
        const feed = activeQuery
          ? await window.peachwhip.comics.search(sourceId, { query: activeQuery, order, page: opts.page })
          : await window.peachwhip.comics.browse(sourceId, { order, page: opts.page })
        if (mine !== reqId.current) return
        setItems((prev) => (opts.append ? [...prev, ...feed.items] : feed.items))
        setPage(feed.page)
        setHasMore(feed.hasMore)
      } catch (e) {
        if (mine !== reqId.current) return
        setError((e as Error).message || 'Something went wrong')
        if (!opts.append) setItems([])
      } finally {
        if (mine === reqId.current) setLoading(false)
      }
    },
    [sourceId, order, activeQuery]
  )

  useEffect(() => {
    if (sourceId && order) void load({ page: 1, append: false })
  }, [sourceId, order, activeQuery, load])

  const loadMore = useCallback((): void => {
    if (loading || !hasMore) return
    void load({ page: page + 1, append: true })
  }, [loading, hasMore, page, load])

  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current()
      },
      { root: scrollRef.current, rootMargin: '800px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, items.length])

  const openComic = async (summary: ComicSummary): Promise<void> => {
    setOpening(true)
    setError(null)
    try {
      const detail = await window.peachwhip.comics.detail(summary.source, summary.id)
      const chapter = detail.chapters[0]
      const images = await window.peachwhip.comics.images(summary.source, summary.id, chapter.id)
      setReader({ detail, images })
    } catch (e) {
      setError((e as Error).message || 'Could not open comic')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="comics">
      <div className="comics-bar">
        {sources.length > 1 &&
          sources.map((s) => (
            <button
              key={s.id}
              className={`tab ${s.id === sourceId ? 'active' : ''}`}
              onClick={() => {
                setSourceId(s.id)
                setOrder(s.defaultOrder)
                setQueryInput('')
                setActiveQuery('')
                setItems([])
              }}
            >
              {s.label}
            </button>
          ))}
        {src && (
          <select className="select" value={order} onChange={(e) => setOrder(e.target.value)}>
            {src.orders.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <div className="search">
          <input
            placeholder="Search comics…"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setActiveQuery(queryInput.trim())}
          />
          <button className="go" onClick={() => setActiveQuery(queryInput.trim())}>
            Search
          </button>
        </div>
      </div>

      <div className="comics-scroll" ref={scrollRef}>
        {error && items.length === 0 ? (
          <div className="center error">
            <div>
              <p>⚠️ {error}</p>
              <button className="loadmore" onClick={() => load({ page: 1, append: false })}>
                Retry
              </button>
            </div>
          </div>
        ) : items.length === 0 && loading ? (
          <div className="center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="center">No results.</div>
        ) : (
          <>
            <div className="comic-grid">
              {items.map((c) => (
                <button key={`${c.source}:${c.id}`} className="comic-card" onClick={() => openComic(c)}>
                  <div className="comic-cover">
                    <img src={c.cover} loading="lazy" alt="" draggable={false} />
                    {c.pageCount != null && <span className="badge dur">{c.pageCount}p</span>}
                    {c.language && <span className="badge audio">{c.language}</span>}
                  </div>
                  <div className="comic-title">{c.title}</div>
                </button>
              ))}
            </div>
            {hasMore && <div ref={sentinelRef} className="sentinel" />}
            {hasMore && loading && <div className="loading-more">Loading more…</div>}
          </>
        )}
      </div>

      {opening && <div className="opening-overlay">Opening…</div>}
      {reader && (
        <ComicReader detail={reader.detail} images={reader.images} onClose={() => setReader(null)} />
      )}
    </div>
  )
}
