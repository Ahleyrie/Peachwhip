import { useEffect, useRef, useState } from 'react'
import type { ComicDetail } from '@shared/types'

/** Full-screen continuous (webtoon-style) reader. Esc closes. */
export function ComicReader({
  detail,
  images,
  onClose
}: {
  detail: ComicDetail
  images: string[]
  onClose: () => void
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onScroll = (): void => {
    const el = scrollRef.current
    if (!el || images.length === 0) return
    const frac = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)
    setCurrent(Math.min(images.length, Math.max(1, Math.round(frac * (images.length - 1)) + 1)))
  }

  return (
    <div className="reader">
      <div className="reader-bar">
        <button className="reader-close" onClick={onClose} aria-label="Back">
          ← Back
        </button>
        <span className="reader-title">{detail.title}</span>
        <span className="reader-count">
          {current} / {images.length}
        </span>
      </div>
      <div className="reader-scroll" ref={scrollRef} onScroll={onScroll}>
        {images.map((src, i) => (
          <img key={i} src={src} loading="lazy" alt={`Page ${i + 1}`} draggable={false} />
        ))}
      </div>
    </div>
  )
}
