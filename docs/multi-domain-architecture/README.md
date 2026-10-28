# Multi-Domain Architecture — Implementation Strategy

Reference implementation for serving **blogdomain.com** (blog) and **ytdownloader.com**
(YT downloader) from the single Next.js 16 container + MySQL container on your VPS,
with the centralized `/admin` panel, per-site SEO config, CMS pages, and the universal
real-time SEO Panel.

Every file in this folder is production-ready code aligned with your **actual** codebase
(Next 16.2.6, `proxy.ts` default export, Prisma 7 + driverAdapters, next-auth v4,
Tailwind v4 via `@tailwindcss/postcss`, custom `server.js` + Socket.io).

---

## 0. Critical pre-flight: fix `app/(yt-downloader)` first

**Nothing else works until this is done.** Right now `app/(yt-downloader)` contains an
entire *nested Next.js project* (own `package.json`, `node_modules/`, `tailwind.config.ts`,
`prisma/`, `next.config.ts`), and its pages live at `app/(yt-downloader)/app/about/...`.
Next.js will never route those — a route group is just a folder whose name is erased from
the URL, not a sub-application.

There is also a second architectural fact that shapes the whole design:

> **You cannot rewrite "into" a route group.** Route groups don't exist in URL space.
> If `(blog)/page.tsx` and `(yt-downloader)/page.tsx` both existed, the build fails with
> *"two parallel pages resolve to the same path"* — both claim `/`. So multi-domain
> mapping needs a **real URL segment per secondary site**, hidden from visitors via
> middleware rewrites (rewrites never change the address bar).

### Target tree

```
app/
├── (blog)/                  ← unchanged. The DEFAULT site, served at root paths.
│   ├── posts/[slug]/ …
│   └── layout.tsx           ← imports blog CSS only
├── (yt-downloader)/         ← route group kept for layout/styling isolation…
│   └── yt/                  ← …wrapping ONE real segment: the internal rewrite target
│       ├── layout.tsx       ← downloader shell; imports downloader CSS only
│       ├── page.tsx         ← ytdownloader.com/  →  internally /yt
│       ├── robots.txt/route.ts      (file 06)
│       ├── sitemap.xml/route.ts     (file 07)
│       └── [...slug]/page.tsx       (file 11 — ALL CMS pages: /about, /privacy, …)
├── admin/                   ← unchanged. Reached as /admin on ANY mapped host.
└── api/                     ← shared APIs
```

Migration steps:

1. `git mv "app/(yt-downloader)" _incoming-yt` (park it outside `app/` so the build stops seeing it).
2. Create `app/(yt-downloader)/yt/` and move ONLY UI code across:
   `layout.tsx`, `page.tsx`, `Header/Footer/ToolForm` components (or move those into
   `components/yt/`), and the `globals.css`.
3. **Delete** from the parked copy: `node_modules/`, `package.json`, `package-lock.json`,
   `next.config.ts`, `tsconfig.json`, `prisma/`, `files.zip`. One repo = one toolchain.
   Any deps the tool needs get added to the ROOT `package.json`.
4. Do **not** recreate `about/ contact/ privacy/ disclaimer/` as static folders — they
   become `CmsPage` rows rendered by the `[...slug]` catch-all (file 11). That is what
   makes "any newly created dynamic text page" work with zero deploys.
5. Delete the stale `app/mytube2/` build artifacts while you're here.

### Tailwind isolation (accurate for YOUR versions)

- Root project = **Tailwind v4** (`@tailwindcss/postcss ^4`). In v4 there is no
  `tailwind.config.ts` `prefix` option; the prefix is declared in CSS and the class
  syntax is `tw:flex`, not `tw-flex`:

  ```css
  /* app/(yt-downloader)/yt/styles/tool.css */
  @import "tailwindcss" prefix(tw);
  /* usage in JSX: className="tw:flex tw:items-center tw:bg-red-600" */
  ```

- The nested project you're deleting used Tailwind **v3** (`prefix: 'tw-'` → `tw-flex`).
  When porting its markup, run a find/replace `tw-` → `tw:`.
- Isolation rule: **each route-group `layout.tsx` imports its own CSS entry and nothing
  else.** The prefix guarantees Tailwind utilities can't collide with the blog's
  Bootstrap/MUI classes; the per-layout import guarantees the downloader CSS is never
  even shipped on blog pages (and vice versa).

---

## 1. Deliverables map

| # | File | Deploys to | Deliverable |
|---|------|-----------|-------------|
| 01 | `01-proxy.ts` | `proxy.ts` (replaces existing — your RBAC gate is merged in) | Multi-domain rewrites + admin/API auth |
| 02 | `02-schema-additions.prisma` | merge into `prisma/schema.prisma` | `SiteType`, evolved `SiteSetting`, `CmsPage`, isolation pattern |
| 03 | `03-lib-site-context.ts` | `lib/site-context.ts` | Host → Site resolver (cached, tag-revalidated) |
| 04 | `04-lib-reserved-slugs.ts` | `lib/reserved-slugs.ts` | CMS-slug vs system-path conflict guard |
| 05 | `05-generate-metadata-examples.tsx` | per layout/page | `generateMetadata` wired to `SiteSetting`/`PageSeo`/`CmsPage` |
| 06 | `06-robots-route.ts` | `app/robots.txt/route.ts` + `app/(yt-downloader)/yt/robots.txt/route.ts` | Per-domain robots.txt |
| 07 | `07-sitemap-route.ts` | `app/sitemap.xml/route.ts` + `app/(yt-downloader)/yt/sitemap.xml/route.ts` | Per-domain sitemap.xml |
| 08 | `08-seo-engine.ts` | `lib/seo/engine.ts` | Universal `SeoSubject` adapter over your existing `lib/seo/scoring.ts` |
| 09 | `09-seo-save-api.ts` | e.g. `app/api/cms-pages/[id]/route.ts` | Server-side score recompute + sanitized persistence |
| 10 | `10-safe-html.tsx` | `components/SafeHtml.tsx` | XSS-safe rendering of CMS markup |
| 11 | `11-cms-catch-all-page.tsx` | `app/(yt-downloader)/yt/[...slug]/page.tsx` | CMS page renderer + metadata |

## 2. Rollout order (each step independently deployable)

1. **Restructure** `(yt-downloader)` (section 0). Deploy — blog unaffected, `/yt` now renders.
2. **Schema**: merge file 02, `npx prisma migrate dev -n multi_site`, seed the two
   `SiteSetting` rows (`blog`, `yt`) with domains. Non-breaking: every added column is
   nullable/defaulted, so the existing admin Settings panel keeps working untouched.
3. **Proxy**: ship file 01 with `SITE_DOMAIN_MAP` env. Test with
   `curl -H "Host: ytdownloader.com" http://localhost:3000/` → downloader home,
   address bar semantics preserved (it's a rewrite, not a redirect).
4. **Metadata + sitemaps/robots**: files 03–07. Delete old root `app/robots.ts` /
   `app/sitemap.ts` (replaced by host-aware route handlers).
5. **SEO engine**: files 08–11 + the small generalization patch to `scoring.ts`
   described in file 08's header.
6. **Verify** (section 4).

## 3. Infrastructure notes (VPS / Docker / Nginx)

- Both domains' DNS → same VPS IP. Nginx: one `server` block per domain (own certs via
  certbot), all proxying to the SAME upstream `next:3000`, forwarding `Host` untouched:
  `proxy_set_header Host $host;` — the proxy.ts mapping depends on this header.
  Keep your existing WebSocket upgrade headers (server.js comment) on both blocks.
- `SITE_DOMAIN_MAP` lives in the container env → domain changes are a restart,
  not a rebuild. (Optionally move the map to DB later; keep proxy.ts DB-free — it runs
  on every request.)
- One MySQL container, one database. Isolation is row-level via `siteSettingId`
  scoping enforced by a Prisma client extension (file 02, part D) — not separate DBs.

## 4. Verification checklist

```bash
npx prisma validate && npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma
curl -sH "Host: blogdomain.com"    localhost:3000/robots.txt   # blog rules
curl -sH "Host: ytdownloader.com"  localhost:3000/robots.txt   # downloader rules
curl -sH "Host: ytdownloader.com"  localhost:3000/sitemap.xml  # only yt URLs
curl -sH "Host: blogdomain.com"    localhost:3000/yt/anything  # 404 (leak guard)
curl -sH "Host: ytdownloader.com"  localhost:3000/admin        # login redirect (RBAC intact)
```
