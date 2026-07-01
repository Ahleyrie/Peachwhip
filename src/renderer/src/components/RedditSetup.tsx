import { useEffect, useState } from 'react'

/**
 * Shown when the Reddit source has no API client id. Reddit's public endpoints
 * now require OAuth, so the user creates a free "installed app" once and pastes
 * its client id here. Stored via settings; then the feed loads.
 */
export function RedditSetup({ onSaved }: { onSaved: () => void }): JSX.Element {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void window.peachwhip.settings.get('redditClientId').then((v) => setValue(v || ''))
  }, [])

  const save = async (): Promise<void> => {
    const id = value.trim()
    if (!id) return
    setSaving(true)
    await window.peachwhip.settings.set('redditClientId', id)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="setup">
      <div className="setup-card">
        <h2>Connect Reddit</h2>
        <p className="setup-sub">
          Reddit now requires a free API key to read content. It takes about a minute and
          you only do it once.
        </p>
        <ol className="setup-steps">
          <li>
            Open{' '}
            <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noreferrer">
              reddit.com/prefs/apps
            </a>{' '}
            (log in as usual).
          </li>
          <li>
            Click <b>Create another app…</b>, choose <b>installed app</b>.
          </li>
          <li>
            Set the redirect URI to <code>http://localhost</code> and create it.
          </li>
          <li>
            Copy the <b>client id</b> — the string right under the app's name (under
            &ldquo;installed app&rdquo;).
          </li>
        </ol>
        <div className="setup-row">
          <input
            className="setup-input"
            placeholder="Paste your Reddit client id"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <button className="setup-save" onClick={save} disabled={saving || !value.trim()}>
            {saving ? 'Saving…' : 'Connect'}
          </button>
        </div>
        <p className="setup-note">Stored locally on your device only.</p>
      </div>
    </div>
  )
}
