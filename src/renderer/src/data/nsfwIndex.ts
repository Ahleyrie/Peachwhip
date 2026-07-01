// Curated NSFW resource index. Seeded from the Wotaku wiki's nsfw page
// (github.com/wotakumoe/Wotaku) plus Peachwhip's own additions ("& more").
// Static data — links open in the system browser. Third-party sites; use responsibly.

export interface IndexEntry {
  name: string
  url: string
  note?: string
}

export interface IndexSection {
  title: string
  icon: string
  entries: IndexEntry[]
}

export const NSFW_INDEX: IndexSection[] = [
  {
    title: 'Hentai Anime',
    icon: '🎬',
    entries: [
      { name: 'Hanime.tv', url: 'https://hanime.tv/', note: 'HD' },
      { name: 'Hanime1', url: 'https://hanime1.me/', note: 'JP/CN' },
      { name: 'Hentai.tv', url: 'https://hentai.tv/' },
      { name: 'HStream', url: 'https://hstream.moe/', note: 'upscaled' },
      { name: 'Oppai Stream', url: 'https://oppai.stream/', note: 'upscaled' },
      { name: 'Hentai Mama', url: 'https://hentaimama.io/' },
      { name: 'Hentai Ocean', url: 'https://hentaiocean.com/' },
      { name: 'Haho', url: 'https://haho.moe/' },
      { name: 'HenVids', url: 'https://henvids.com/' },
      { name: 'Rule34Video', url: 'https://rule34video.com/' }
    ]
  },
  {
    title: 'Manga & Doujin',
    icon: '📚',
    entries: [
      { name: 'nHentai', url: 'https://nhentai.net/', note: 'in Peachwhip' },
      { name: 'E-Hentai', url: 'https://e-hentai.org/' },
      { name: 'Hitomi.la', url: 'https://hitomi.la/' },
      { name: 'IMHentai', url: 'https://imhentai.xxx/' },
      { name: 'HDoujin', url: 'https://hdoujin.org/' },
      { name: 'Akuma', url: 'https://akuma.moe/' },
      { name: 'Schale Network', url: 'https://shupogaki.moe/' },
      { name: 'Yabai', url: 'https://yabai.si/' },
      { name: 'HentaiFox', url: 'https://hentaifox.com/', note: 'EN' },
      { name: 'Hentai Nexus', url: 'https://hentainexus.com/', note: 'EN' },
      { name: 'HentaiRead', url: 'https://hentairead.com/', note: 'EN' },
      { name: 'Wholesome List', url: 'https://wholesomelist.com/', note: 'curated' }
    ]
  },
  {
    title: 'Manhwa / Pornhwa',
    icon: '🇰🇷',
    entries: [
      { name: 'Toonily', url: 'https://toonily.com/' },
      { name: 'Hiperdex', url: 'https://hiperdex.com/' },
      { name: 'Manga18fx', url: 'https://manga18fx.com/' },
      { name: 'ManhwaRead', url: 'https://manhwaread.com/' },
      { name: 'HotComics', url: 'https://w1.hotcomics.me/' },
      { name: 'Atsumaru', url: 'https://atsu.moe/' },
      { name: 'Kagane', url: 'https://kagane.org/' },
      { name: 'Manga District', url: 'https://mangadistrict.com/' },
      { name: 'PornhwaDB', url: 'https://pornhwadb.com/', note: 'database' }
    ]
  },
  {
    title: 'Illustrations & Boorus',
    icon: '🖼️',
    entries: [
      { name: 'Danbooru', url: 'https://danbooru.donmai.us/' },
      { name: 'Gelbooru', url: 'https://gelbooru.com/' },
      { name: 'Rule34.xxx', url: 'https://rule34.xxx/' },
      { name: 'Konachan', url: 'https://konachan.com/' },
      { name: 'yande.re', url: 'https://yande.re/' },
      { name: 'Nozomi.la', url: 'https://nozomi.la/' },
      { name: 'Pixiv', url: 'https://www.pixiv.net/' },
      { name: 'Oreno3D', url: 'https://oreno3d.com/', note: '3D' }
    ]
  },
  {
    title: 'Gifs & Clips',
    icon: '📺',
    entries: [
      { name: 'RedGifs', url: 'https://www.redgifs.com/', note: 'in Peachwhip' },
      { name: 'Reddit NSFW', url: 'https://www.reddit.com/r/nsfw/', note: 'in Peachwhip' },
      { name: 'Pornhub', url: 'https://www.pornhub.com/', note: 'in Peachwhip' },
      { name: 'xVideos', url: 'https://www.xvideos.com/', note: 'in Peachwhip' },
      { name: 'RedTube', url: 'https://www.redtube.com/', note: 'in Peachwhip' },
      { name: 'SpankBang', url: 'https://spankbang.com/' },
      { name: 'Coomer', url: 'https://coomer.su/', note: 'OF archive' },
      { name: 'Kemono', url: 'https://kemono.su/', note: 'paysite archive' }
    ]
  },
  {
    title: 'Adult Video (JAV)',
    icon: '🎌',
    entries: [
      { name: 'MissAV', url: 'https://missav.ws/' },
      { name: 'Jav Guru', url: 'https://jav.guru/' },
      { name: 'JAVGG', url: 'https://javgg.net/' },
      { name: 'JAVSeen', url: 'https://javseen.tv/' },
      { name: 'SexTB', url: 'https://sextb.net/' },
      { name: 'OneJAV', url: 'https://onejav.com/', note: 'torrent' },
      { name: 'Sukebei (Nyaa)', url: 'https://sukebei.nyaa.si/', note: 'torrent' }
    ]
  },
  {
    title: 'Games',
    icon: '🎮',
    entries: [
      { name: 'DLsite', url: 'https://www.dlsite.com/', note: 'legal store' },
      { name: 'FAKKU', url: 'https://www.fakku.net/', note: 'legal store' },
      { name: 'MangaGamer', url: 'https://www.mangagamer.com/', note: 'legal store' },
      { name: 'JAST USA', url: 'https://jastusa.com/', note: 'legal store' },
      { name: 'F95Zone', url: 'https://f95zone.to/', note: 'account' },
      { name: 'Kimochi', url: 'https://kimochi.info/' },
      { name: 'Eroge Download', url: 'https://erogedownload.com/' }
    ]
  },
  {
    title: 'ASMR & Audio',
    icon: '🎧',
    entries: [
      { name: 'ASMR One', url: 'https://asmr.one/' },
      { name: 'Hentai ASMR', url: 'https://www.hentaiasmr.moe/' },
      { name: 'Japanese ASMR', url: 'https://japaneseasmr.com/' }
    ]
  },
  {
    title: 'Databases & Info',
    icon: '🗂️',
    entries: [
      { name: 'DojinDB', url: 'https://dojindb.net/' },
      { name: 'Doujinshi.info', url: 'https://www.doujinshi.info/' },
      { name: 'Manga-DB', url: 'https://adultcomic.dbsearch.net/' },
      { name: 'Fapservice', url: 'https://fapservice.com/', note: 'ero-anime info' },
      { name: 'Yuri Scenes', url: 'https://yuriscenes.com/' }
    ]
  },
  {
    title: 'Apps & Tools',
    icon: '🛠️',
    entries: [
      { name: 'Jasmine', url: 'https://github.com/ComicSparks/jasmine', note: 'comic app' },
      { name: 'Hentoid', url: 'https://codeberg.org/VioletKnight/Hentoid', note: 'Android' },
      { name: 'JHenTai', url: 'https://github.com/jiangtian616/JHenTai' },
      { name: 'EhViewer', url: 'https://github.com/FooIbar/EhViewer', note: 'Android' },
      { name: 'NClientV3', url: 'https://github.com/maxwai/NClientV3', note: 'nHentai' },
      { name: 'HDoujin Downloader', url: 'https://doujindownloader.com/' },
      { name: 'nHentai Archivist', url: 'https://github.com/9-FS/nhentai_archivist' }
    ]
  }
]
