import { useToasts } from '../toast'

export function Toasts(): JSX.Element {
  const items = useToasts()
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className="toast">
          {t.msg}
        </div>
      ))}
    </div>
  )
}
