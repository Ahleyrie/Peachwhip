import { useEffect } from 'react'
import type { MediaItem } from '@shared/types'

export function PlayerModal({
  item,
  onClose
}: {
  item: MediaItem
  onClose: () => void
}): JSX.Element {
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
          <video
            src={item.streamUrl}
            poster={item.poster}
            controls
            autoPlay
            loop
            playsInline
          />
        ) : (
          item.imageUrl && <img src={item.imageUrl} alt={item.title} />
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
