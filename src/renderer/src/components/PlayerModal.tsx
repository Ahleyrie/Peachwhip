import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import type { MediaItem } from '@shared/types'
import { getPref, setPref } from '../prefs'
import { openExternal } from '../util'

/** Attach a stream to a <video>, using hls.js for .m3u8 where the browser can't. */
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const [torrentUrl, setTorrentUrl] = useState<string | null>(null)
  const [torrentStatus, setTorrentStatus] = useState<string | null>(null)

  const hasStream = item.kind === 'video' && !!item.streamUrl
  const hasEmbed = item.kind === 'video' && !item.streamUrl && !!item.embedUrl
  const isTorrent = !!item.magnet && !hasStream && !hasEmbed

  const playUrl = hasStream ? item.streamUrl : torrentUrl || undefined
  const autoplay = getPref('autoplayOnOpen', true)

  useEffect(() => {
    const cleanup = attachVideo(videoRef.current, playUrl)
    const v = videoRef.current
    if (v) {
      v.muted = getPref('muteByDefault', false)
      if (getPref('rememberVolume', true)) v.volume = getPref('volume', 1)
    }
    return cleanup
  }, [playUrl])

  // Persist volume changes.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onVol = (): void => {
      if (getPref('rememberVolume', true)) setPref('volume', v.volume)
    }
    v.addEventListener('volumechange', onVol)
    return () => v.removeEventListener('volumechange', onVol)
  }, [playUrl])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Stop the torrent stream when the modal closes.
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

  return (
    <div className="overlay" onClick={onClose}>
      <button className="close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="player" onClick={(e) => e.stopPropagation()}>
        {playUrl ? (
          <video ref={videoRef} poster={item.poster} controls autoPlay={autoplay} loop playsInline />
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
