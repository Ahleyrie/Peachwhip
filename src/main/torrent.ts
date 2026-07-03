// In-app torrent streaming via WebTorrent. EXPERIMENTAL / unverified.
// webtorrent v2 is ESM-only, so it's loaded via dynamic import from the CJS main
// process the first time it's needed. On any failure the UI falls back to opening
// the magnet in the OS torrent client.
/* eslint-disable @typescript-eslint/no-explicit-any */

let clientPromise: Promise<any> | null = null
let server: any = null

async function getClient(): Promise<any> {
  if (!clientPromise) {
    clientPromise = import('webtorrent').then((m: any) => new (m.default || m)())
  }
  return clientPromise
}

const VIDEO_RE = /\.(mp4|m4v|mkv|webm|mov|avi)$/i

/** Add a magnet, pick the largest video file, and return a local streaming URL. */
export async function streamTorrent(magnet: string): Promise<string> {
  const client = await getClient()

  const torrent: any = await new Promise((resolve, reject) => {
    let t: any
    try {
      t = client.add(magnet)
    } catch {
      // Already added — reuse the existing torrent.
      t = client.torrents.find(
        (x: any) => x.magnetURI === magnet || magnet.toLowerCase().includes(String(x.infoHash))
      )
    }
    if (!t) return reject(new Error('could not start torrent'))
    if (t.ready) return resolve(t)
    t.on('ready', () => resolve(t))
    t.on('error', (err: Error) => reject(err))
    setTimeout(
      () => reject(new Error('timed out finding peers (no seeds, or your network blocks torrents)')),
      60000
    )
  })

  if (!torrent || !torrent.files || torrent.files.length === 0) {
    throw new Error('no files in torrent (no peers reached)')
  }
  const files: any[] = [...torrent.files].sort((a, b) => b.length - a.length)
  const file = files.find((f) => VIDEO_RE.test(f.name)) || files[0]
  if (!file) throw new Error('no playable file in torrent')
  if (typeof file.select === 'function') file.select()

  if (!server) {
    server = client.createServer()
    await new Promise<void>((res) => server.listen(0, res))
  }
  const port = server.address().port
  const path =
    file.streamURL ||
    `/webtorrent/${torrent.infoHash}/${String(file.path).split('/').map(encodeURIComponent).join('/')}`
  return `http://localhost:${port}${path.startsWith('/') ? path : '/' + path}`
}

export async function stopTorrent(): Promise<void> {
  if (!clientPromise) return
  const client = await clientPromise
  for (const t of client.torrents) {
    try {
      t.destroy()
    } catch {
      /* ignore */
    }
  }
}
