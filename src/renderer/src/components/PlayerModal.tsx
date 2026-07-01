import { useEffect, useRef } from 'react'
import Hls from 'hls.js'
import type { MediaItem } from '@shared/types'

/** Attach a stream to a <video>, using hls.js for .m3u8 where the browser can't. */
function useVideoSource(item: MediaItem): React.RefObject<HTMLVideoElement> {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video || item.kind !== 'video' || !item.streamUrl) return
    const url = item.streamUrl

    const isHls = /\.m3u8($|\?)/i.test(url)
    if (isHls && !video.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true })
      hls.loadSource(url)
      hls.attachMedia(video)
      return () => hls.destroy()
    }

    video.src = url
    return () => {
      video.removeAttribute('src')
      video.load()
    }
  }, [item])

  return ref
}

export function PlayerModal({
  item,
  onClose,
  isFav,
  onToggleFav
}: {
  item: MediaItem
  onClose: () => void
  isFav: boolean
  onToggleFav: (item: MediaItem) => void
}): JSX.Element {
  const videoRef = useVideoSource(item)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const hasStream = item.kind === 'video' && item.streamUrl
  const hasEmbed = item.kind === 'video' && !item.streamUrl && item.embedUrl

  return (
    <div className="overlay" onClick={onClose}>
      <button className="close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="player" onClick={(e) => e.stopPropagation()}>
        {hasStream ? (
          <video ref={videoRef} poster={item.poster} controls autoPlay loop playsInline />
        ) : hasEmbed ? (
          <iframe
            className="embed"
            src={item.embedUrl}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        ) : (
          (item.imageUrl || item.thumbnail) && (
            <img src={item.imageUrl || item.thumbnail} alt={item.title} />
          )
        )}
        <div className="player-info">
          <button
            className={`fav-inline ${isFav ? 'on' : ''}`}
            onClick={() => onToggleFav(item)}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFav ? '♥' : '♡'}
          </button>
          <span>{item.title}</span>
          {item.author && <span>· @{item.author}</span>}
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              onClick={(e) => {
                e.preventDefault()
                void window.peachwhip.app.openExternal(item.sourceUrl as string)
              }}
            >
              open on {item.source} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
