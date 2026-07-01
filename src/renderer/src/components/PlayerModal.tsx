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
  onClose
}: {
  item: MediaItem
  onClose: () => void
}): JSX.Element {
  const videoRef = useVideoSource(item)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <button className="close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="player" onClick={(e) => e.stopPropagation()}>
        {item.kind === 'video' && item.streamUrl ? (
          <video ref={videoRef} poster={item.poster} controls autoPlay loop playsInline />
        ) : (
          (item.imageUrl || item.thumbnail) && (
            <img src={item.imageUrl || item.thumbnail} alt={item.title} />
          )
        )}
        <div className="player-info">
          <span>{item.title}</span>
          {item.author && <span>· @{item.author}</span>}
          {item.sourceUrl && (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer">
              open on {item.source} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
