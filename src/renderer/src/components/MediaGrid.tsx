import type { MediaItem } from '@shared/types'
import { MediaCard } from './MediaCard'

export function MediaGrid({
  items,
  onOpen
}: {
  items: MediaItem[]
  onOpen: (item: MediaItem) => void
}): JSX.Element {
  return (
    <div className="grid">
      {items.map((item) => (
        <MediaCard key={`${item.source}:${item.id}`} item={item} onOpen={onOpen} />
      ))}
    </div>
  )
}
