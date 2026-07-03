import type { MediaItem } from '@shared/types'
import { MediaCard } from './MediaCard'
import { usePref } from '../prefs'

export function MediaGrid({
  items,
  onOpen,
  favKeys,
  onToggleFav
}: {
  items: MediaItem[]
  onOpen: (item: MediaItem) => void
  favKeys: Set<string>
  onToggleFav: (item: MediaItem) => void
}): JSX.Element {
  const [cols] = usePref('gridCols', 0)
  return (
    <div className="grid" style={cols > 0 ? { columnCount: cols } : undefined}>
      {items.map((item) => (
        <MediaCard
          key={`${item.source}:${item.id}`}
          item={item}
          onOpen={onOpen}
          isFav={favKeys.has(`${item.source}:${item.id}`)}
          onToggleFav={onToggleFav}
        />
      ))}
    </div>
  )
}
