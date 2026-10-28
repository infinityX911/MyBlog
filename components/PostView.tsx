// components/PostView.tsx
// The full blog-post detail view (hero + article + sidebar + comments), now
// category-siloed. Rendered from the (blog) catch-all route for the URL
// /<category>/<slug>. Kept as a shared component (not a page) so the catch-all
// can dispatch: CMS page? → CMS renderer, else a post? → this.
import { permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CategorySidebar from '@/components/CategorySidebar'
import AuthorCard from '@/components/AuthorCard'
import PostInteractions from '@/components/PostInteractions'
import CommentSection from '@/components/CommentSection'
import CodeCopyButtons from '@/components/CodeCopyButtons'
import ImageLightbox from '@/components/ImageLightbox'
import TutorialShell from '@/components/TutorialShell'
import TutorialPager from '@/components/TutorialPager'
import AdSlot from '@/components/ads/AdSlot'
import { getTutorialContext } from '@/lib/tutorial-lookup'
import { getCategories, getRelatedPosts, getTrendingPosts, postHref, type Post } from '@/lib/blog'
import { getSiteSetting, normalizeUrl } from '@/lib/siteSettings'
import { addExternalLinkAttrs, sanitizePostHtml, enhanceContentImages } from '@/lib/contentHtml'
import styles from '@/components/PostDetail.module.css'
import { getDisplayFlags } from '@/lib/display-flags'

const HERO_GRADIENTS: Record<string, string> = {
  'thumb-tech':     'linear-gradient(135deg, #1a0533 0%, #0d2b6b 55%, #0a4d68 100%)',
  'thumb-life':     'linear-gradient(135deg, #064e3b 0%, #065f46 55%, #047857 100%)',
  'thumb-travel':   'linear-gradient(135deg, #0c4a6e 0%, #0369a1 55%, #0284c7 100%)',
  'thumb-opinion':  'linear-gradient(135deg, #4a044e 0%, #86198f 55%, #a21caf 100%)',
  'thumb-science':  'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #3730a3 100%)',
  'thumb-trending': 'linear-gradient(135deg, #431407 0%, #9a3412 55%, #c2410c 100%)',
}
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1a0533 0%, #0d2b6b 55%, #0a4d68 100%)'
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
/** Escape a URL for use inside a CSS url('...') so a quote, paren or space in a
 *  filename cannot close the declaration and inject CSS of its own. */
function cssUrlSafe(url: string): string {
  return url.replace(/['"()\\\s]/g, encodeURIComponent)
}

// Author name falls back through: Admin → Settings author name → site name → 'Flow'.
const DEFAULT_AUTHOR = 'Flow'

/** Split article HTML at the </p> nearest the middle, for a mid-article ad. */
function splitMidArticle(html: string): [string, string] {
  const ends = [...html.matchAll(/<\/p>/gi)].map((m) => (m.index ?? 0) + m[0].length)
  if (ends.length < 3) return [html, '']
  const target = html.length / 2
  const cut = ends.reduce((best, i) => (Math.abs(i - target) < Math.abs(best - target) ? i : best), ends[0])
  return [html.slice(0, cut), html.slice(cut)]
}

/** @param post       the already-fetched published post
 *  @param urlCategory the category segment from the URL (for canonicalization) */
export default async function PostView({ post, urlCategory }: { post: Post; urlCategory: string }) {
  // Canonicalize: a post lives at exactly ONE URL (/<primaryCategory>/<slug>).
  // If reached under the wrong category, 308-redirect to the canonical one
  // (prevents duplicate content).
  if (urlCategory !== post.category_slug) {
    permanentRedirect(postHref(post))
  }

  // Admin-only display toggles (Settings -> Accessibility). An administrator
  // always gets both, so these never hide anything from the owner.
  const { showViews, showTags } = await getDisplayFlags()

  // `trendingPosts` used to be `allPosts.slice(0, 4)` — the first four posts in
  // feed order, relabelled "Trending" in the sidebar. It never consulted views
  // at all, so a post published a minute ago sat at number one. Use the real
  // ranking; it returns [] when nothing genuinely qualifies, and
  // CategorySidebar already hides the box on an empty array.
  const [categories, related, trendingPosts] = await Promise.all([
    getCategories(),
    getRelatedPosts(post.slug, 4),
    getTrendingPosts(4),
  ])

  const setting = await getSiteSetting('blog')
  const baseUrl = normalizeUrl(setting?.websiteUrl)
  const siteName = setting?.siteName || 'InkDrop'
  const authorName = setting?.authorName?.trim() || siteName || DEFAULT_AUTHOR
  const logo = setting?.siteIcon
    ? (setting.siteIcon.startsWith('http') ? setting.siteIcon : `${baseUrl}${setting.siteIcon}`)
    : `${baseUrl}/og-image.png`
  const postUrl = `${baseUrl}${postHref(post)}`
  const catUrl = `${baseUrl}/tag/${post.category_slug}`
  const postImage = post.thumbnail_url
    ? (post.thumbnail_url.startsWith('http') ? post.thumbnail_url : `${baseUrl}${post.thumbnail_url}`)
    : `${baseUrl}/og-image.png`

  let extraSchema: Record<string, unknown> = {}
  try { if (post.seo?.schemaJson) extraSchema = JSON.parse(post.seo.schemaJson) } catch { extraSchema = {} }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': post.seo?.schemaType ?? 'BlogPosting',
        '@id': `${postUrl}#article`,
        headline: post.title,
        description: post.excerpt,
        datePublished: post.publishedAt ?? post.date,
        dateModified: post.updatedAt ?? post.publishedAt ?? post.date,
        image: [postImage],
        keywords: post.tag,
        url: postUrl,
        mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
        author: { '@type': 'Person', name: authorName, url: `${baseUrl}/#about` },
        publisher: { '@type': 'Organization', name: siteName, logo: { '@type': 'ImageObject', url: logo } },
        articleSection: post.category_name || undefined,
        ...extraSchema,
      },
      {
        '@type': 'BreadcrumbList',
        // CMS pages already give their breadcrumb an @id; posts did not, so the
        // two halves of the site described the same thing differently. An @id
        // also lets the article node reference this list instead of Google
        // guessing which breadcrumb belongs to which page.
        '@id': `${postUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
          { '@type': 'ListItem', position: 2, name: post.category_name || 'Blog', item: post.category_name ? catUrl : baseUrl },
          { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
        ],
      },
    ],
  }

  // Sanitize → outbound-link attrs → image enhancement (lazy/decoding + the
  // zoomable flag the lightbox binds to). Image step runs last so nothing
  // downstream strips it.
  const bodyHtml = enhanceContentImages(addExternalLinkAttrs(sanitizePostHtml(post.body), baseUrl))
  // Manual inline ad markers (💰 Ad button). Split the body on each marker so an
  // ad can be rendered at that exact spot; the marker's label text is discarded.
  const inlineAdSegments = bodyHtml.split(/<div class="post-inline-ad"[^>]*>[\s\S]*?<\/div>/gi)
  const [bodyTop, bodyBottom] = splitMidArticle(bodyHtml)

  // The hero is built in layers on purpose. Cover images are authored as cards,
  // so they normally have the post's own title set inside the artwork; dropped
  // straight in as the hero background under a flat 45% scrim, that baked-in
  // lettering showed through from behind the real <h1> and the two sets of words
  // collided. Now the gradient is the base, the cover sits above it in its own
  // blurred layer, and the scrim sits above that: the photo still reads as a
  // cover, but its text can no longer compete with the heading.
  const heroGradient = post.gradient
    ? (ADMIN_GRADIENTS[post.gradient] ?? DEFAULT_GRADIENT)
    : (HERO_GRADIENTS[post.thumb_class] ?? DEFAULT_GRADIENT)
  const heroPhoto = post.thumbnail_url?.trim() || ''

  const formattedDate = new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  // Lesson inside a tutorial? Match the new canonical URL first, then the legacy
  // /posts/<slug> (sidebars saved before the URL migration).
  const tut = (await getTutorialContext(postHref(post))) ?? (await getTutorialContext(`/posts/${post.slug}`))

  const pageBody = (
    <>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
        <Link href={post.category_name ? `/tag/${post.category_slug}` : '/'}>{post.category_name || 'Blog'}</Link>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
        <span>{post.title}</span>
      </nav>

      {/* Hero */}
      <div className={styles.heroOuter}>
        <div className={`${styles.hero}${heroPhoto ? ` ${styles.heroHasPhoto}` : ''}`} style={{ background: heroGradient }}>
          {heroPhoto && (
            <div className={styles.heroPhoto} style={{ backgroundImage: `url('${cssUrlSafe(heroPhoto)}')` }} aria-hidden="true" />
          )}
          <div className={styles.heroContent} data-hero-animate>
            <div className={styles.heroBadge}>{post.category_emoji} {post.category_name}</div>
            <h1 className={styles.heroTitle}>{post.title}</h1>
            <div className={styles.heroMeta}>
              <span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                {formattedDate}
              </span>
              <span className={styles.heroDot} aria-hidden="true" />
              <span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {post.read_min} min read
              </span>
              {showViews && (
                <>
                  <span className={styles.heroDot} aria-hidden="true" />
                  <span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    {post.view_count.toLocaleString()} views
                  </span>
                </>
              )}
              <span className={styles.heroDot} aria-hidden="true" />
              <span>By {authorName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ad — right under the hero */}
      <div className={styles.wrapper} style={{ paddingBottom: 0 }}>
        <AdSlot position="afterHero" />
      </div>

      {/* Main layout */}
      <div className={styles.wrapper}>
        <div className={styles.grid}>
          <main>
            <article className={styles.article}>
              {inlineAdSegments.length > 1 ? (
                // Author placed 💰 Ad markers in the body — render an in-content
                // ad at each marked spot (label text is dropped by the split).
                inlineAdSegments.map((seg, i) => (
                  <div key={i}>
                    <div {...(i === 0 ? { id: 'article-body' } : {})} className={styles.articleBody} dangerouslySetInnerHTML={{ __html: seg }} />
                    {i < inlineAdSegments.length - 1 && <AdSlot position="inline" />}
                  </div>
                ))
              ) : bodyBottom ? (
                <>
                  <div id="article-body" className={styles.articleBody} dangerouslySetInnerHTML={{ __html: bodyTop }} />
                  <AdSlot position="midArticle" />
                  <div className={styles.articleBody} dangerouslySetInnerHTML={{ __html: bodyBottom }} />
                </>
              ) : (
                <div id="article-body" className={styles.articleBody} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              )}
              {/* Lesson navigation sits directly under the lesson text — where a
                  reader who just finished reading looks next — and ABOVE the
                  tags/share row. It used to render after the comments, which is
                  far too late to be useful. */}
              {tut && <TutorialPager prev={tut.prev} next={tut.next} />}
              <div className={styles.articleFooter}>
                <hr className={styles.footerDivider} />
                <PostInteractions tags={showTags ? (post.tag ?? '') : ''} title={post.title} slug={post.slug} renderOnly="footer" linkableTags={categories.map(c => c.slug)} />
              </div>
              <CommentSection postId={post.id} />
            </article>
          </main>

          <aside className={styles.sidebar}>
            <AuthorCard />
            <AdSlot position="sidebar" />
            {related && related.length > 0 && (
              <div className={styles.sideCard}>
                <div className={styles.sideTitle}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                  Related Posts
                </div>
                {related.map((r) => (
                  <Link key={r.slug} href={postHref(r)} className={styles.relatedItem}>
                    <div className={styles.relatedThumb} style={{ background: HERO_GRADIENTS[r.thumb_class ?? ''] ?? DEFAULT_GRADIENT }} aria-hidden="true" />
                    <div>
                      <p className={styles.relatedTitle}>{r.title}</p>
                      <span className={styles.relatedMeta}>
                        {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}{r.read_min} min read
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <CategorySidebar categories={categories} trendingPosts={trendingPosts} />
          </aside>
        </div>
      </div>
    </>
  )

  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CodeCopyButtons />
      <ImageLightbox />
      <PostInteractions tags={post.tag ?? ''} title={post.title} slug={post.slug} renderOnly="progressBar" />

      {tut ? (
        <TutorialShell title={tut.title} sections={tut.sections} homeHref={tut.href}
          parentLabel={tut.parentLabel ?? undefined} parentHref={tut.parentHref ?? undefined}>
          {pageBody}
        </TutorialShell>
      ) : pageBody}

      <div className={styles.wrapper} style={{ paddingTop: 0 }}>
        <AdSlot position="footer" />
      </div>

      <Footer />
      <PostInteractions tags={post.tag ?? ''} title={post.title} slug={post.slug} renderOnly="backToTop" />
    </>
  )
}
