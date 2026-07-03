import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '@shared/types'
import { usePref } from '../prefs'
import { addToList, inList, removeFromList } from '../lists'
import { openExternal } from '../util'
import { toast } from '../toast'

function formatDuration(sec?: number): string | null {
  if (!sec || sec <= 0) return null
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MediaCard({
  item,
  onOpen,
  isFav,
  onToggleFav
}: {
  item: MediaItem
  onOpen: (item: MediaItem) => void
  isFav: boolean
  onToggleFav: (item: MediaItem) => void
}): JSX.Element {
  const [hovering, setHovering] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [hoverPreview] = usePref('hoverPreview', true)
  const [dataSaver] = usePref('dataSaver', false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  // Reserve space using the item's aspect ratio so the masonry doesn't jump
  // while thumbnails load.
  const ratio = item.width && item.height ? `${item.width} / ${item.height}` : '3 / 4'
  const dur = formatDuration(item.duration)
  // Hover-preview only for progressive MP4s; HLS (.m3u8) can't play in a bare <video>.
  const canPreview =
    hoverPreview &&
    !dataSaver &&
    !!item.streamUrl &&
    !/\.m3u8($|\?)/i.test(item.streamUrl)

  return (
    <div
      className="card"
      onClick={() => onOpen(item)}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false)
        if (videoRef.current) videoRef.current.currentTime = 0
      }}
    >
      <div className="card-media" style={{ aspectRatio: ratio }}>
        {item.thumbnail && <img src={item.thumbnail} loading="lazy" alt="" draggable={false} />}
        {hovering && canPreview && (
          <video
            ref={videoRef}
            src={item.streamUrl}
            muted
            loop
            autoPlay
            playsInline
            preload="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        )}
        <button
          className={`fav ${isFav ? 'on' : ''}`}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFav(item)
          }}
        >
          {isFav ? '♥' : '♡'}
        </button>
        {dur && <span className="badge dur">{dur}</span>}
        {item.hasAudio && <span className="badge audio">🔊</span>}
      </div>
      <div className="card-info">
        <div className="card-title">{item.title}</div>
        <div className="card-sub">
          {item.author && <span>@{item.author}</span>}
          {typeof item.views === 'number' && <span>{item.views.toLocaleString()} views</span>}
          {!item.author &&
            !item.views &&
            item.tags?.slice(0, 2).map((t) => <span key={t}>{t}</span>)}
        </div>
      </div>

      {menu && (
        <div
          className="ctx-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onToggleFav(item)
              toast(isFav ? 'Removed from Pies' : 'Added to Pies 🍑')
              setMenu(null)
            }}
          >
            {isFav ? 'Remove from Pies' : 'Add to Pies'}
          </button>
          <button
            onClick={() => {
              const has = inList('watchlater', item)
              if (has) removeFromList('watchlater', item)
              else addToList('watchlater', item)
              toast(has ? 'Removed from Watch later' : 'Saved to Watch later')
              setMenu(null)
            }}
          >
            Watch later
          </button>
          {((item.streamUrl && !/\.m3u8($|\?)/i.test(item.streamUrl)) || item.imageUrl) && (
            <button
              onClick={() => {
                void window.peachwhip.downloads.start(item).catch((e) => toast('Download failed'))
                toast('Download started…')
                setMenu(null)
              }}
            >
              Download
            </button>
          )}
          <button
            onClick={() => {
              void navigator.clipboard.writeText(item.sourceUrl || item.streamUrl || '')
              toast('Link copied')
              setMenu(null)
            }}
          >
            Copy link
          </button>
          {item.sourceUrl && (
            <button
              onClick={() => {
                openExternal(item.sourceUrl as string)
                setMenu(null)
              }}
            >
              Open on {item.source} ↗
            </button>
          )}
        </div>
      )}
    </div>
  )
}
