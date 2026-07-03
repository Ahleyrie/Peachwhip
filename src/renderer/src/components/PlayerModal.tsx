import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import type { MediaItem } from '@shared/types'
import { getPref, setPref } from '../prefs'
import { openExternal } from '../util'

function attachVideo(video: HTMLVideoElement | null, url: string | undefined): (() => void) | void {
  if (!video || !url) return
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
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

export function PlayerModal({
  item,
  onClose,
  isFav,
  onToggleFav,
  onNext,
  onPrev
}: {
  item: MediaItem
  onClose: () => void
  isFav: boolean
  onToggleFav: (item: MediaItem) => void
  onNext?: () => void
  onPrev?: () => void
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [torrentUrl, setTorrentUrl] = useState<string | null>(null)
  const [torrentStatus, setTorrentStatus] = useState<string | null>(null)
  const [speed, setSpeed] = useState(() => getPref('playbackRate', 1))
  const [loop, setLoop] = useState(() => getPref('loopVideo', false))
  const [rotate, setRotate] = useState(0)
  const [mirror, setMirror] = useState(false)

  const hasStream = item.kind === 'video' && !!item.streamUrl
  const hasEmbed = item.kind === 'video' && !item.streamUrl && !!item.embedUrl
  const isTorrent = !!item.magnet && !hasStream && !hasEmbed
  const playUrl = hasStream ? item.streamUrl : torrentUrl || undefined
  const autoplay = getPref('autoplayOnOpen', true)
  const posKey = `pos.${item.source}.${item.id}`

  useEffect(() => {
    const cleanup = attachVideo(videoRef.current, playUrl)
    const v = videoRef.current
    if (v) {
      v.muted = getPref('muteByDefault', false)
      if (getPref('rememberVolume', true)) v.volume = getPref('volume', 1)
      v.playbackRate = getPref('playbackRate', 1)
    }
    return cleanup
  }, [playUrl])

  // Persist volume, remember playback position, and auto-advance.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onVol = (): void => {
      if (getPref('rememberVolume', true)) setPref('volume', v.volume)
    }
    let last = 0
    const onTime = (): void => {
      if (v.currentTime - last > 4) {
        last = v.currentTime
        if (v.duration && v.currentTime < v.duration * 0.95) setPref(posKey, v.currentTime)
        else setPref(posKey, 0)
      }
    }
    const onLoaded = (): void => {
      const saved = getPref(posKey, 0)
      if (saved > 5 && v.duration && saved < v.duration * 0.95) v.currentTime = saved
    }
    const onEnded = (): void => {
      if (!loop && getPref('autoAdvance', false) && onNext) onNext()
    }
    v.addEventListener('volumechange', onVol)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onLoaded)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('volumechange', onVol)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onLoaded)
      v.removeEventListener('ended', onEnded)
    }
  }, [playUrl, loop, onNext, posKey])

  useEffect(() => {
    const v = videoRef.current
    if (v) v.playbackRate = speed
    setPref('playbackRate', speed)
  }, [speed, playUrl])

  useEffect(() => {
    setPref('loopVideo', loop)
  }, [loop])

  // Keyboard shortcuts + media keys.
  useEffect(() => {
    const v = (): HTMLVideoElement | null => videoRef.current
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') return onClose()
      const vid = v()
      if (e.key === 'n') return onNext?.()
      if (e.key === 'p') return onPrev?.()
      if (!vid) return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          vid.paused ? void vid.play() : vid.pause()
          break
        case 'ArrowRight':
          vid.currentTime += e.shiftKey ? 1 : 5
          break
        case 'ArrowLeft':
          vid.currentTime -= e.shiftKey ? 1 : 5
          break
        case 'ArrowUp':
          vid.volume = Math.min(1, vid.volume + 0.1)
          break
        case 'ArrowDown':
          vid.volume = Math.max(0, vid.volume - 0.1)
          break
        case 'm':
          vid.muted = !vid.muted
          break
        case 'f':
          if (document.fullscreenElement) void document.exitFullscreen()
          else void vid.requestFullscreen()
          break
        case '.':
          vid.pause()
          vid.currentTime += 1 / 30
          break
        case ',':
          vid.pause()
          vid.currentTime -= 1 / 30
          break
        case ']':
          setSpeed((s) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(s) + 1)] || s)
          break
        case '[':
          setSpeed((s) => SPEEDS[Math.max(0, SPEEDS.indexOf(s) - 1)] || s)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('nexttrack', () => onNext?.())
      navigator.mediaSession.setActionHandler('previoustrack', () => onPrev?.())
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNext, onPrev])

  useEffect(() => {
    return () => {
      if (torrentUrl) void window.peachwhip.torrent?.stop()
    }
  }, [torrentUrl])

  const openMagnet = (): void => {
    if (item.magnet) openExternal(item.magnet)
  }

  const streamTorrent = async (): Promise<void> => {
    if (!item.magnet || !window.peachwhip.torrent) {
      setTorrentStatus('In-app streaming unavailable — use a torrent client.')
      return
    }
    setTorrentStatus('Connecting to peers…')
    try {
      const url = await window.peachwhip.torrent.stream(item.magnet)
      setTorrentUrl(url)
      setTorrentStatus(null)
    } catch (e) {
      setTorrentStatus('Could not stream: ' + ((e as Error).message || 'no seeds?'))
    }
  }

  const pip = (): void => {
    const v = videoRef.current
    if (v && document.pictureInPictureEnabled) void v.requestPictureInPicture().catch(() => {})
  }

  const screenshot = (): void => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    try {
      const c = document.createElement('canvas')
      c.width = v.videoWidth
      c.height = v.videoHeight
      c.getContext('2d')?.drawImage(v, 0, 0)
      c.toBlob((b) => {
        if (!b) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = `${item.id || 'frame'}.png`
        a.click()
        URL.revokeObjectURL(a.href)
      })
    } catch {
      setTorrentStatus('Screenshot blocked (protected stream).')
    }
  }

  const transform = `rotate(${rotate}deg) scaleX(${mirror ? -1 : 1})`

  return (
    <div className="overlay" onClick={onClose}>
      <button className="close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      {onPrev && (
        <button className="nav-arrow left" onClick={onPrev} aria-label="Previous">
          ‹
        </button>
      )}
      {onNext && (
        <button className="nav-arrow right" onClick={onNext} aria-label="Next">
          ›
        </button>
      )}
      <div className="player" onClick={(e) => e.stopPropagation()}>
        {playUrl ? (
          <video
            ref={videoRef}
            poster={item.poster}
            controls
            autoPlay={autoplay}
            loop={loop}
            playsInline
            style={{ transform }}
          />
        ) : hasEmbed ? (
          <iframe
            className="embed"
            src={item.embedUrl}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        ) : isTorrent ? (
          <div className="torrent-panel">
            <h3>{item.title}</h3>
            <div className="torrent-meta">{item.tags?.join(' · ')}</div>
            <div className="torrent-actions">
              <button className="setup-save" onClick={streamTorrent}>
                ▶ Stream in app
              </button>
              <button className="update-btn" onClick={openMagnet}>
                Open in torrent client
              </button>
            </div>
            {torrentStatus && <div className="torrent-status">{torrentStatus}</div>}
          </div>
        ) : (
          (item.imageUrl || item.thumbnail) && (
            <img src={item.imageUrl || item.thumbnail} alt={item.title} style={{ transform }} />
          )
        )}

        {(hasStream || torrentUrl) && (
          <div className="pcontrols">
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="Speed">
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
            <button className={loop ? 'on' : ''} onClick={() => setLoop((l) => !l)} title="Loop">
              🔁
            </button>
            <button onClick={() => setRotate((r) => (r + 90) % 360)} title="Rotate">
              ⟳
            </button>
            <button className={mirror ? 'on' : ''} onClick={() => setMirror((m) => !m)} title="Mirror">
              ⇋
            </button>
            <button onClick={pip} title="Picture-in-picture">
              ⧉
            </button>
            <button onClick={screenshot} title="Screenshot">
              📷
            </button>
          </div>
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
                openExternal(item.sourceUrl as string)
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
