import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComicChapter, ComicDetail } from '@shared/types'
import { ComicPage } from './ComicPage'
import { getPref, setPref, usePref } from '../prefs'

/** Full-screen comic reader: continuous or paged, RTL, fit modes, resume, brightness. */
export function ComicReader({
  detail,
  chapters,
  chapterId,
  images,
  onClose,
  onChangeChapter
}: {
  detail: ComicDetail
  chapters: ComicChapter[]
  chapterId: string
  images: string[]
  onClose: () => void
  onChangeChapter?: (id: string) => void
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = usePref<'continuous' | 'paged'>('readerMode', 'continuous')
  const [rtl, setRtl] = usePref('readerRTL', false)
  const [fit, setFit] = usePref<'width' | 'height' | 'original'>('readerFit', 'width')
  const [brightness, setBrightness] = usePref('readerBrightness', 100)
  const [autoScroll, setAutoScroll] = useState(false)

  const posKey = `comicpage.${detail.source}.${detail.id}.${chapterId}`
  const [page, setPage] = useState(() => {
    const saved = getPref(posKey, 0)
    return saved > 0 && saved < images.length ? saved : 0
  })
  const [current, setCurrent] = useState(page + 1)

  const chapIndex = chapters.findIndex((c) => c.id === chapterId)

  // Persist reading position.
  useEffect(() => {
    setPref(posKey, mode === 'paged' ? page : current - 1)
  }, [page, current, mode, posKey])

  // Restore scroll position in continuous mode.
  useEffect(() => {
    if (mode !== 'continuous') return
    const el = scrollRef.current
    if (!el) return
    const target = el.querySelectorAll('.reader-scroll > *')[page] as HTMLElement | undefined
    if (target) el.scrollTop = target.offsetTop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const onScroll = (): void => {
    const el = scrollRef.current
    if (!el || !images.length) return
    const frac = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)
    setCurrent(Math.min(images.length, Math.max(1, Math.round(frac * (images.length - 1)) + 1)))
  }

  const go = useCallback(
    (delta: number): void => {
      setPage((p) => Math.min(images.length - 1, Math.max(0, p + delta)))
    },
    [images.length]
  )

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') return onClose()
      if (e.key === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void rootRef.current?.requestFullscreen()
        return
      }
      if (mode === 'paged') {
        if (e.key === 'ArrowRight') go(rtl ? -1 : 1)
        else if (e.key === 'ArrowLeft') go(rtl ? 1 : -1)
        else if (e.key === ' ') {
          e.preventDefault()
          go(1)
        }
      } else {
        const el = scrollRef.current
        if (!el) return
        if (e.key === ' ' || e.key === 'PageDown') {
          e.preventDefault()
          el.scrollBy({ top: el.clientHeight * 0.9 })
        } else if (e.key === 'PageUp') {
          el.scrollBy({ top: -el.clientHeight * 0.9 })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, rtl, go, onClose])

  // Auto-scroll (continuous).
  useEffect(() => {
    if (!autoScroll || mode !== 'continuous') return
    const el = scrollRef.current
    if (!el) return
    const t = setInterval(() => el.scrollBy({ top: 1 }), 16)
    return () => clearInterval(t)
  }, [autoScroll, mode])

  const fitClass = `fit-${fit}`
  const shownCurrent = mode === 'paged' ? page + 1 : current

  return (
    <div className="reader" ref={rootRef}>
      <div className="reader-bar">
        <button className="reader-close" onClick={onClose}>
          ← Back
        </button>
        <span className="reader-title">{detail.title}</span>

        {chapters.length > 1 && (
          <>
            <button className="reader-btn" disabled={chapIndex <= 0} onClick={() => onChangeChapter?.(chapters[chapIndex - 1].id)}>
              ‹ Ch
            </button>
            <select
              className="reader-select"
              value={chapterId}
              onChange={(e) => onChangeChapter?.(e.target.value)}
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              className="reader-btn"
              disabled={chapIndex >= chapters.length - 1}
              onClick={() => onChangeChapter?.(chapters[chapIndex + 1].id)}
            >
              Ch ›
            </button>
          </>
        )}

        <select className="reader-select" value={mode} onChange={(e) => setMode(e.target.value as 'continuous' | 'paged')}>
          <option value="continuous">Scroll</option>
          <option value="paged">Paged</option>
        </select>
        <select className="reader-select" value={fit} onChange={(e) => setFit(e.target.value as 'width' | 'height' | 'original')}>
          <option value="width">Fit width</option>
          <option value="height">Fit height</option>
          <option value="original">Original</option>
        </select>
        {mode === 'paged' && (
          <button className={`reader-btn ${rtl ? 'on' : ''}`} onClick={() => setRtl(!rtl)} title="Right-to-left">
            RTL
          </button>
        )}
        {mode === 'continuous' && (
          <button className={`reader-btn ${autoScroll ? 'on' : ''}`} onClick={() => setAutoScroll((a) => !a)}>
            Auto
          </button>
        )}
        <span className="reader-dim" title="Brightness">
          ☀
          <input
            type="range"
            min={20}
            max={100}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
          />
        </span>
        <span className="reader-count">
          <input
            className="reader-jump"
            type="number"
            min={1}
            max={images.length}
            value={shownCurrent}
            onChange={(e) => {
              const n = Math.min(images.length, Math.max(1, Number(e.target.value)))
              if (mode === 'paged') setPage(n - 1)
              else {
                const el = scrollRef.current
                const target = el?.querySelectorAll('.reader-scroll > *')[n - 1] as HTMLElement | undefined
                if (el && target) el.scrollTop = target.offsetTop
              }
            }}
          />
          / {images.length}
        </span>
      </div>

      {mode === 'continuous' ? (
        <div className={`reader-scroll ${fitClass}`} ref={scrollRef} onScroll={onScroll}>
          {images.map((src, i) => (
            <ComicPage key={i} src={src} />
          ))}
        </div>
      ) : (
        <div
          className={`reader-paged ${fitClass}`}
          onClick={(e) => {
            const half = (e.currentTarget as HTMLElement).clientWidth / 2
            const left = e.clientX < (e.currentTarget as HTMLElement).getBoundingClientRect().left + half
            go(left ? (rtl ? 1 : -1) : rtl ? -1 : 1)
          }}
        >
          <ComicPage key={page} src={images[page]} />
        </div>
      )}

      <div className="reader-progress">
        <div style={{ width: `${(shownCurrent / Math.max(1, images.length)) * 100}%` }} />
      </div>
      {brightness < 100 && (
        <div className="reader-brightness" style={{ opacity: (100 - brightness) / 100 }} />
      )}
    </div>
  )
}
