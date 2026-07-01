import type { MediaItem } from '@shared/types'
import { MediaCard } from './MediaCard'

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
  return (
    <div className="grid">
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
