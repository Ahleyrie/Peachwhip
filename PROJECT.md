# Peachwhip — Project Plan of Record

Working name: **Peachwhip** 🍑 (backup: *Yumelo*). Both verified collision-free,
including in the adult space. Rename is a find/replace — nothing is hard-coded to it.

## Vision

A **desktop app** (main focus, Windows-first) that unifies adult content sources
behind one native, self-updating client, plus a lightweight **Cloudflare-hosted
showcase site**. Legal content only — no minors/loli/CSAM.

## Architecture

Two layers:

1. **Local core** (Electron main process, TypeScript): every source implements one
   `Source` contract and maps its payload onto a shared `MediaItem`/`Feed` model.
   The UI only ever speaks this unified language. New source = one file + one
   registry line.
2. **Renderer** (React/Vite/TS): source tabs, search, ordering, masonry grid,
   native `<video>` player, self-update control. Talks to the core over a typed,
   sandboxed `contextBridge` (`window.peachwhip`).

Distribution: direct download + **electron-updater** self-update (Cloudflare R2
feed). App stores ban adult content, so self-update is the delivery mechanism.

## Reference repos → how each is used

| Repo | Language | Role in Peachwhip |
|---|---|---|
| `redgifs-main` | Python | **Ported to TS** — first working source (done) |
| `pornsearch-master` | Node/TS | Drop-in later for tube-site search (Pornhub/xvideos/…) |
| `redhotsubs-main` | PHP | Design/logic reference for the Reddit source |
| `jasmine-master` | Flutter/Rust | Reference for the comics/manga reader pillar |
| `torrodle-main` | Go | Bundle as a sidecar binary for torrent-backed streaming |
| `wotaku-main` | VitePress/Nitro | NSFW index source **and** basis for the showcase site |
| `nsfw_data_scraper-main` | Python | Optional CNN for auto-tagging / SFW-gating (NOT a CSAM detector) |

## Roadmap

- [x] **M1 — Skeleton + 1 source.** Electron+React shell, unified core, RedGifs
      browse/search, native player, self-updater wired. *(current)*
- [ ] **M2 — RedGifs polish + Reddit source.** Paging/infinite scroll, favorites
      (local DB), settings; Reddit NSFW client (curated subs, hot/top/new, videos).
- [ ] **M3 — Tube search.** Integrate `pornsearch`; robust in-app playback (HLS via
      hls.js, header/extractor handling). *Fragile — ToS-grey; keep isolated.*
- [ ] **M4 — Comics/Manga + NSFW Comics.** Reader (paged/continuous), search,
      favorites, cache/offline (port ideas from `jasmine`).
- [ ] **M5 — Torrent streaming.** Bundle `torrodle` as a sidecar; stream-while-download.
- [ ] **M6 — NSFW Index.** Curated directory (wotaku-style) inside the app.
- [ ] **M7 — Showcase site.** VitePress/Astro on Cloudflare Pages (`*.pages.dev`),
      download + auto-update feed. Age gate.
- [ ] **Hardening.** 18+ gate on first run, strict CSP, per-source rate limiting,
      source-health checks, crash reporting.

## Known constraints / risks

- **TLS stack matters for Cloudflare-fronted sources.** RedGifs sits behind
  Cloudflare with a TLS renegotiation / client-cert step that **system Node 24's
  OpenSSL rejects** (`access_denied`), while browsers, `curl` (schannel), and
  **Electron's Chromium `net.fetch` all succeed**. That's why sources fetch via the
  injected Chromium `net.fetch`, never Node's global fetch. (A real per-user network
  filter could still block adult domains — an optional built-in proxy/VPN setting is a
  later nice-to-have, not a current blocker.)
- **Tube-site scraping breaks often** and violates ToS. RedGifs/Reddit/torrents are
  the stable foundations; treat tube sources as best-effort.
- **Showcase-site deploy needs Cloudflare credentials.** Deploying to Cloudflare Pages
  (M7) requires a Cloudflare API token / Wrangler login — set that up before M7.

## Compliance stance

Legal adult content only. Age-gate on first launch (M7/Hardening). No user uploads in
early milestones (removes CSAM upload vector). If uploads are ever added: hash-matching
against known-bad lists + human review. The bundled CNN classifies porn/hentai/SFW —
it is **not** an age/CSAM detector and must not be relied on as one.
