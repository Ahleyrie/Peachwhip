/** Shimmer placeholder grid shown while the first page loads. */
export function Skeleton(): JSX.Element {
  return (
    <div className="grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skel-card" style={{ height: 170 + (i % 3) * 70 }} />
      ))}
    </div>
  )
}
