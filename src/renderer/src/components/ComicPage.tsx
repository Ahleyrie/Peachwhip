import { useEffect, useRef, useState } from 'react'

/**
 * A single reader page. Most sources are plain images. JMComic scrambles some
 * pages into N vertical strips (signalled by a `#pw_scramble=N` fragment on the
 * URL); those are reassembled on a canvas. Requires the CDN to send permissive
 * CORS (added in the main process) so the canvas isn't tainted.
 */
export function ComicPage({ src }: { src: string }): JSX.Element {
  const m = src.match(/#pw_scramble=(\d+)$/)
  const num = m ? parseInt(m[1], 10) : 1
  const url = m ? src.replace(/#pw_scramble=\d+$/, '') : src

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (num <= 1) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = canvasRef.current
      if (!c) return
      const w = img.naturalWidth
      const h = img.naturalHeight
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) return
      const rem = h % num
      for (let i = 0; i < num; i++) {
        let sh = Math.floor(h / num)
        const sy = sh * i
        let dy = h - sh * (i + 1) - rem
        if (i === 0) sh += rem
        else dy += rem
        ctx.drawImage(img, 0, sy, w, sh, 0, dy, w, sh)
      }
    }
    img.onerror = () => setFailed(true)
    img.src = url
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [url, num])

  if (num <= 1 || failed) {
    return <img src={url} loading="lazy" alt="" draggable={false} />
  }
  return <canvas ref={canvasRef} />
}
