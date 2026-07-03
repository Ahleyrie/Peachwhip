import { join } from 'path'
import { pathToFileURL } from 'url'
import { app, BrowserWindow, globalShortcut, net, protocol, session } from 'electron'
import { registerIpc } from './ipc'
import { setupUpdater } from './updater'
import { initCore } from './core/registry'
import { initComics } from './core/comics/registry'
import { getSetting, setSetting } from './settings'
import type { FetchLike } from '../shared/types'
import { REDGIFS_UA } from './core/sources/redgifs'

// Chromium-backed fetch shared by all content sources. Uses a real browser TLS
// fingerprint + the app session's cookies, which is what makes Cloudflare-fronted
// adult sources (RedGifs and beyond) reachable where Node's fetch may not be.
const electronFetch: FetchLike = (url, init) => net.fetch(url, init as RequestInit)

// Custom protocol so downloaded local files can play in the renderer regardless of
// its origin (file:// in prod, http://localhost in dev). URL form: pwfile://f/<encoded absolute path>
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pwfile',
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, bypassCSP: true }
  }
])

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

// nhentai image CDNs (i./t.nhentai.net) hotlink-protect; send a matching Referer.
function installNhentaiHeaderInjection(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.nhentai.net/*'] },
    (details, callback) => {
      const headers = details.requestHeaders
      headers['Referer'] = 'https://nhentai.net/'
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
    // redd.it/redgifs for HLS; JMComic CDNs so scrambled pages can be read into a
    // <canvas> (de-scramble) without tainting it.
    {
      urls: [
        '*://*.redd.it/*',
        '*://*.redgifs.com/*',
        '*://*.jmapiproxy1.cc/*',
        '*://*.jmapiproxy2.cc/*',
        '*://*.jmapiproxy3.net/*',
        '*://*.jmapinodeudzn.net/*',
        '*://*.jmdanjonproxy.vip/*'
      ]
    },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders }
      responseHeaders['Access-Control-Allow-Origin'] = ['*']
      callback({ responseHeaders })
    }
  )
}

// Tube embed players set X-Frame-Options / CSP frame-ancestors to prevent framing.
// Strip those on the embed hosts so the in-app <iframe> player can load them.
const TUBE_HOSTS = ['*://*.pornhub.com/*', '*://*.xvideos.com/*', '*://*.redtube.com/*', '*://*.youporn.com/*']
function installEmbedFramingHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: TUBE_HOSTS },
    (details, callback) => {
      const responseHeaders: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(details.responseHeaders || {})) {
        const lower = k.toLowerCase()
        if (lower === 'x-frame-options' || lower === 'content-security-policy') continue
        responseHeaders[k] = v as string[]
      }
      callback({ responseHeaders })
    }
  )
}

// Best-effort age-consent cookies so tube search pages return content.
async function installTubeConsentCookies(): Promise<void> {
  const set = (url: string, name: string, value: string): Promise<void> =>
    session.defaultSession.cookies.set({ url, name, value }).catch(() => undefined)
  await Promise.all([
    set('https://www.pornhub.com', 'age_verified', '1'),
    set('https://www.pornhub.com', 'accessAgeDisclaimerPH', '1'),
    set('https://www.pornhub.com', 'platform', 'pc'),
    set('https://www.youporn.com', 'age_verified', '1')
  ])
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
      nodeIntegration: false,
      // Keep audio/video playing when the window is minimized/backgrounded.
      backgroundThrottling: false
    }
  })

  // Block all popups (tube embeds spawn ad windows). Legit "open on source" links
  // go through the app:openExternal IPC instead.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // The app is a SPA whose top frame never navigates; prevent ad scripts inside
  // embed iframes from hijacking the whole window.
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault())

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
  protocol.handle('pwfile', (request) => {
    const p = decodeURIComponent(new URL(request.url).pathname).replace(/^\//, '')
    return net.fetch(pathToFileURL(p).toString())
  })

  installRedgifsHeaderInjection()
  installNhentaiHeaderInjection()
  installStreamCorsHeaders()
  installEmbedFramingHeaders()
  void installTubeConsentCookies()
  initCore({ fetch: electronFetch, getSetting, setSetting })
  initComics({ fetch: electronFetch, getSetting, setSetting })
  registerIpc(getWindow)
  setupUpdater(getWindow)
  createWindow()

  // Panic hotkey: instantly hide/show the window (recoverable with the same keys).
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    const w = mainWindow
    if (!w) return
    if (w.isVisible()) w.hide()
    else {
      w.show()
      w.focus()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
