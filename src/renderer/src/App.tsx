import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaItem, SourceInfo } from '@shared/types'
import { MediaGrid } from './components/MediaGrid'
import { PlayerModal } from './components/PlayerModal'
import { UpdateButton } from './components/UpdateButton'

export function App(): JSX.Element {
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [order, setOrder] = useState<string>('')
  const [queryInput, setQueryInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')

  const [items, setItems] = useState<MediaItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [version, setVersion] = useState('')

  const active = sources.find((s) => s.id === activeId)
  // Guards against stale async responses overwriting a newer request.
  const reqId = useRef(0)

  useEffect(() => {
    void window.peachwhip.app.version().then(setVersion)
    void window.peachwhip.media.sources().then((list) => {
      setSources(list)
      if (list.length) {
        setActiveId(list[0].id)
        setOrder(list[0].defaultOrder)
      }
    })
  }, [])

  const load = useCallback(
    async (opts: { sourceId: string; order: string; query: string; page: number; append: boolean }) => {
      const mine = ++reqId.current
      setLoading(true)
      setError(null)
      try {
        const params = { query: opts.query, order: opts.order, page: opts.page }
        const feed = opts.query
          ? await window.peachwhip.media.search(opts.sourceId, params)
          : await window.peachwhip.media.browse(opts.sourceId, params)
        if (mine !== reqId.current) return // superseded
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
    []
  )

  // (Re)load the first page whenever source, order, or the active query changes.
  useEffect(() => {
    if (!activeId || !order) return
    void load({ sourceId: activeId, order, query: activeQuery, page: 1, append: false })
  }, [activeId, order, activeQuery, load])

  const onSearch = (): void => setActiveQuery(queryInput.trim())

  const onSelectSource = (s: SourceInfo): void => {
    setActiveId(s.id)
    setOrder(s.defaultOrder)
    setQueryInput('')
    setActiveQuery('')
  }

  const loadMore = (): void => {
    if (!activeId || loading || !hasMore) return
    void load({ sourceId: activeId, order, query: activeQuery, page: page + 1, append: true })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🍑 Peachwhip</div>

        <nav className="tabs">
          {sources.map((s) => (
            <button
              key={s.id}
              className={`tab ${s.id === activeId ? 'active' : ''}`}
              onClick={() => onSelectSource(s)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {active && (
          <select className="select" value={order} onChange={(e) => setOrder(e.target.value)}>
            {active.orders.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}

        {active?.searchable && (
          <div className="search">
            <input
              placeholder={`Search ${active.label}…`}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
            <button className="go" onClick={onSearch}>
              Search
            </button>
          </div>
        )}

        <div className="spacer" />

        <div className="meta">
          <UpdateButton />
          <span>v{version}</span>
        </div>
      </header>

      <main className="content">
        {error && items.length === 0 ? (
          <div className="center error">
            <div>
              <p>⚠️ {error}</p>
              <button
                className="loadmore"
                onClick={() =>
                  load({ sourceId: activeId, order, query: activeQuery, page: 1, append: false })
                }
              >
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
            <MediaGrid items={items} onOpen={setSelected} />
            {hasMore && (
              <button className="loadmore" onClick={loadMore} disabled={loading}>
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </main>

      {selected && <PlayerModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
