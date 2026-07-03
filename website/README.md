# Peachwhip showcase site

A static, no-build showcase page (age gate + features + download link to GitHub
Releases). Deploy to **Cloudflare Pages** — no domain needed, you get a free
`*.pages.dev` subdomain.

## Deploy (Cloudflare Pages, no build)

Option A — dashboard:
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Pick the `Ahleyrie/Peachwhip` repo.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `website`
4. Deploy. You'll get `https://<project>.pages.dev`.

Option B — Wrangler CLI:
```bash
npx wrangler pages deploy website --project-name peachwhip
```

## Edit
It's plain `index.html` + `style.css` + `logo.png`. The download button points at
`https://github.com/Ahleyrie/Peachwhip/releases` — update if you move hosting.
