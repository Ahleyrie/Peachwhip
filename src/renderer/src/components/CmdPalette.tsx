import { useEffect, useState } from 'react'

/** Ctrl+K palette: jump to a tab, or type a phrase to search the active source. */
export function CmdPalette({
  tabs,
  onGo,
  onSearchActive,
  onClose
}: {
  tabs: { id: string; label: string }[]
  onGo: (id: string) => void
  onSearchActive: (q: string) => void
  onClose: () => void
}): JSX.Element {
  const [q, setQ] = useState('')

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const matches = tabs.filter((t) => t.label.toLowerCase().includes(q.trim().toLowerCase()))

  const run = (): void => {
    if (matches.length) onGo(matches[0].id)
    else if (q.trim()) onSearchActive(q.trim())
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Jump to a tab, or type to search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <div className="palette-list">
          {matches.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onGo(t.id)
                onClose()
              }}
            >
              {t.label}
            </button>
          ))}
          {q.trim() && (
            <button
              className="palette-search"
              onClick={() => {
                onSearchActive(q.trim())
                onClose()
              }}
            >
              Search “{q.trim()}” here
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
