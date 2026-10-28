// lib/downloads.ts
// Downloads data fetching — Prisma version
// Same pattern as lib/blog.ts

import { prisma } from '@/lib/prisma'

// ── Types ────────────────────────────────────────────────────────

export type DownloadSeoData = {
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

export type Download = {
  id:            number
  title:         string
  slug:          string
  excerpt:       string
  content:       string
  fileUrl:       string
  fileType:      string
  fileSize:      string
  icon:          string
  gradient:      string
  image:         string | null
  category:      string
  tags:          string[]
  downloadCount: number
  featured:      boolean
  free:          boolean
  published:     boolean
  date:          string
  seo:           DownloadSeoData | null
}

// ── Helper ───────────────────────────────────────────────────────

function formatDate(date: Date | null | undefined): string {
  if (!date) return ''
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function mapDownload(d: any): Download {
  return {
    id:            d.id,
    title:         d.title,
    slug:          d.slug,
    excerpt:       d.excerpt ?? '',
    content:       d.content ?? '',
    fileUrl:       d.fileUrl,
    fileType:      d.fileType ?? 'PDF',
    fileSize:      d.fileSize ?? '',
    icon:          d.icon ?? '📄',
    gradient:      d.gradient ?? 'gradientPurple',
    image:         d.image ?? null,
    category:      d.category ?? 'Tech',
    tags:          d.tags ? d.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    downloadCount: d.downloadCount ?? 0,
    featured:      d.featured ?? false,
    free:          d.free ?? true,
    published:     d.status === 'published',
    date:          formatDate(d.publishedAt ?? d.createdAt),
    seo:           d.seo ? {
      focusKeyword:       d.seo.focusKeyword,
      metaTitle:          d.seo.metaTitle,
      metaDescription:    d.seo.metaDescription,
      robotsIndex:        d.seo.robotsIndex,
      robotsFollow:       d.seo.robotsFollow,
      canonicalUrl:       d.seo.canonicalUrl,
      ogTitle:            d.seo.ogTitle,
      ogDescription:      d.seo.ogDescription,
      ogImage:            d.seo.ogImage,
      twitterTitle:       d.seo.twitterTitle,
      twitterDescription: d.seo.twitterDescription,
      schemaType:         d.seo.schemaType,
      schemaJson:         d.seo.schemaJson,
    } : null,
  }
}

const DOWNLOAD_INCLUDE = { seo: true } as const

// ── Fetch all published downloads ────────────────────────────────

export async function getDownloads(category?: string): Promise<Download[]> {
  const downloads = await prisma.download.findMany({
    where: {
      status: 'published',
      ...(category ? { category } : {}),
    },
    include: DOWNLOAD_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })
  return downloads.map(mapDownload)
}

// ── Fetch featured download ──────────────────────────────────────

export async function getFeaturedDownload(): Promise<Download | null> {
  const d = await prisma.download.findFirst({
    where: { status: 'published', featured: true },
    include: DOWNLOAD_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })
  return d ? mapDownload(d) : null
}

// ── Fetch most downloaded (sidebar) ─────────────────────────────

export async function getPopularDownloads(limit = 4): Promise<Download[]> {
  const downloads = await prisma.download.findMany({
    where: { status: 'published' },
    include: DOWNLOAD_INCLUDE,
    orderBy: { downloadCount: 'desc' },
    take: limit,
  })
  return downloads.map(mapDownload)
}

// ── Fetch download categories with counts ────────────────────────

export async function getDownloadCategories() {
  const results = await prisma.download.groupBy({
    by: ['category'],
    where: { status: 'published' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })

  const EMOJI: Record<string, string> = {
    Tech: '💻', Life: '🌿', Travel: '✈️',
    Science: '🔬', Opinion: '💬',
  }

  return results.map(r => ({
    name:  r.category ?? 'Other',
    emoji: EMOJI[r.category ?? ''] ?? '📁',
    count: r._count.id,
  }))
}

// ── Increment download count ─────────────────────────────────────

export async function getDownloadBySlug(slug: string): Promise<Download | null> {
  const d = await prisma.download.findUnique({
    where: { slug },
    include: DOWNLOAD_INCLUDE,
  })
  if (!d || d.status !== 'published') return null
  return mapDownload(d)
}

export async function incrementDownloadCount(slug: string) {
  await prisma.download.update({
    where: { slug },
    data: { downloadCount: { increment: 1 } },
  })
}

// ── Build metadata for downloads page (global) ───────────────────

export async function buildDownloadsMetadata() {
  try {
    const { getSiteSetting, getPageSeo } = await import('@/lib/siteSettings')
    const setting = await getSiteSetting('blog')
    // Per-page SEO override from Admin → Settings → Per-Page SEO ('/downloads').
    const seo = await getPageSeo('blog', '/downloads')
    const { cleanTitle } = await import('@/lib/seo/title')
    const siteName = setting?.siteName || 'Flow’s Blog'
    // The layout's title template appends " | <siteName>", so neither the saved
    // meta title nor our own default may carry the brand itself — otherwise the
    // page renders "Downloads — Flow's Blog | Flow's Blog".
    const title = cleanTitle(seo?.metaTitle || `Downloads — ${siteName}`, siteName)
    const description = seo?.metaDescription
      || setting?.defaultMetaDescription
      || 'Free resources, templates, cheat sheets, and tools.'
    const image = seo?.ogImage || setting?.ogImage || undefined
    return {
      title,
      description,
      robots: (await import('@/lib/seo/robots')).robotsMeta(
        seo?.robotsIndex ?? setting?.defaultRobotsIndex ?? true,
        seo?.robotsFollow ?? setting?.defaultRobotsFollow ?? true,
      ),
      alternates: { canonical: seo?.canonicalUrl || '/downloads' },
      openGraph: {
        type:        'website' as const,
        title:       cleanTitle(seo?.ogTitle || title, siteName),
        description: seo?.ogDescription || description,
        siteName,
        ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: {
        card:        'summary_large_image' as const,
        title:       cleanTitle(seo?.ogTitle || title, siteName),
        description: seo?.ogDescription || description,
        ...(image ? { images: [image] } : {}),
      },
    }
  } catch {
    return {
      title: 'Downloads',
      description: 'Free resources, templates, cheat sheets, and tools.',
    }
  }
}
