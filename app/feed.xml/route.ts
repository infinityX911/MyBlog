// app/feed.xml/route.ts → served at /feed.xml
//
// RSS 2.0 feed of published posts. Helps readers + aggregators subscribe and
// improves content discovery/SEO. Linked from the document <head> via the
// layout's metadata.alternates.types['application/rss+xml'].

import { getPosts } from '@/lib/blog'
import { getSiteSetting, normalizeUrl } from '@/lib/siteSettings'

export const dynamic = 'force-dynamic'

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET() {
  const setting = await getSiteSetting('blog')
  const base = normalizeUrl(setting?.websiteUrl || process.env.NEXT_PUBLIC_SITE_URL)
  const siteName = setting?.siteName || 'InkDrop'
  const description =
    setting?.description || setting?.defaultMetaDescription || 'Latest posts from the blog.'

  let posts: Awaited<ReturnType<typeof getPosts>> = []
  try {
    posts = await getPosts()
  } catch {
    posts = []
  }

  const items = posts
    .map((p) => {
      const url = `${base}/${p.category_slug}/${p.slug}`
      const pub = p.publishedAt ? new Date(p.publishedAt).toUTCString() : new Date().toUTCString()
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <description><![CDATA[${p.excerpt ?? ''}]]></description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(siteName)}</title>
    <link>${base}</link>
    <description>${esc(description)}</description>
    <language>en</language>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
