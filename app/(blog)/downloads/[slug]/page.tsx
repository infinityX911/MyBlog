// app/(blog)/downloads/[slug]/page.tsx
// Download detail page — mirrors the blog post detail page structure exactly
// (hero + article + sidebar), adapted for downloads, with a matching download
// button in place of the post's like/comment interactions.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SafeHtml from '@/components/SafeHtml'
import CodeCopyButtons from '@/components/CodeCopyButtons'
import ImageLightbox from '@/components/ImageLightbox'
import PostInteractions from '@/components/PostInteractions'
import CommentSection from '@/components/CommentSection'
import AuthorCard from '@/components/AuthorCard'
import { getDownloadBySlug, getPopularDownloads, getDownloadCategories } from '@/lib/downloads'
import { getSiteSetting, normalizeUrl } from '@/lib/siteSettings'
import { cleanTitle } from '@/lib/seo/title'
import { robotsMeta } from '@/lib/seo/robots'
import styles from '@/components/PostDetail.module.css'

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1a0533 0%, #0d2b6b 55%, #0a4d68 100%)'

// Admin "Card Gradient" keys (from FeaturedVisual) → CSS, so a download that
// chose a gradient in the editor renders that exact gradient as its hero.
const ADMIN_GRADIENTS: Record<string, string> = {
  gradientPurple: 'linear-gradient(135deg,#1a0533,#0d2b6b)',
  gradientGreen:  'linear-gradient(135deg,#064e3b,#065f46)',
  gradientBlue:   'linear-gradient(135deg,#0c4a6e,#0369a1)',
  gradientOrange: 'linear-gradient(135deg,#431407,#9a3412)',
  gradientPink:   'linear-gradient(135deg,#4a044e,#86198f)',
  gradientIndigo: 'linear-gradient(135deg,#1e1b4b,#312e81)',
  gradientTeal:   'linear-gradient(135deg,#042f2e,#0f766e)',
  gradientRose:   'linear-gradient(135deg,#4c0519,#9f1239)',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const d = await getDownloadBySlug(slug)
  if (!d) return {}
  const seo = d.seo
  const settings = await getSiteSetting('blog')
  const siteName = settings?.siteName
  // Layout template already appends " | <siteName>" — strip an editor-typed one.
  const title = cleanTitle(seo?.metaTitle || d.title, siteName)
  const description = seo?.metaDescription || d.excerpt || undefined
  const image = seo?.ogImage || d.image || undefined
  return {
    title,
    description,
    robots: robotsMeta(seo?.robotsIndex ?? true, seo?.robotsFollow ?? true),
    alternates: { canonical: seo?.canonicalUrl || undefined },
    openGraph: {
      title: cleanTitle(seo?.ogTitle || seo?.metaTitle || d.title, siteName),
      description: seo?.ogDescription || description,
      type: 'article',
      ...(siteName ? { siteName } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: cleanTitle(seo?.twitterTitle || seo?.ogTitle || seo?.metaTitle || d.title, siteName),
      description: seo?.twitterDescription || seo?.ogDescription || description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const [d, popular, categories] = await Promise.all([
    getDownloadBySlug(slug),
    getPopularDownloads(4),
    getDownloadCategories(),
  ])

  if (!d) notFound()

  // ── SEO: settings-driven Software + Breadcrumb JSON-LD ────────────────────
  const setting  = await getSiteSetting('blog')
  const baseUrl  = normalizeUrl(setting?.websiteUrl)
  const siteName = setting?.siteName || 'InkDrop'
  const dlUrl    = `${baseUrl}/downloads/${d.slug}`
  const dlImage  = d.image
    ? (d.image.startsWith('http') ? d.image : `${baseUrl}${d.image}`)
    : `${baseUrl}/og-image.png`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${dlUrl}#software`,
        name: d.title,
        description: d.excerpt,
        applicationCategory: d.category,
        // Only claim an OS for actual Windows installers; asserting "Windows" for
        // a PDF/ZIP/cross-platform file would be wrong (there's no OS field).
        ...(/(exe|msi)/i.test(d.fileType) ? { operatingSystem: 'Windows' } : {}),
        offers: { '@type': 'Offer', price: d.free ? '0' : undefined, priceCurrency: 'USD' },
        image: [dlImage],
        url: dlUrl,
        publisher: { '@type': 'Organization', name: siteName },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
          { '@type': 'ListItem', position: 2, name: 'Downloads', item: `${baseUrl}/downloads` },
          { '@type': 'ListItem', position: 3, name: d.title, item: dlUrl },
        ],
      },
    ],
  }

  const heroGradient =
    d.image
      ? `linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)), url('${d.image}') center / cover no-repeat`
      : (ADMIN_GRADIENTS[d.gradient] ?? DEFAULT_GRADIENT)

  const dlHref = `/api/downloads/${d.slug}/download`

  // Prominent download button — matches the site accent / hero gradient.
  const dlBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    fontSize: 16, fontWeight: 800, padding: '15px 40px', borderRadius: 14,
    color: '#fff', textDecoration: 'none',
    background: 'linear-gradient(135deg,#6d5efc,#5b4fcf)',
    boxShadow: '0 14px 32px rgba(91,79,207,0.45)',
  }

  return (
    <>
      <Navbar />

      {/* Reading progress bar — same as posts/pages, for consistency. */}
      <PostInteractions tags="" title={d.title} slug={d.slug} renderOnly="progressBar" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Injects a "Copy" button into every code block in the content */}
      <CodeCopyButtons />
      {/* Makes content images tap-to-zoom */}
      <ImageLightbox />

      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link href="/downloads">Downloads</Link>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span>{d.title}</span>
      </nav>

      {/* Hero */}
      <div className={styles.heroOuter}>
        <div className={styles.hero} style={{ background: heroGradient }}>
          <div className={styles.heroContent} data-hero-animate>
            <div className={styles.heroBadge}>
              {d.icon} {d.category}
            </div>
            <h1 className={styles.heroTitle}>{d.title}</h1>
            <div className={styles.heroMeta}>
              <span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                {d.fileType}
              </span>
              {d.fileSize && (
                <>
                  <span className={styles.heroDot} aria-hidden="true" />
                  <span>{d.fileSize}</span>
                </>
              )}
              <span className={styles.heroDot} aria-hidden="true" />
              <span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {d.downloadCount.toLocaleString()} downloads
              </span>
              {d.free && (
                <>
                  <span className={styles.heroDot} aria-hidden="true" />
                  <span>Free</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className={styles.wrapper}>
        <div className={styles.grid}>

          {/* Article */}
          <main>
            <article className={styles.article}>
              {d.content
                ? <SafeHtml html={d.content} className={styles.articleBody} />
                : <div className={styles.articleBody}><p>No additional description provided for this resource.</p></div>}

              {/* Download button */}
              <div style={{ textAlign: 'center', margin: '30px 0 6px' }}>
                <a href={dlHref} style={dlBtn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {d.free ? 'Free Download' : 'Download'}{d.fileSize ? ` (${d.fileSize})` : ''}
                </a>
                <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 12 }}>
                  No sign-up required · instant download{d.fileType ? ` · ${d.fileType}` : ''}
                </p>
              </div>

              {/* Tags + Share — same as the post footer */}
              <div className={styles.articleFooter}>
                <hr className={styles.footerDivider} />
                <PostInteractions
                  tags={d.tags.join(',')}
                  title={d.title}
                  slug={d.slug}
                  renderOnly="footer"
                />
              </div>

              {/* Comments — same as posts, scoped to this download */}
              <CommentSection downloadId={d.id} />
            </article>
          </main>

          {/* Sidebar */}
          <aside className={styles.sidebar}>

            {/* Author — dynamic (Admin → Settings). */}
            <AuthorCard />

            {/* Related / most downloaded */}
            {popular && popular.length > 0 && (
              <div className={styles.sideCard}>
                <div className={styles.sideTitle}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  Most Downloaded
                </div>
                {popular.map((r) => (
                  <Link key={r.slug} href={`/downloads/${r.slug}`} className={styles.relatedItem}>
                    <div
                      className={styles.relatedThumb}
                      style={{ background: ADMIN_GRADIENTS[r.gradient] ?? DEFAULT_GRADIENT, display: 'grid', placeItems: 'center', fontSize: 20 }}
                      aria-hidden="true"
                    >{r.icon}</div>
                    <div>
                      <p className={styles.relatedTitle}>{r.title}</p>
                      <span className={styles.relatedMeta}>
                        {r.fileType}{' · '}{r.downloadCount.toLocaleString()} downloads
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Categories */}
            {categories && categories.length > 0 && (
              <div className={styles.sideCard}>
                <div className={styles.sideTitle}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Categories
                </div>
                {categories.map((cat) => (
                  <Link key={cat.name} href={`/downloads?category=${encodeURIComponent(cat.name)}`} className={styles.relatedItem} style={{ alignItems: 'center' }}>
                    <div>
                      <p className={styles.relatedTitle}>{cat.emoji} {cat.name}</p>
                      <span className={styles.relatedMeta}>{cat.count} file{cat.count !== 1 ? 's' : ''}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

          </aside>
        </div>
      </div>

      <Footer />

      <PostInteractions
        tags=""
        title={d.title}
        slug={d.slug}
        renderOnly="backToTop"
      />
    </>
  )
}
