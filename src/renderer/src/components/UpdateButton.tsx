import { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/types'

export function UpdateButton(): JSX.Element {
  const [status, setStatus] = useState<UpdateState>({ state: 'idle' })

  useEffect(() => {
    const off = window.peachwhip.update.onStatus(setStatus)
    return off
  }, [])

  const check = async (): Promise<void> => {
    setStatus({ state: 'checking' })
    const res = await window.peachwhip.update.check()
    // In dev there are no push events, so reflect the immediate result.
    if (res.state === 'dev' || res.state === 'error') setStatus(res)
  }

  const install = (): void => {
    void window.peachwhip.update.install()
  }

  switch (status.state) {
    case 'ready':
      return (
        <button className="update-btn ready" onClick={install}>
          Restart &amp; update to {status.version}
        </button>
      )
    case 'downloading':
      return <button className="update-btn" disabled>Downloading {status.percent}%…</button>
    case 'available':
      return <button className="update-btn" disabled>Update {status.version} found…</button>
    case 'checking':
      return <button className="update-btn" disabled>Checking…</button>
    case 'none':
      return <button className="update-btn" onClick={check}>Up to date ✓</button>
    case 'dev':
      return <button className="update-btn" onClick={check} title="Updates only run in a packaged build">Dev build</button>
    case 'error':
      return <button className="update-btn" onClick={check} title={status.message}>Update failed ↻</button>
    default:
      return <button className="update-btn" onClick={check}>Check for updates</button>
  }
}
