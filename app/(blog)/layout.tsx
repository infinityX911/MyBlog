// app/(blog)/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Sora, Lora } from 'next/font/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSiteSetting, normalizeUrl } from '@/lib/siteSettings'
import { getIntegrations } from '@/lib/integrations'
import { getFooterConfig } from '@/lib/footer'
import { getNavItems } from '@/lib/nav'
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css'
import SessionProviderWrapper from '@/components/SessionProviderWrapper'
import { Suspense } from 'react'
import AccessDeniedToast from '@/components/AccessDeniedToast'
import { MessagingProvider } from '@/context/MessagingContext'
import { SiteBrandProvider } from '@/context/SiteBrandContext'
import FloatingChats from '@/components/messaging/FloatingChats'
import SupportWidget from '@/components/support/SupportWidget'
import AdsLoader from '@/components/ads/AdsLoader'
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'

// ── Fonts ──────────────────────────────────────────────────────────────────
const sora = Sora({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
})

// ── Site-wide SEO metadata — generated from Admin → Settings (DB) ───────────
// Everything below is driven by the saved "blog" site settings, so the admin
// controls title, description, keywords, OG/Twitter, favicon and robots
// without touching code. Hardcoded values are used only as a fallback when no
// settings row exists yet.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSetting('blog')
  const gsc = (await getIntegrations()).analytics.gscVerification

  const siteName    = s?.siteName || 'InkDrop'
  const baseUrl     = normalizeUrl(s?.websiteUrl)
  const sep         = s?.titleSeparator || '|'
  const defaultTitle = s?.defaultMetaTitle || `${siteName} — A Blog for Everything`
  const description = s?.defaultMetaDescription
    || s?.description
    || 'A free blog platform. Write about technology, life, travel, opinions, and science.'
  const ogImage     = s?.ogImage || '/og-image.png'
  const favicon     = s?.siteIcon || '/favicon.ico'
  const keywords    = (s?.metaKeywords || 'blog, writing, tech, life, travel, opinion, science')
    .split(',').map(k => k.trim()).filter(Boolean)
  const twitter     = s?.twitterHandle || undefined

  return {
    metadataBase: new URL(baseUrl),
    title: { default: defaultTitle, template: `%s ${sep} ${siteName}` },
    description,
    keywords,
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    icons: { icon: favicon, shortcut: favicon, apple: favicon },
    robots: {
      index: s?.defaultRobotsIndex ?? true,
      follow: s?.defaultRobotsFollow ?? true,
      googleBot: {
        index: s?.defaultRobotsIndex ?? true,
        follow: s?.defaultRobotsFollow ?? true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: baseUrl,
      siteName,
      title: defaultTitle,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description,
      images: [ogImage],
      ...(twitter ? { creator: twitter, site: twitter } : {}),
    },
    // NOTE: no site-wide `alternates.canonical` here. Setting it in the root
    // layout leaks the homepage URL as the canonical of EVERY child page
    // (posts, tags, etc.), telling Google they're duplicates of the home page.
    // Each page now declares its own self-referencing canonical instead.
    alternates: {
      types: {
        'application/rss+xml': [{ url: `${baseUrl}/feed.xml`, title: `${siteName} RSS Feed` }],
      },
    },
    // Google Search Console "HTML tag" verification (renders
    // <meta name="google-site-verification" ...>). Admin-set (DB → env fallback).
    ...(gsc ? { verification: { google: gsc } } : {}),
  }
}

export async function generateViewport(): Promise<Viewport> {
  const s = await getSiteSetting('blog')
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: s?.themeColor || '#5b4fcf',
  }
}

// ── Root Layout ────────────────────────────────────────────────────────────
export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch session server-side so SessionProvider gets it instantly —
  // avoids the client-side loading flash on navigation.
  const session = await getServerSession(authOptions)
  const gaId = (await getIntegrations()).analytics.measurementId

  // ── JSON-LD structured data (Organization + WebSite) ──────────────────────
  // Helps Google understand the site identity, enables the sitelinks search
  // box, and is a baseline for rich results. Driven by the saved settings.
  const s = await getSiteSetting('blog')
  // Features switched off in Admin → Settings should not stay in the menu. The
  // toggle used to gate only the data API, so /announcements and /members kept a
  // link on every page of the site pointing at "not available right now" — bad
  // for the reader, and it spent internal link equity on a dead end. Filtered
  // here rather than in the nav editor so the two settings can't drift apart.
  const disabledPaths = new Set<string>([
    ...(s?.announcementsEnabled ? [] : ['/announcements']),
    ...(s?.membersEnabled ? [] : ['/members']),
  ])
  const isDisabled = (url: string | null | undefined) =>
    disabledPaths.has((String(url ?? '').replace(/\/+$/, '') || '/'))
  const navItems = (await getNavItems('blog'))
    .filter((n) => !isDisabled(n.url))
    .map((n) => ({ ...n, children: n.children.filter((c) => !isDisabled(c.url)) }))
  const baseUrl  = normalizeUrl(s?.websiteUrl)
  const siteName = s?.siteName || 'InkDrop'
  const logo     = s?.siteIcon
    ? (s.siteIcon.startsWith('http') ? s.siteIcon : `${baseUrl}${s.siteIcon}`)
    : `${baseUrl}/og-image.png`
  // Social profile URLs (admin-managed in Footer) → Organization.sameAs.
  // Only real profile links (with a path) so generic placeholders like
  // 'https://twitter.com' don't pollute the Knowledge-Graph entity.
  const footer = await getFooterConfig('blog')
  const sameAs = (footer?.socials ?? [])
    .map((x) => (x?.url || '').trim())
    .filter((u) => /^https?:\/\/[^/]+\/.+/.test(u))
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: siteName,
        url: baseUrl,
        logo,
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: siteName,
        description: s?.description || s?.defaultMetaDescription || undefined,
        publisher: { '@id': `${baseUrl}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }

  return (
    <html lang="en" suppressHydrationWarning={true} data-scroll-behavior="smooth" className={`${sora.variable} ${lora.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* navItems are loaded on the SERVER and handed to the Navbar so the
            real menu is in the HTML crawlers read. Without this the Navbar
            shipped its hardcoded fallback links (which 404 here) on every
            page and only swapped in the real menu after hydration. */}
        <SiteBrandProvider siteName={siteName} navItems={navItems}>
          <SessionProviderWrapper session={session}>
            <MessagingProvider>
              <Suspense fallback={null}>
                <AccessDeniedToast />
              </Suspense>
              <main id="main-content">{children}</main>
              <FloatingChats />
              <SupportWidget />
              <AdsLoader />
              <GoogleAnalytics gaId={gaId} />
            </MessagingProvider>
          </SessionProviderWrapper>
        </SiteBrandProvider>
      </body>
    </html>
  )
}
