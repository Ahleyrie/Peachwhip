import { useCallback, useEffect, useState } from 'react'
import type { MediaItem } from '@shared/types'
import { MediaGrid } from './MediaGrid'
import { clearList, getList } from '../lists'

type Tab = 'pies' | 'history' | 'watchlater'

/** The "Pies" area: favorites, history, and watch-later, with a filter. */
export function FavoritesView({
  onOpen,
  favKeys,
  onToggleFav
}: {
  onOpen: (item: MediaItem) => void
  favKeys: Set<string>
  onToggleFav: (item: MediaItem) => void
}): JSX.Element {
  const [tab, setTab] = useState<Tab>('pies')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<MediaItem[]>([])

  const reload = useCallback(() => {
    if (tab === 'pies') void window.peachwhip.favorites.list().then(setItems)
    else setItems(getList(tab))
  }, [tab])

  useEffect(() => {
    reload()
  }, [reload])

  const query = q.trim().toLowerCase()
  const filtered = query
    ? items.filter(
        (i) =>
          i.title?.toLowerCase().includes(query) ||
          i.author?.toLowerCase().includes(query) ||
          i.tags?.some((t) => t.toLowerCase().includes(query))
      )
    : items

  return (
    <div className="favview">
      <div className="fav-bar">
        <div className="tabs">
          <button className={`tab ${tab === 'pies' ? 'active' : ''}`} onClick={() => setTab('pies')}>
            ♥ Pies
          </button>
          <button
            className={`tab ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            🕑 History
          </button>
          <button
            className={`tab ${tab === 'watchlater' ? 'active' : ''}`}
            onClick={() => setTab('watchlater')}
          >
            ⌚ Watch later
          </button>
        </div>
        <div className="search">
          <input placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {tab !== 'pies' && (
          <button
            className="update-btn"
            onClick={() => {
              clearList(tab)
              reload()
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="fav-scroll">
        {filtered.length === 0 ? (
          <div className="center">
            {tab === 'pies'
              ? 'No pies yet — tap ♡ on anything to save it. 🍑'
              : tab === 'history'
                ? 'Nothing watched yet.'
                : 'Nothing queued.'}
          </div>
        ) : (
          <MediaGrid
            items={filtered}
            onOpen={onOpen}
            favKeys={favKeys}
            onToggleFav={(it) => {
              onToggleFav(it)
              if (tab === 'pies') setTimeout(reload, 60)
            }}
          />
        )}
      </div>
    </div>
  )
}
