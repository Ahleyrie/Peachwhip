import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaItem, SourceInfo } from '@shared/types'
import { MediaGrid } from './components/MediaGrid'
import { PlayerModal } from './components/PlayerModal'
import { UpdateButton } from './components/UpdateButton'
import { RedditLogin } from './components/RedditLogin'
import { ComicsView } from './components/ComicsView'
import { IndexView } from './components/IndexView'
import { ThemeApplier } from './components/ThemeApplier'
import { SettingsModal } from './components/SettingsModal'
import { FavoritesView } from './components/FavoritesView'
import { LockGate } from './components/LockGate'
import { Toasts } from './components/Toasts'
import { CmdPalette } from './components/CmdPalette'
import { Onboarding } from './components/Onboarding'
import { Skeleton } from './components/Skeleton'
import { toast } from './toast'
import { getPref, setPref, usePref } from './prefs'
import { addToList, getSeen, markSeen } from './lists'
import logo from './assets/logo.png'

const FAV_TAB = '__favorites__'
const COMICS_TAB = '__comics__'
const INDEX_TAB = '__index__'

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
  const [showSettings, setShowSettings] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [sortBy, setSortBy] = useState('default')
  const [recents, setRecents] = usePref<string[]>('recentSearches', [])
  const [disabledSources] = usePref<string[]>('disabledSources', [])
  const visibleSources = sources.filter((s) => !disabledSources.includes(s.id))

  const active = sources.find((s) => s.id === activeId)
  const isReddit = active?.id === 'reddit'
  const isFavView = activeId === FAV_TAB
  const isComics = activeId === COMICS_TAB
  const isIndex = activeId === INDEX_TAB
  const reqId = useRef(0)
  const contentRef = useRef<HTMLElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void window.peachwhip.app.version().then(setVersion)
    void window.peachwhip.favorites.keys().then((keys) => setFavKeys(new Set(keys)))
    void window.peachwhip.media.sources().then((list) => {
      setSources(list)
      const special = [COMICS_TAB, FAV_TAB, INDEX_TAB]
      const last = getPref('rememberLastTab', true) ? getPref('lastTab', '') : ''
      if (last && (special.includes(last) || list.some((s) => s.id === last))) {
        setActiveId(last)
        const src = list.find((s) => s.id === last)
        setOrder(src ? src.defaultOrder : '')
      } else if (list.length) {
        setActiveId(list[0].id)
        setOrder(list[0].defaultOrder)
      }
    })
  }, [])

  // Persist the last-open tab.
  useEffect(() => {
    if (activeId && getPref('rememberLastTab', true)) setPref('lastTab', activeId)
  }, [activeId])

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
        let incoming = feed.items
        if (getPref('hideSeen', false)) {
          const seen = getSeen()
          incoming = incoming.filter((i) => !seen.has(`${i.source}:${i.id}`))
        }
        setItems((prev) => (opts.append ? [...prev, ...incoming] : incoming))
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

  const openItem = (item: MediaItem): void => {
    setSelected(item)
    if (!getPref('incognito', false)) {
      addToList('history', item)
      markSeen(`${item.source}:${item.id}`)
    }
  }

  const openRandom = (): void => {
    if (items.length) openItem(items[Math.floor(Math.random() * items.length)])
  }

  // Toast when a download finishes.
  useEffect(() => {
    return window.peachwhip.downloads.onDone((p) => toast(`Downloaded: ${p.title}`))
  }, [])

  // Command palette hotkey.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Blur the app when it loses focus (privacy).
  useEffect(() => {
    const onBlur = (): void => {
      if (getPref('blurOnBlur', false)) document.documentElement.classList.add('blurred')
    }
    const onFocus = (): void => document.documentElement.classList.remove('blurred')
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Network sources: (re)load first page on source/order/query change (Reddit waits for login).
  useEffect(() => {
    if (isFavView || isComics || isIndex || !activeId || !order) return
    if (isReddit && redditLoggedIn !== true) return
    void load({ sourceId: activeId, order, query: activeQuery, page: 1, append: false })
  }, [activeId, order, activeQuery, isReddit, redditLoggedIn, isFavView, isComics, isIndex, load])

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

  const onSearch = (): void => {
    const q = queryInput.trim()
    setActiveQuery(q)
    if (q) setRecents([q, ...recents.filter((r) => r !== q)].slice(0, 12))
  }

  const displayed = useMemo(() => {
    if (sortBy === 'default') return items
    const arr = [...items]
    if (sortBy === 'views') arr.sort((a, b) => (b.views || 0) - (a.views || 0))
    else if (sortBy === 'duration') arr.sort((a, b) => (b.duration || 0) - (a.duration || 0))
    else if (sortBy === 'title') arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    return arr
  }, [items, sortBy])

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
      toast('Removed from Pies')
      if (isFavView) setItems((prev) => prev.filter((i) => `${i.source}:${i.id}` !== k))
    } else {
      await window.peachwhip.favorites.add(item)
      next.add(k)
      toast('Added to Pies 🍑')
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
      <ThemeApplier />
      <LockGate />
      <Onboarding />
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="" />
          <span className="brand-name">Peachwhip</span>
        </div>

        <nav className="tabs">
          {visibleSources.map((s) => (
            <button
              key={s.id}
              className={`tab ${s.id === activeId ? 'active' : ''}`}
              onClick={() => onSelectSource(s.id, s.defaultOrder)}
            >
              {s.label}
            </button>
          ))}
          <button
            className={`tab ${isComics ? 'active' : ''}`}
            onClick={() => onSelectSource(COMICS_TAB)}
          >
            📖 Comics
          </button>
          <button
            className={`tab ${isIndex ? 'active' : ''}`}
            onClick={() => onSelectSource(INDEX_TAB)}
          >
            🧭 Index
          </button>
          <button
            className={`tab ${isFavView ? 'active' : ''}`}
            onClick={() => onSelectSource(FAV_TAB)}
          >
            ♥ Pies
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

        {active && (
          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="default">Sort: default</option>
            <option value="views">Most viewed</option>
            <option value="duration">Longest</option>
            <option value="title">A–Z</option>
          </select>
        )}

        {active?.searchable && (
          <div className="search">
            <input
              list="pw-recents"
              placeholder={
                isReddit ? 'Subreddit name, or a phrase to search…' : `Search ${active.label}…`
              }
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
            <datalist id="pw-recents">
              {recents.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
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
          <button className="update-btn" onClick={openRandom} title="Surprise me">
            🎲
          </button>
          <UpdateButton />
          <button className="update-btn" onClick={() => setShowSettings(true)} title="Settings">
            ⚙
          </button>
          <span>v{version}</span>
        </div>
      </header>

      {isComics ? (
        <ComicsView />
      ) : isIndex ? (
        <IndexView />
      ) : isFavView ? (
        <FavoritesView onOpen={openItem} favKeys={favKeys} onToggleFav={toggleFav} />
      ) : (
        <main
          className="content"
          ref={contentRef}
          onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 700)}
        >
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
          <Skeleton />
        ) : items.length === 0 ? (
          <div className="center">
            {isFavView ? 'No favorites yet — tap ♡ on anything to save it.' : 'No results.'}
          </div>
        ) : (
          <>
            <MediaGrid items={displayed} onOpen={openItem} favKeys={favKeys} onToggleFav={toggleFav} />
            {hasMore && <div ref={sentinelRef} className="sentinel" />}
            {hasMore && loading && <div className="loading-more">Loading more…</div>}
          </>
        )}
        </main>
      )}

      {selected &&
        (() => {
          const selKey = `${selected.source}:${selected.id}`
          const idx = displayed.findIndex((i) => `${i.source}:${i.id}` === selKey)
          return (
            <PlayerModal
              item={selected}
              onClose={() => setSelected(null)}
              isFav={favKeys.has(selKey)}
              onToggleFav={toggleFav}
              onNext={
                idx >= 0 && idx < displayed.length - 1 ? () => setSelected(displayed[idx + 1]) : undefined
              }
              onPrev={idx > 0 ? () => setSelected(displayed[idx - 1]) : undefined}
            />
          )
        })()}

      {showSettings && (
        <SettingsModal
          sources={sources}
          version={version}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showTop && !isComics && !isIndex && !isFavView && (
        <button
          className="backtop"
          title="Back to top"
          onClick={() => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
      )}

      {showPalette && (
        <CmdPalette
          tabs={[
            ...visibleSources.map((s) => ({ id: s.id, label: s.label })),
            { id: COMICS_TAB, label: 'Comics' },
            { id: INDEX_TAB, label: 'Index' },
            { id: FAV_TAB, label: 'Pies' }
          ]}
          onGo={(id) => {
            const s = sources.find((x) => x.id === id)
            onSelectSource(id, s?.defaultOrder)
          }}
          onSearchActive={(query) => {
            setQueryInput(query)
            setActiveQuery(query)
          }}
          onClose={() => setShowPalette(false)}
        />
      )}

      <Toasts />
    </div>
  )
}
