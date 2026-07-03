# Peachwhip — build progress

Tracking the accepted ideas (see ACCEPTED_IDEAS.md). ✅ = shipped, 🟡 = partial.
Everything below builds, boots, and is pushed. Adult sources are unverified on the
dev network (adult-domain filter) but the code is in place.

## Shipped this pass

**Core app** — Electron + React + TS, unified source core, self-updater, GitHub
Actions installer, logo theme.

**Sources**
- ✅ RedGifs, Reddit (login), Tube (Pornhub/xVideos/RedTube/YouPorn/Eporner)
- ✅ Boorus (Rule34/Gelbooru/Danbooru), Torrents (Sukebei) + WebTorrent streaming
- ✅ Comics: nhentai + JMComic (experimental, with AES + image de-scramble)
- ✅ NSFW Index (curated directory)

**Player** — ✅ speed, loop, rotate/mirror, PiP, screenshot, prev/next, auto-advance,
remember position, remember volume, mute-default, keyboard shortcuts, media keys,
background audio.

**Reader** — ✅ continuous/paged, RTL, fit modes, resume, progress, jump-to-page,
brightness, fullscreen, auto-scroll, chapter nav, detail view with tag chips.

**Pies (favorites)** — ✅ rename to Pies, History, Watch-later, filter, hide-seen,
right-click menu, toasts.

**Settings / theming** — ✅ warm/light/AMOLED, accent presets, font scale, radius,
grid columns, compact, list view, reduced motion, background image; autoplay,
mute-default, hover-preview, glance blur, confirm-external, data saver, per-source
enable/disable, remember last tab, clear cache, export/import/reset settings.

**Privacy** — ✅ PIN lock, panic hotkey (Ctrl+Shift+H), blur-on-blur, incognito,
erase-all-data. Discovery — ✅ surprise/random, back-to-top.

## Still on the list (next passes)
- **Downloads & offline** (105–120) — whole subsystem: queue, offline library, CBZ/PDF.
- **More sources** — Hitomi, E-Hentai, Pixiv, Hanime, Coomer/Kemono, SpankBang,
  Motherless, iwara, Twitter/Bluesky, Multporn; plugin/source-pack system.
- **Collections** — named collections, tags/notes/ratings on items, smart collections.
- **Reddit extras** — multireddit builder, save/upvote, comments viewer, subs sidebar.
- **Discovery** — For-You feed, trending dashboard, continue row, recommendations,
  duration/sort filters, arrow-key grid nav.
- **Search** — history, autocomplete, saved searches, tag include/exclude, command palette.
- **Perf/reliability** — disk thumb cache, retry-with-backoff, mirror failover,
  offline detection, health screen.
- **UI** — onboarding, skeletons, per-tab colors, reorderable tabs, remember window
  size, seasonal themes; localization; stats dashboard.
- **Privacy** — proxy/Tor/DoH, tray/hide-from-taskbar, decoy password, tracker blocking.

These are larger or need live-source verification; they're queued for the next pass.
