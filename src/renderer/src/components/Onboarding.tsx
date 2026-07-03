import { useState } from 'react'
import { getPref, setPref } from '../prefs'
import logo from '../assets/logo.png'

/** First-run welcome. Shows once. */
export function Onboarding(): JSX.Element | null {
  const [done, setDone] = useState(() => !!getPref('onboarded', false))
  if (done) return null

  const finish = (): void => {
    setPref('onboarded', true)
    setDone(true)
  }

  return (
    <div className="overlay">
      <div className="onb" onClick={(e) => e.stopPropagation()}>
        <img src={logo} width="72" height="72" alt="" />
        <h1>Welcome to Peachwhip 🍑</h1>
        <p>Everything adult in one app — streaming, comics, and a curated index.</p>
        <ul className="onb-tips">
          <li>Tap the tabs to switch sources; ♡ saves to your Pies.</li>
          <li>Right-click anything for quick actions (save, download, copy).</li>
          <li>Press <b>Ctrl+K</b> to jump anywhere, <b>Ctrl+Shift+H</b> to panic-hide.</li>
          <li>Open <b>⚙ Settings</b> for themes, privacy, and more.</li>
        </ul>
        <button className="setup-save" onClick={finish}>
          Get started
        </button>
      </div>
    </div>
  )
}
