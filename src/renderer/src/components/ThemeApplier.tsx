import { useEffect } from 'react'
import { usePref } from '../prefs'

/** Applies appearance preferences to the document root. Renders nothing. */
export function ThemeApplier(): null {
  const [theme] = usePref('theme', 'warm')
  const [accent] = usePref('accent', '')
  const [accent2] = usePref('accent2', '')
  const [fontScale] = usePref('fontScale', 100)
  const [compact] = usePref('compact', false)
  const [reducedMotion] = usePref('reducedMotion', false)
  const [radius] = usePref('radius', 14)
  const [bg] = usePref<string>('bgImage', '')
  const [glance] = usePref('glanceBlur', false)
  const [listView] = usePref('listView', false)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    root.classList.toggle('compact', compact)
    root.classList.toggle('reduced-motion', reducedMotion)
    root.classList.toggle('glance', glance)
    root.classList.toggle('listview', listView)
    root.style.fontSize = `${fontScale}%`
    root.style.setProperty('--radius', `${radius}px`)

    if (accent) {
      root.style.setProperty('--coral', accent)
      root.style.setProperty('--accent', accent)
    } else {
      root.style.removeProperty('--coral')
      root.style.removeProperty('--accent')
    }
    if (accent2) {
      root.style.setProperty('--orange', accent2)
      root.style.setProperty('--accent-2', accent2)
    } else {
      root.style.removeProperty('--orange')
      root.style.removeProperty('--accent-2')
    }

    document.body.style.backgroundImage = bg
      ? `linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.72)), url("${bg}")`
      : ''
    document.body.style.backgroundSize = bg ? 'cover' : ''
    document.body.style.backgroundAttachment = bg ? 'fixed' : ''
  }, [theme, accent, accent2, fontScale, compact, reducedMotion, radius, bg, glance, listView])

  return null
}
