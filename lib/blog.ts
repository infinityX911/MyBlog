// lib/blog.ts
// Blog data fetching — Prisma version
// Replaces blog's raw mysql2 lib/db.ts
// Uses admin panel's shared Prisma client (lib/prisma.ts)

import { prisma } from '@/lib/prisma'
import { sanitizePostHtml } from '@/lib/contentHtml'
import { unlinkUnpublished } from '@/lib/unlink-drafts'
import { getSiteSetting, normalizeUrl } from '@/lib/siteSettings'
import { cleanTitle } from '@/lib/seo/title'
import { robotsMeta } from '@/lib/seo/robots'

// ── Types ────────────────────────────────────────────────────────

export type Category = {
  id:         number
  name:       string
  slug:       string
  emoji:      string
  post_count: number
}

export type PostSeo = {
  focusKeyword:       string | null
  metaTitle:          string | null
  metaDescription:    string | null
  robotsIndex:        boolean
  robotsFollow:       boolean
  canonicalUrl:       string | null
  ogTitle:            string | null
  ogDescription:      string | null
  ogImage:            string | null
  twitterTitle:       string | null
  twitterDescription: string | null
  schemaType:         string | null
  schemaJson:         string | null
}

export type Post = {
  id:              number
  slug:            string
  title:           string
  excerpt:         string
  body:            string
  thumbnail_url:   string | null
  tag:             string
  category_id:     number
  category_name:   string
  category_slug:   string   // URL segment: primaryCategory.slug → first category → "uncategorized"
  category_emoji:  string
  thumb_class:     string
  gradient:        string | null
  date:            string
  // ISO strings — used by schema generator for datePublished / dateModified
  publishedAt:     string | null
  updatedAt:       string | null
  read_min:        number
  view_count:      number
  featured:        boolean
  published:       boolean
  seo:             PostSeo | null
}

// ── Helpers & Mappers ─────────────────────────────────────────────

const THUMB: Record<string, string> = {
  tech:    'thumb-tech',
  life:    'thumb-life',
  travel:  'thumb-travel',
  opinion: 'thumb-opinion',
  science: 'thumb-science',
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return ''
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  })
}

const POST_INCLUDE = {
  categories: {
    include: { category: true },
  },
  primaryCategory: true,
  seo: true,
} as const

// Static first-segments a category slug must never equal, or the /<cat>/<slug>
// post URL would collide with a real route. Used when resolving a post's URL.
export const RESERVED_CATEGORY_SLUGS = new Set([
  'posts', 'tag', 'downloads', 'contact', 'account', 'login', 'signup',
  'messages', 'notifications', 'u', 'verify-email', 'yt', 'admin', 'api',
  'sitemap.xml', 'robots.txt', 'feed.xml',
])

/** The canonical URL path for a post: /<primaryCategorySlug>/<slug>. Falls back
 *  to the first assigned category, then "uncategorized". */
export function postHref(p: Pick<Post, 'slug' | 'category_slug'>): string {
  return `/${p.category_slug}/${p.slug}`
}

function mapPost(p: any): Post {
  const firstCategory = p.categories?.[0]?.category
  // No category assigned → NO fabricated tag (was defaulting to 'tech', which
  // showed a tag the author never set). The thumb gradient still falls back.
  const tag           = firstCategory?.slug  ?? ''
  const emoji         = firstCategory?.emoji ?? '📝'
  const categoryName  = firstCategory?.name  ?? ''
  const categoryId    = firstCategory?.id    ?? 0
  const isPublished   = p.status === 'published'
  // URL segment for the post: primary category → first category → uncategorized.
  const categorySlug  = p.primaryCategory?.slug || firstCategory?.slug || 'uncategorized'

  return {
    id:              p.id,
    slug:            p.slug,
    title:           p.title,
    excerpt:         p.excerpt ?? '',
    // Sanitize only here (security). Outbound-link rel/target is applied at
    // RENDER time by the post page via addExternalLinkAttrs(..., settings base),
    // so we must NOT run it here with the env fallback (inkdrop.blog) — that
    // wrongly marked same-domain internal links as external → nofollow.
    body:            sanitizePostHtml(p.content ?? ''),
    thumbnail_url:   p.featuredImage ?? null,
    tag,
    category_id:     categoryId,
    category_name:   categoryName,
    category_slug:   categorySlug,
    category_emoji:  emoji,
    thumb_class:     p.featuredImage ? '' : (THUMB[tag] ?? 'thumb-tech'),
    gradient:        p.gradient ?? null,
    date:            formatDate(p.publishedAt ?? p.createdAt),
    // ISO dates for schema — datePublished and dateModified
    publishedAt:     (p.publishedAt ?? p.createdAt)?.toISOString().slice(0, 10) ?? null,
    updatedAt:       p.updatedAt?.toISOString().slice(0, 10) ?? null,
    read_min:        p.readMin ?? 5,
    view_count:      p.viewCount ?? 0,
    featured:        p.featured ?? false,
    published:       isPublished,
    seo:             p.seo ? {
      focusKeyword:       p.seo.focusKeyword,
      metaTitle:          p.seo.metaTitle,
      metaDescription:    p.seo.metaDescription,
      robotsIndex:        p.seo.robotsIndex,
      robotsFollow:       p.seo.robotsFollow,
      canonicalUrl:       p.seo.canonicalUrl,
      ogTitle:            p.seo.ogTitle,
      ogDescription:      p.seo.ogDescription,
      ogImage:            p.seo.ogImage,
      twitterTitle:       p.seo.twitterTitle,
      twitterDescription: p.seo.twitterDescription,
      schemaType:         p.seo.schemaType,
      schemaJson:         p.seo.schemaJson,
    } : null,
  }
}

// ── Data Fetching Functions ──────────────────────────────────────

// Fetch all PUBLISHED posts (homepage / tag filter)
export async function getPosts(tag?: string): Promise<Post[]> {
  const posts = await prisma.post.findMany({
    where: {
      status: 'published',
      ...(tag
        ? {
            categories: {
              some: {
                category: { slug: tag },
              },
            },
          }
        : {}),
    },
    include: POST_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })

  return posts.map(mapPost)
}

// Fetch single post by slug
export async function getPostBySlug(
  slug: string,
  opts?: { includeUnpublished?: boolean; skipLinkCheck?: boolean },
): Promise<Post | null> {
  const post = await prisma.post.findFirst({
    // Preview mode (admins only): drop the published-only filter so drafts render.
    where: opts?.includeUnpublished ? { slug } : { slug, status: 'published' },
    include: POST_INCLUDE,
  })

  if (!post) return null
  const mapped = mapPost(post)

  // A lesson links forward to the next lesson, which is usually still a draft
  // when this one goes live. Rather than ship a 404, render that link as plain
  // text until its target is published — then it becomes a link again by
  // itself. Preview mode skips this so an editor reviewing drafts can still
  // click through the chain.
  // `skipLinkCheck` is for callers that only need the row's metadata and throw
  // the body away — the legacy /posts/<slug> redirect, for one. Scanning links
  // there costs a query per hit and nothing ever reads the result.
  if (opts?.includeUnpublished || opts?.skipLinkCheck) return mapped
  return { ...mapped, body: await unlinkUnpublished(mapped.body) }
}

// Fetch featured posts
export async function getFeaturedPosts(): Promise<Post[]> {
  const posts = await prisma.post.findMany({
    where: { status: 'published', featured: true },
    include: POST_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 3,
  })

  return posts.map(mapPost)
}

/** A post needs at least this many views in the window to count as trending. */
export const TRENDING_MIN_VIEWS = 5
/** Below this many qualifying posts the widget is not worth showing at all. */
export const TRENDING_MIN_POSTS = 3

// Fetch trending posts = MOST VIEWS IN THE LAST 7 DAYS. Real trending only:
// a post must clear TRENDING_MIN_VIEWS inside the window, and if fewer than
// TRENDING_MIN_POSTS clear it this returns [] so callers can hide the widget.
//
// There used to be a step 3 here that topped the list up from all-time
// viewCount whenever recent activity was thin, "so the list is never empty on
// a quiet week or a fresh blog". The intent was fine, the effect was not: it
// ran unconditionally, and every caller asks for 4. On a five-post blog that
// turned "Trending" into "four of our five posts, ordered by all-time views" —
// a post published minutes ago with a single view ranked first. A label that
// is always populated regardless of the data is not telling the reader
// anything. An empty sidebar slot is better than a dishonest one.
export async function getTrendingPosts(limit = 4): Promise<Post[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago

  // Rank posts by how many views they got in the last 7 days, keeping only
  // those above the floor. Prisma cannot filter on _count in groupBy, so the
  // threshold is applied after the aggregate comes back.
  const recent = await prisma.postView.groupBy({
    by: ['postId'],
    where: { createdAt: { gte: since } },
    _count: { postId: true },
    orderBy: { _count: { postId: 'desc' } },
    take: limit * 3, // over-fetch: some may be unpublished/deleted
  })
  const recentIds = recent
    .filter((r) => r._count.postId >= TRENDING_MIN_VIEWS)
    .map((r) => r.postId)

  if (!recentIds.length) return []

  // Load those posts (published only) and keep the trending order.
  const publishedRecent = await prisma.post.findMany({
    where: { id: { in: recentIds }, status: 'published' },
    include: POST_INCLUDE,
  })
  const result = recentIds
    .map((id) => publishedRecent.find((p) => p.id === id))
    .filter(Boolean)
    .slice(0, limit) as typeof publishedRecent

  // Two lonely entries under a "Trending" heading read as an empty room.
  if (result.length < TRENDING_MIN_POSTS) return []

  return result.map(mapPost)
}

// Fetch all categories with post count
export async function getCategories(): Promise<Category[]> {
  const categories = await prisma.category.findMany({
    include: {
      posts: {
        where: {
          post: { status: 'published' },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return categories.map(c => ({
    id:         c.id,
    name:       c.name,
    slug:       c.slug,
    emoji:      (c as any).emoji ?? '📝',
    post_count: c.posts.length,
  }))
}

// Fetch related posts (same category, exclude current)
export async function getRelatedPosts(slug: string, limit = 3): Promise<Post[]> {
  const current = await prisma.post.findFirst({
    where: { slug },
    include: { categories: true },
  })
  if (!current) return []

  const categoryIds = current.categories.map(c => c.categoryId)

  const posts = await prisma.post.findMany({
    where: {
      status: 'published',
      slug:   { not: slug },
      categories: {
        some: { categoryId: { in: categoryIds } },
      },
    },
    include: POST_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })

  return posts.map(mapPost)
}

// Build generateMetadata object for Next.js
export async function buildPostMetadata(slug: string) {
  const post = await getPostBySlug(slug)
  if (!post) return {}

  const seo         = post.seo
  // Use || (not ??) so an EMPTY string from the SEO panel falls back to the
  // post's own title/excerpt — otherwise a blank metaTitle yields an empty
  // <title> tag (just "| SiteName").
  const setting     = await getSiteSetting('blog')
  // cleanTitle() strips a brand suffix an editor typed into the SEO panel
  // ("… | Flow's Blog"), because the layout's title template appends it anyway.
  // A title without the suffix passes through untouched.
  const title       = cleanTitle(seo?.metaTitle || post.title, setting?.siteName)
  const description = seo?.metaDescription || post.excerpt
  const ogImage     = seo?.ogImage         || post.thumbnail_url || undefined

  // Canonical URL: prefer the value stored in the SEO panel, otherwise build a
  // self-referencing canonical from the site's base URL (Admin → Settings, with
  // the NEXT_PUBLIC_SITE_URL / inkdrop.blog fallback). Every post now emits a
  // correct canonical pointing at itself instead of inheriting the homepage.
  const base        = normalizeUrl(setting?.websiteUrl || process.env.NEXT_PUBLIC_SITE_URL)
  // Category-siloed canonical: /<primaryCategory.slug>/<slug>. A stored SEO
  // canonical still wins.
  const canonicalUrl = seo?.canonicalUrl?.trim() || `${base}/${post.category_slug}/${slug}`;

  return {
    title,
    description,
    keywords: seo?.focusKeyword ? [seo.focusKeyword] : undefined,
    // Keeps max-image-preview:large — without it Google shows a tiny thumbnail
    // and Discover (Chrome's recommended articles) skips the post entirely.
    robots: robotsMeta(seo?.robotsIndex ?? true, seo?.robotsFollow ?? true),
    alternates: {
      canonical: canonicalUrl,
      // Keep RSS autodiscovery on post pages too (a page-level `alternates`
      // otherwise replaces the layout's, dropping the feed link).
      types: { 'application/rss+xml': [{ url: `${base}/feed.xml`, title: `${setting?.siteName || 'InkDrop'} RSS Feed` }] },
    },
    openGraph: {
      title:           cleanTitle(seo?.ogTitle || title, setting?.siteName),
      description:     seo?.ogDescription || description,
      type:            'article',
      url:             canonicalUrl,
      ...(setting?.siteName ? { siteName: setting.siteName } : {}),
      publishedTime:   post.publishedAt ?? undefined,
      modifiedTime:    post.updatedAt   ?? undefined,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card:        'summary_large_image' as const,
      title:       cleanTitle(seo?.twitterTitle || title, setting?.siteName),
      description: seo?.twitterDescription || description,
      // The post's featured image, not the global site logo.
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}
