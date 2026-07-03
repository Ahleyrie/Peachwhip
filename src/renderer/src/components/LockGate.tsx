import { useState } from 'react'
import { getPref } from '../prefs'
import { simpleHash } from '../util'
import logo from '../assets/logo.png'

/** Shown on launch if a PIN is set. A deterrent lock, not real encryption. */
export function LockGate(): JSX.Element | null {
  const [locked, setLocked] = useState(() => !!getPref('pinHash', ''))
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)

  if (!locked) return null

  const submit = (): void => {
    if (simpleHash(val) === getPref('pinHash', '')) {
      setLocked(false)
    } else {
      setErr(true)
      setVal('')
    }
  }

  return (
    <div className="lock">
      <div className="lock-card">
        <img src={logo} alt="" width="64" height="64" />
        <h2>Locked</h2>
        <input
          type="password"
          autoFocus
          placeholder="PIN"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="setup-save" onClick={submit}>
          Unlock
        </button>
        {err && <p className="set-note error">Wrong PIN</p>}
      </div>
    </div>
  )
}
