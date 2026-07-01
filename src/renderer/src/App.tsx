import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaItem, SourceInfo } from '@shared/types'
import { MediaGrid } from './components/MediaGrid'
import { PlayerModal } from './components/PlayerModal'
import { UpdateButton } from './components/UpdateButton'
import { RedditLogin } from './components/RedditLogin'
import logo from './assets/logo.png'

const FAV_TAB = '__favorites__'

export function App(): JSX.Element {
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [order, setOrder] = useState<string>('')
  const [queryInput, setQueryInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')

  const [items, setItems] = useState<MediaItem[]>([])
  const [page, setPage] = useState(1)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [redditLoggedIn, setRedditLoggedIn] = useState<boolean | null>(null)
  const [favKeys, setFavKeys] = useState<Set<string>>(new Set())

  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [version, setVersion] = useState('')

  const active = sources.find((s) => s.id === activeId)
  const isReddit = active?.id === 'reddit'
  const isFavView = activeId === FAV_TAB
  const reqId = useRef(0)
  const contentRef = useRef<HTMLElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void window.peachwhip.app.version().then(setVersion)
    void window.peachwhip.favorites.keys().then((keys) => setFavKeys(new Set(keys)))
    void window.peachwhip.media.sources().then((list) => {
      setSources(list)
      if (list.length) {
        setActiveId(list[0].id)
        setOrder(list[0].defaultOrder)
      }
    })
  }, [])

  useEffect(() => {
    if (!isReddit) return
    let cancelled = false
    setRedditLoggedIn(null)
    void window.peachwhip.reddit.isLoggedIn().then((ok) => {
      if (!cancelled) setRedditLoggedIn(ok)
    })
    return () => {
      cancelled = true
    }
  }, [isReddit])

  const load = useCallback(
    async (opts: {
      sourceId: string
      order: string
      query: string
      page: number
      cursor?: string
      append: boolean
    }) => {
      const mine = ++reqId.current
      setLoading(true)
      setError(null)
      try {
        const params = { query: opts.query, order: opts.order, page: opts.page, cursor: opts.cursor }
        const feed = opts.query
          ? await window.peachwhip.media.search(opts.sourceId, params)
          : await window.peachwhip.media.browse(opts.sourceId, params)
        if (mine !== reqId.current) return
        setItems((prev) => (opts.append ? [...prev, ...feed.items] : feed.items))
        setPage(feed.page)
        setNextCursor(feed.nextCursor)
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

  // Favorites view: load from local store, no network.
  useEffect(() => {
    if (!isFavView) return
    reqId.current++
    setError(null)
    setHasMore(false)
    setLoading(true)
    void window.peachwhip.favorites.list().then((list) => {
      setItems(list)
      setLoading(false)
    })
  }, [isFavView])

  // Network sources: (re)load first page on source/order/query change (Reddit waits for login).
  useEffect(() => {
    if (isFavView || !activeId || !order) return
    if (isReddit && redditLoggedIn !== true) return
    void load({ sourceId: activeId, order, query: activeQuery, page: 1, append: false })
  }, [activeId, order, activeQuery, isReddit, redditLoggedIn, isFavView, load])

  const loadMore = useCallback((): void => {
    if (isFavView || !activeId || loading || !hasMore) return
    void load({
      sourceId: activeId,
      order,
      query: activeQuery,
      page: page + 1,
      cursor: nextCursor,
      append: true
    })
  }, [isFavView, activeId, loading, hasMore, order, activeQuery, page, nextCursor, load])

  // Infinite scroll: observe a sentinel near the bottom of the content area.
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current()
      },
      { root: contentRef.current, rootMargin: '800px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, items.length])

  const onSearch = (): void => setActiveQuery(queryInput.trim())

  const onSelectSource = (id: string, defaultOrder?: string): void => {
    setActiveId(id)
    if (defaultOrder) setOrder(defaultOrder)
    setQueryInput('')
    setActiveQuery('')
    setItems([])
  }

  const toggleFav = async (item: MediaItem): Promise<void> => {
    const k = `${item.source}:${item.id}`
    const next = new Set(favKeys)
    if (next.has(k)) {
      await window.peachwhip.favorites.remove(item.source, item.id)
      next.delete(k)
      if (isFavView) setItems((prev) => prev.filter((i) => `${i.source}:${i.id}` !== k))
    } else {
      await window.peachwhip.favorites.add(item)
      next.add(k)
    }
    setFavKeys(next)
  }

  const logoutReddit = async (): Promise<void> => {
    await window.peachwhip.reddit.logout()
    setItems([])
    setRedditLoggedIn(false)
  }

  const retry = (): void =>
    void load({ sourceId: activeId, order, query: activeQuery, page: 1, append: false })

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="" />
          <span className="brand-name">Peachwhip</span>
        </div>

        <nav className="tabs">
          {sources.map((s) => (
            <button
              key={s.id}
              className={`tab ${s.id === activeId ? 'active' : ''}`}
              onClick={() => onSelectSource(s.id, s.defaultOrder)}
            >
              {s.label}
            </button>
          ))}
          <button
            className={`tab ${isFavView ? 'active' : ''}`}
            onClick={() => onSelectSource(FAV_TAB)}
          >
            ♥ Favorites
          </button>
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
              placeholder={
                isReddit ? 'Subreddit name, or a phrase to search…' : `Search ${active.label}…`
              }
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
          {isReddit && redditLoggedIn && (
            <button className="update-btn" onClick={logoutReddit}>
              Reddit: log out
            </button>
          )}
          <UpdateButton />
          <span>v{version}</span>
        </div>
      </header>

      <main className="content" ref={contentRef}>
        {isReddit && redditLoggedIn === false ? (
          <RedditLogin onLoggedIn={() => setRedditLoggedIn(true)} />
        ) : isReddit && redditLoggedIn === null ? (
          <div className="center">Checking Reddit login…</div>
        ) : error && items.length === 0 ? (
          <div className="center error">
            <div>
              <p>⚠️ {error}</p>
              <button className="loadmore" onClick={retry}>
                Retry
              </button>
            </div>
          </div>
        ) : items.length === 0 && loading ? (
          <div className="center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="center">
            {isFavView ? 'No favorites yet — tap ♡ on anything to save it.' : 'No results.'}
          </div>
        ) : (
          <>
            <MediaGrid items={items} onOpen={setSelected} favKeys={favKeys} onToggleFav={toggleFav} />
            {hasMore && <div ref={sentinelRef} className="sentinel" />}
            {hasMore && loading && <div className="loading-more">Loading more…</div>}
          </>
        )}
      </main>

      {selected && (
        <PlayerModal
          item={selected}
          onClose={() => setSelected(null)}
          isFav={favKeys.has(`${selected.source}:${selected.id}`)}
          onToggleFav={toggleFav}
        />
      )}
    </div>
  )
}
