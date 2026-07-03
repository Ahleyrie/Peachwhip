// Downloads — saves an item's video/image to disk (streamed via net.fetch so the
// session's header injection applies), tracks progress, and keeps a small library.
// Downloaded files play back in-app through the `pwfile://` protocol.

import { app, BrowserWindow, net } from 'electron'
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import type { DownloadRecord, MediaItem } from '../shared/types'

export function downloadsDir(): string {
  const d = join(app.getPath('downloads'), 'Peachwhip')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

function dbFile(): string {
  return join(app.getPath('userData'), 'downloads.json')
}
function readDb(): DownloadRecord[] {
  try {
    return existsSync(dbFile()) ? (JSON.parse(readFileSync(dbFile(), 'utf8')) as DownloadRecord[]) : []
  } catch {
    return []
  }
}
function writeDb(v: DownloadRecord[]): void {
  try {
    writeFileSync(dbFile(), JSON.stringify(v, null, 2))
  } catch {
    /* ignore */
  }
}

function extFromUrl(url: string, kind: string): string {
  const m = url.split('?')[0].match(/\.([a-z0-9]{2,4})$/i)
  if (m) return m[1]
  return kind === 'image' ? 'jpg' : 'mp4'
}
function safeName(s: string): string {
  return (s || 'file').replace(/[^\w\d-]+/g, '_').slice(0, 60)
}
function broadcast(channel: string, payload: unknown): void {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, payload))
}

export async function downloadItem(item: MediaItem): Promise<DownloadRecord> {
  const url =
    item.streamUrl && !/\.m3u8($|\?)/i.test(item.streamUrl) ? item.streamUrl : item.imageUrl
  if (!url) throw new Error('Nothing downloadable here (live/torrent/embed streams cannot be saved).')

  const file = join(downloadsDir(), `${safeName(item.title || item.id)}_${item.id}.${extFromUrl(url, item.kind)}`)
  const res = await net.fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`)

  const total = Number(res.headers.get('content-length') || 0)
  let done = 0
  const out = createWriteStream(file)
  const node = Readable.fromWeb(res.body as never)
  node.on('data', (chunk: Buffer) => {
    done += chunk.length
    if (total) broadcast('download:progress', { id: item.id, percent: Math.round((done / total) * 100) })
  })
  await new Promise<void>((resolve, reject) => {
    node.pipe(out)
    out.on('finish', () => resolve())
    out.on('error', reject)
    node.on('error', reject)
  })

  const rec: DownloadRecord = {
    id: item.id,
    source: item.source,
    title: item.title,
    file,
    thumbnail: item.thumbnail,
    kind: item.kind,
    date: Date.now()
  }
  const db = readDb().filter((d) => !(d.id === rec.id && d.source === rec.source))
  db.unshift(rec)
  writeDb(db)
  broadcast('download:done', { id: item.id, title: item.title })
  return rec
}

export function listDownloads(): DownloadRecord[] {
  return readDb()
}

export function deleteDownload(id: string, source: string): void {
  const db = readDb()
  const rec = db.find((d) => d.id === id && d.source === source)
  if (rec) {
    try {
      unlinkSync(rec.file)
    } catch {
      /* ignore */
    }
  }
  writeDb(db.filter((d) => !(d.id === id && d.source === source)))
}
