import { useRef, useState } from 'react'
import type { MediaItem } from '@shared/types'
import { usePref } from '../prefs'

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
    </div>
  )
}
