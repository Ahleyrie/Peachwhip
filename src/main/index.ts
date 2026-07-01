import { join } from 'path'
import { app, BrowserWindow, net, session, shell } from 'electron'
import { registerIpc } from './ipc'
import { setupUpdater } from './updater'
import { initCore } from './core/registry'
import { getSetting, setSetting } from './settings'
import type { FetchLike } from '../shared/types'
import { REDGIFS_UA } from './core/sources/redgifs'

// Chromium-backed fetch shared by all content sources. Uses a real browser TLS
// fingerprint + the app session's cookies, which is what makes Cloudflare-fronted
// adult sources (RedGifs and beyond) reachable where Node's fetch may not be.
const electronFetch: FetchLike = (url, init) => net.fetch(url, init as RequestInit)

let mainWindow: BrowserWindow | null = null
const getWindow = (): BrowserWindow | null => mainWindow

// RedGifs media hosts (CDN + thumbs) hotlink-protect and tie tokens to the UA
// used at auth time. Injecting a matching Referer + User-Agent lets the renderer
// stream media directly in a <video> tag (with native Range/seek support).
function installRedgifsHeaderInjection(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.redgifs.com/*'] },
    (details, callback) => {
      const headers = details.requestHeaders
      headers['User-Agent'] = REDGIFS_UA
      headers['Referer'] = 'https://www.redgifs.com/'
      headers['Origin'] = 'https://www.redgifs.com'
      callback({ requestHeaders: headers })
    }
  )
}

// hls.js fetches HLS playlists/segments via XHR, which is subject to CORS. Reddit's
// video CDN (v.redd.it) doesn't send permissive CORS headers, so we add them here
// for the streaming hosts. Surgical (specific hosts) rather than disabling
// webSecurity globally.
function installStreamCorsHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://*.redd.it/*', '*://*.redgifs.com/*'] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders }
      responseHeaders['Access-Control-Allow-Origin'] = ['*']
      callback({ responseHeaders })
    }
  )
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#0e0b10',
    autoHideMenuBar: true,
    title: 'Peachwhip',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Open external links (e.g. "view on source") in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  installRedgifsHeaderInjection()
  installStreamCorsHeaders()
  initCore({ fetch: electronFetch, getSetting, setSetting })
  registerIpc(getWindow)
  setupUpdater(getWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
