import { useEffect, useState } from 'react'

interface Toast {
  id: number
  msg: string
}

let toasts: Toast[] = []
const subs = new Set<() => void>()
let counter = 0

export function toast(msg: string): void {
  const t = { id: ++counter, msg }
  toasts = [...toasts, t]
  subs.forEach((s) => s())
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    subs.forEach((s) => s())
  }, 2200)
}

export function useToasts(): Toast[] {
  const [, force] = useState(0)
  useEffect(() => {
    const l = (): void => force((x) => x + 1)
    subs.add(l)
    return () => {
      subs.delete(l)
    }
  }, [])
  return toasts
}
