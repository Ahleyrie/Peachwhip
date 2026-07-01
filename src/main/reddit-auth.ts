// Embedded Reddit login. Reddit disabled self-serve API keys and gates NSFW
// content behind a logged-in account, so instead of OAuth we open Reddit's real
// login page in a window and reuse the resulting session cookies (via the shared
// defaultSession) for the source's .json requests.

import { BrowserWindow, session } from 'electron'

const REDDIT_URL = 'https://www.reddit.com'
const LOGIN_URL = 'https://www.reddit.com/login/'
// Presence of this cookie means an authenticated Reddit session exists.
const SESSION_COOKIE = 'reddit_session'

export async function isRedditLoggedIn(): Promise<boolean> {
  const cookies = await session.defaultSession.cookies.get({
    url: REDDIT_URL,
    name: SESSION_COOKIE
  })
  return cookies.length > 0
}

/** Set the adult-content consent cookie (belt-and-suspenders alongside account prefs). */
export async function ensureOver18(): Promise<void> {
  try {
    await session.defaultSession.cookies.set({
      url: REDDIT_URL,
      name: 'over18',
      value: '1',
      domain: '.reddit.com'
    })
  } catch {
    // Non-fatal.
  }
}

/** Open Reddit's login page; resolves true once a session cookie appears. */
export function openRedditLogin(parent: BrowserWindow | null): Promise<boolean> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 760,
      parent: parent ?? undefined,
      modal: !!parent,
      autoHideMenuBar: true,
      title: 'Log in to Reddit',
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })

    let done = false
    const finish = async (ok: boolean): Promise<void> => {
      if (done) return
      done = true
      clearInterval(timer)
      if (ok) await ensureOver18()
      if (!win.isDestroyed()) win.close()
      resolve(ok)
    }

    // Poll for the session cookie — robust across Reddit's login redirects / 2FA.
    const timer = setInterval(() => {
      void isRedditLoggedIn().then((ok) => {
        if (ok) void finish(true)
      })
    }, 1000)

    win.on('closed', () => {
      if (!done) {
        done = true
        clearInterval(timer)
        resolve(false)
      }
    })

    void win.loadURL(LOGIN_URL)
  })
}

/** Clear all reddit.com cookies (log out). */
export async function redditLogout(): Promise<void> {
  const ses = session.defaultSession
  const cookies = await ses.cookies.get({ domain: 'reddit.com' })
  await Promise.all(
    cookies.map((c) => {
      const host = c.domain?.replace(/^\./, '') || 'www.reddit.com'
      const url = `https://${host}${c.path || '/'}`
      return ses.cookies.remove(url, c.name).catch(() => undefined)
    })
  )
}
