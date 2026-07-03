import { useEffect, useState } from 'react'
import type { SourceInfo } from '@shared/types'
import { exportPrefs, getPref, importPrefs, resetPrefs, setPref, usePref } from '../prefs'
import { getList } from '../lists'
import { simpleHash } from '../util'

const ACCENTS: { name: string; a: string; b: string }[] = [
  { name: 'Peach', a: '', b: '' },
  { name: 'Rose', a: '#ff5c8a', b: '#ff9770' },
  { name: 'Cyan', a: '#38e0d0', b: '#4aa3ff' },
  { name: 'Violet', a: '#a06bff', b: '#ff6bd6' },
  { name: 'Green', a: '#57d977', b: '#aecb4e' },
  { name: 'Gold', a: '#ffcf5c', b: '#ff9f43' }
]

function Toggle({
  k,
  def,
  label
}: {
  k: string
  def: boolean
  label: string
}): JSX.Element {
  const [v, setV] = usePref(k, def)
  return (
    <label className="set-row">
      <span>{label}</span>
      <input type="checkbox" checked={v} onChange={(e) => setV(e.target.checked)} />
    </label>
  )
}

function Range({
  k,
  def,
  min,
  max,
  step,
  label,
  suffix
}: {
  k: string
  def: number
  min: number
  max: number
  step?: number
  label: string
  suffix?: string
}): JSX.Element {
  const [v, setV] = usePref(k, def)
  return (
    <label className="set-row">
      <span>
        {label} <b>{v === 0 && k === 'gridCols' ? 'auto' : `${v}${suffix || ''}`}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step || 1}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
      />
    </label>
  )
}

export function SettingsModal({
  sources,
  version,
  onClose
}: {
  sources: SourceInfo[]
  version: string
  onClose: () => void
}): JSX.Element {
  const [theme, setTheme] = usePref('theme', 'warm')
  const [accent, setAccent] = usePref('accent', '')
  const [, setAccent2] = usePref('accent2', '')
  const [bg, setBg] = usePref<string>('bgImage', '')
  const [disabled, setDisabled] = usePref<string[]>('disabledSources', [])
  const [importMsg, setImportMsg] = useState('')
  const [pin, setPin] = useState('')
  const [proxy, setProxy] = useState('')
  const [proxyMsg, setProxyMsg] = useState('')

  useEffect(() => {
    void window.peachwhip.app.getProxy().then(setProxy)
  }, [])
  const [stats, setStats] = useState<{ pies: number; history: number; watch: number; downloads: number; topTags: string[] }>(
    { pies: 0, history: 0, watch: 0, downloads: 0, topTags: [] }
  )

  useEffect(() => {
    void Promise.all([window.peachwhip.favorites.list(), window.peachwhip.downloads.list()]).then(
      ([favs, dls]) => {
        const hist = getList('history')
        const counts: Record<string, number> = {}
        hist.forEach((i) => i.tags?.forEach((t) => (counts[t] = (counts[t] || 0) + 1)))
        const topTags = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([t]) => t)
        setStats({
          pies: favs.length,
          history: hist.length,
          watch: getList('watchlater').length,
          downloads: dls.length,
          topTags
        })
      }
    )
  }, [])

  const toggleSource = (id: string): void => {
    setDisabled(disabled.includes(id) ? disabled.filter((x) => x !== id) : [...disabled, id])
  }

  const doExport = (): void => {
    const blob = new Blob([JSON.stringify(exportPrefs(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'peachwhip-settings.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doImport = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((t) => {
      try {
        importPrefs(JSON.parse(t))
        setImportMsg('Imported ✓')
      } catch {
        setImportMsg('Invalid file')
      }
    })
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h2>Settings</h2>
          <button className="close-x" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="settings-body">
          <section>
            <h3>Appearance</h3>
            <label className="set-row">
              <span>Theme</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="warm">Warm (default)</option>
                <option value="light">Light</option>
                <option value="amoled">AMOLED black</option>
              </select>
            </label>
            <div className="set-row">
              <span>Accent</span>
              <div className="swatches">
                {ACCENTS.map((c) => (
                  <button
                    key={c.name}
                    title={c.name}
                    className={`swatch ${accent === c.a ? 'on' : ''}`}
                    style={{
                      background: c.a
                        ? `linear-gradient(135deg, ${c.a}, ${c.b})`
                        : 'linear-gradient(135deg, #fa5c6b, #f6a15c)'
                    }}
                    onClick={() => {
                      setAccent(c.a)
                      setAccent2(c.b)
                    }}
                  />
                ))}
              </div>
            </div>
            <Range k="fontScale" def={100} min={80} max={140} label="Font size" suffix="%" />
            <Range k="radius" def={14} min={0} max={24} label="Corner radius" suffix="px" />
            <Range k="gridCols" def={0} min={0} max={8} label="Grid columns" />
            <Toggle k="compact" def={false} label="Compact spacing" />
            <Toggle k="listView" def={false} label="List view (rows instead of grid)" />
            <Toggle k="reducedMotion" def={false} label="Reduce motion" />
            <label className="set-row">
              <span>Background image URL</span>
              <input
                type="text"
                value={bg}
                placeholder="https://…"
                onChange={(e) => setBg(e.target.value)}
              />
            </label>
          </section>

          <section>
            <h3>Behavior</h3>
            <Toggle k="autoplayOnOpen" def={true} label="Autoplay when opening a video" />
            <Toggle k="autoAdvance" def={false} label="Auto-play next when a video ends" />
            <Toggle k="muteByDefault" def={false} label="Mute videos by default" />
            <Toggle k="rememberVolume" def={true} label="Remember volume" />
            <Toggle k="hoverPreview" def={true} label="Hover-preview videos in the grid" />
            <Toggle k="glanceBlur" def={false} label="Glance-safe (blur thumbnails until hover)" />
            <Toggle k="confirmExternal" def={false} label="Confirm before opening external links" />
            <Toggle k="hideSeen" def={false} label="Hide items you've already opened" />
            <Toggle k="dataSaver" def={false} label="Data saver (skip hover video previews)" />
          </section>

          <section>
            <h3>Startup</h3>
            <Toggle k="rememberLastTab" def={true} label="Reopen the last tab on launch" />
          </section>

          <section>
            <h3>Privacy</h3>
            <Toggle k="blurOnBlur" def={false} label="Blur the app when it loses focus" />
            <Toggle k="incognito" def={false} label="Incognito — don't record history" />
            <div className="set-row">
              <span>
                PIN lock <b>{getPref('pinHash', '') ? 'on' : 'off'}</b>
              </span>
              <span className="pin-set">
                <input
                  type="password"
                  value={pin}
                  placeholder="New PIN"
                  onChange={(e) => setPin(e.target.value)}
                />
                <button
                  className="update-btn"
                  onClick={() => {
                    if (pin) {
                      setPref('pinHash', simpleHash(pin))
                      setPin('')
                    }
                  }}
                >
                  Set
                </button>
                <button className="update-btn" onClick={() => setPref('pinHash', '')}>
                  Off
                </button>
              </span>
            </div>
            <p className="set-note">Panic hotkey: Ctrl+Shift+H instantly hides/shows the window.</p>
          </section>

          <section>
            <h3>Network / Proxy</h3>
            <p className="set-note">
              If your network blocks adult sites (SSL errors), route through a proxy/VPN
              endpoint. Examples: <code>socks5://127.0.0.1:1080</code> or{' '}
              <code>http://host:port</code>. Leave blank for a direct connection.
            </p>
            <div className="set-row">
              <input
                type="text"
                value={proxy}
                placeholder="socks5://127.0.0.1:1080"
                onChange={(e) => setProxy(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="update-btn"
                onClick={async () => {
                  await window.peachwhip.app.setProxy(proxy.trim())
                  setProxyMsg('Applied ✓ — reload a tab to test.')
                }}
              >
                Apply
              </button>
            </div>
            {proxyMsg && <p className="set-note">{proxyMsg}</p>}
          </section>

          <section>
            <h3>Sources</h3>
            {sources.map((s) => (
              <label key={s.id} className="set-row">
                <span>{s.label}</span>
                <input
                  type="checkbox"
                  checked={!disabled.includes(s.id)}
                  onChange={() => toggleSource(s.id)}
                />
              </label>
            ))}
          </section>

          <section>
            <h3>Data</h3>
            <div className="set-actions">
              <button className="update-btn" onClick={() => window.peachwhip.app.clearCache()}>
                Clear cache
              </button>
              <button className="update-btn" onClick={doExport}>
                Export settings
              </button>
              <label className="update-btn file-btn">
                Import settings
                <input type="file" accept="application/json" onChange={doImport} hidden />
              </label>
              <button
                className="update-btn danger"
                onClick={() => {
                  if (confirm('Reset all settings to defaults?')) resetPrefs()
                }}
              >
                Reset all
              </button>
              <button
                className="update-btn danger"
                onClick={async () => {
                  if (
                    confirm(
                      'Erase ALL data — settings, pies, history, cookies, and cache? This cannot be undone.'
                    )
                  ) {
                    await window.peachwhip.app.clearData()
                    localStorage.clear()
                    location.reload()
                  }
                }}
              >
                Erase all data
              </button>
            </div>
            {importMsg && <p className="set-note">{importMsg}</p>}
          </section>

          <section>
            <h3>Stats</h3>
            <div className="stats-grid">
              <div className="stat">
                <b>{stats.pies}</b>
                <span>Pies</span>
              </div>
              <div className="stat">
                <b>{stats.history}</b>
                <span>Watched</span>
              </div>
              <div className="stat">
                <b>{stats.watch}</b>
                <span>Queued</span>
              </div>
              <div className="stat">
                <b>{stats.downloads}</b>
                <span>Downloads</span>
              </div>
            </div>
            {stats.topTags.length > 0 && (
              <p className="set-note">Top tags: {stats.topTags.join(' · ')}</p>
            )}
          </section>

          <p className="set-note">Peachwhip v{version} · settings are stored locally on your device.</p>
        </div>
      </div>
    </div>
  )
}
