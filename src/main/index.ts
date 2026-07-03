import { join } from 'path'
import { pathToFileURL } from 'url'
import { app, BrowserWindow, globalShortcut, ipcMain, net, protocol, session } from 'electron'
import { registerIpc } from './ipc'
import { setupUpdater } from './updater'
import { initCore } from './core/registry'
import { initComics } from './core/comics/registry'
import { getSetting, setSetting } from './settings'
import type { FetchLike } from '../shared/types'
import { REDGIFS_UA } from './core/sources/redgifs'

// Some networks break HTTP/3 (QUIC) to adult CDNs, causing ERR_QUIC_PROTOCOL_ERROR.
// Force plain TLS/TCP, which is more reliable behind filters/proxies.
app.commandLine.appendSwitch('disable-quic')

// Chromium-backed fetch shared by all content sources. Retries once on transient
// network/TLS errors (QUIC/SSL/connection resets are often flaky, not fatal).
const NET_ERR = /ERR_(QUIC|SSL|CONNECTION|NETWORK_CHANGED|TIMED_OUT|ADDRESS_UNREACHABLE)/i
const electronFetch: FetchLike = async (url, init) => {
  try {
    return await net.fetch(url, init as RequestInit)
  } catch (e) {
    if (NET_ERR.test(String((e as Error)?.message || ''))) {
      await new Promise((r) => setTimeout(r, 500))
      return net.fetch(url, init as RequestInit)
    }
    throw e
  }
}

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

// Optional proxy — lets users behind a filter route traffic through a proxy/VPN
// endpoint (e.g. socks5://127.0.0.1:1080 or http://host:port).
export async function applyProxy(): Promise<void> {
  const rules = getSetting('proxyRules')
  try {
    await session.defaultSession.setProxy(rules ? { proxyRules: rules } : { mode: 'direct' })
  } catch {
    /* ignore */
  }
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

function savedBounds(): { width: number; height: number; x?: number; y?: number } {
  try {
    const raw = getSetting('windowBounds')
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { width: 1280, height: 820 }
}

function createWindow(): void {
  const b = savedBounds()
  mainWindow = new BrowserWindow({
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
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
  mainWindow.on('close', () => {
    try {
      if (mainWindow) setSetting('windowBounds', JSON.stringify(mainWindow.getBounds()))
    } catch {
      /* ignore */
    }
  })
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
  void applyProxy()
  initCore({ fetch: electronFetch, getSetting, setSetting })
  initComics({ fetch: electronFetch, getSetting, setSetting })
  registerIpc(getWindow)
  ipcMain.handle('app:setProxy', async (_e, rules: string) => {
    setSetting('proxyRules', rules || undefined)
    await applyProxy()
  })
  ipcMain.handle('app:getProxy', () => getSetting('proxyRules') || '')
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
