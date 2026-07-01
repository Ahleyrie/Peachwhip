/// <reference types="vite/client" />

import type { PeachwhipApi } from '../../preload'

declare global {
  interface Window {
    peachwhip: PeachwhipApi
  }
}

export {}
