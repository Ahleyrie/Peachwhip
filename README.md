# 🍑 Peachwhip

A desktop hub for adult content — native streaming, a unified browser across many
sources, and in-app self-updates. Windows-first (macOS/Linux buildable too).

> Legal adult content only. No minors, no loli/CSAM, no illegal material — by design.

## Stack

- **Electron** shell (bundled Chromium = reliable native video/HLS playback)
- **React + Vite + TypeScript** renderer, built with **electron-vite**
- A local **"core"** (runs in the Electron main process) that unifies every content
  source behind one typed API. Sources are added in `src/main/core/sources/`.
- **electron-updater** for self-update (feed hosted on Cloudflare R2 — see below)

## Layout

```
src/
  shared/types.ts          Unified content model (MediaItem, Feed, Source, …)
  main/
    index.ts               App lifecycle, window, RedGifs header injection
    ipc.ts                 IPC handlers (media:*, update:*, app:version)
    updater.ts             electron-updater wiring
    core/
      registry.ts          Source registry — add new sources here
      sources/redgifs.ts   RedGifs source (TS port of the redgifs Python lib)
  preload/index.ts         contextBridge → window.peachwhip (typed, sandboxed)
  renderer/                React UI (grid, search, player modal, update button)
```

## Develop

```bash
npm install
npm run dev          # launches the app with HMR
```

> ℹ️ **Networking note:** Sources fetch through Electron's Chromium stack
> (`net.fetch`), which handles Cloudflare-fronted hosts like RedGifs that newer
> Node/OpenSSL rejects at the TLS layer. Don't test sources with a plain
> `node fetch()` script — it can fail with `ERR_SSL_TLSV1_ALERT_ACCESS_DENIED` even
> though the app works. (If *your own* network/DNS filters adult domains, use a VPN.)

## Build & package

```bash
npm run build        # compile main/preload/renderer -> out/
npm run dist         # build + package installer -> dist/  (electron-builder)
npm run dist:dir     # unpacked build (faster, for local testing)
```

## Self-update setup (later)

1. Create a Cloudflare R2 bucket, expose it over its public `r2.dev` URL (or a Worker).
2. Set that URL in `electron-builder.yml` under `publish.url`.
3. Release with `npm run dist` and upload the artifacts (`dist/*.exe`, `latest.yml`,
   blockmaps) to the bucket.
4. The app's **Check for updates** button (top-right) and auto-check will read that
   feed, download in the background, and install on restart.

App stores ban adult content, so distribution is direct-download + auto-update.

## Adding a source

Implement the `Source` contract from `src/shared/types.ts` in a new file under
`src/main/core/sources/`, then register it in `src/main/core/registry.ts`. It shows
up as a tab automatically. See `redgifs.ts` for the reference implementation.
