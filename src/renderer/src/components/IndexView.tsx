import { useMemo, useState } from 'react'
import { NSFW_INDEX } from '../data/nsfwIndex'

/** Browsable, searchable directory of NSFW resources. Links open externally. */
export function IndexView(): JSX.Element {
  const [q, setQ] = useState('')

  const sections = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return NSFW_INDEX
    return NSFW_INDEX.map((s) => ({
      ...s,
      entries: s.entries.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.note?.toLowerCase().includes(query) ||
          s.title.toLowerCase().includes(query)
      )
    })).filter((s) => s.entries.length > 0)
  }, [q])

  const open = (url: string): void => {
    void window.peachwhip.app.openExternal(url)
  }

  return (
    <div className="indexv">
      <div className="index-bar">
        <div className="search">
          <input
            placeholder="Filter the index…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className="index-note">Curated links — open in your browser. Use responsibly.</span>
      </div>

      <div className="index-scroll">
        {sections.length === 0 ? (
          <div className="center">Nothing matches “{q}”.</div>
        ) : (
          sections.map((s) => (
            <section key={s.title} className="index-section">
              <h3 className="index-h">
                <span>{s.icon}</span> {s.title}
              </h3>
              <div className="index-entries">
                {s.entries.map((e) => (
                  <button key={e.url} className="index-chip" onClick={() => open(e.url)} title={e.url}>
                    <span className="index-chip-name">{e.name}</span>
                    {e.note && <span className="index-chip-note">{e.note}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
