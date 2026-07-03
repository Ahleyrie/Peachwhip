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

**Downloads** — ✅ stream video/image to disk with progress, offline library
(Downloads sub-tab), local playback via pwfile://, open-folder, download toast.

**Search & UX** — ✅ Ctrl+K command palette, recent-search suggestions, client-side
sort (views/longest/A–Z), onboarding, loading skeletons, stats panel, remember window
size/position. Reddit multireddit works today (type `sub1+sub2` in the search box).

## Still on the list (next passes)
- **More sources** — Hitomi, E-Hentai, Pixiv, Hanime, Coomer/Kemono, SpankBang,
  Motherless, iwara, Twitter/Bluesky, Multporn; plugin/source-pack system.
- **Collections** — named collections, drag-reorder, tags/notes/ratings, smart collections.
- **Reddit extras** — save/upvote/comments (need OAuth write scope), subs sidebar.
- **Discovery** — For-You mixed feed, trending dashboard, recommendations, duration filter,
  arrow-key grid nav.
- **Downloads refinements** — queue UI, pause/resume, CBZ/PDF export, throttle, auto-delete.
- **Perf/reliability** — disk thumb cache, retry-with-backoff, mirror failover, health screen.
- **UI** — per-tab colors, reorderable tabs, seasonal themes; localization.
- **Privacy** — proxy/Tor/DoH, tray/hide-from-taskbar, decoy password, tracker blocking.

Remaining items are mostly fragile scrapers (need live verification), external services,
or large niche systems (plugins, localization). Queued for the next pass.
