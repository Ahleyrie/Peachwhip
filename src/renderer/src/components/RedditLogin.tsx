import { useState } from 'react'

/**
 * Shown when the Reddit tab is opened without a logged-in session. Reddit only
 * serves NSFW content to authenticated accounts, so we open Reddit's real login
 * page (in the main process) and reuse the session cookies.
 */
export function RedditLogin({ onLoggedIn }: { onLoggedIn: () => void }): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const login = async (): Promise<void> => {
    setBusy(true)
    setFailed(false)
    const ok = await window.peachwhip.reddit.login()
    setBusy(false)
    if (ok) onLoggedIn()
    else setFailed(true)
  }

  return (
    <div className="setup">
      <div className="setup-card">
        <h2>Log in to Reddit</h2>
        <p className="setup-sub">
          Reddit only shows NSFW content to logged-in accounts. Log in with your Reddit
          account to browse NSFW subreddits here.
        </p>
        <ul className="setup-steps">
          <li>Click the button — Reddit's real login page opens in a window.</li>
          <li>Sign in (2FA is fine); the window closes itself when you're in.</li>
          <li>
            Make sure adult content is enabled: Reddit → Settings → Profile →{' '}
            <b>“Show mature content (I'm over 18)”</b>.
          </li>
        </ul>
        <button className="setup-save" onClick={login} disabled={busy}>
          {busy ? 'Waiting for login…' : 'Log in to Reddit'}
        </button>
        {failed && <p className="setup-note error">Login window closed before finishing — try again.</p>}
        <p className="setup-note">
          Your login is handled by Reddit itself and stored only on your device. Peachwhip
          never sees your password.
        </p>
      </div>
    </div>
  )
}
