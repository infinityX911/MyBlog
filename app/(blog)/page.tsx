// app/(blog)/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ReadingProgressBar from '@/components/ReadingProgressBar'
import PostCard from '@/components/PostCard'
import BlogPagination from '@/components/BlogPagination'
import CategorySidebar from '@/components/CategorySidebar'
import AnimatedStat from '@/components/AnimatedStat'
import AdSlot from '@/components/ads/AdSlot'
import Footer from '@/components/Footer'
import { getPosts, getCategories, getTrendingPosts } from '@/lib/blog'
import { getTutorialLessonSlugs } from '@/lib/tutorial-lookup'
import { getSiteSetting, getPageSeo, normalizeUrl } from '@/lib/siteSettings'
import { robotsMeta } from '@/lib/seo/robots'
import { getDisplayFlags } from '@/lib/display-flags'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSetting('blog')
  // Per-page SEO override from Admin → Settings → Per-Page SEO (path '/').
  const seo = await getPageSeo('blog', '/')
  const siteName = s?.siteName || 'InkDrop'
  const title = seo?.metaTitle || s?.defaultMetaTitle || `${siteName} — A Blog for Everything`
  const description =
    seo?.metaDescription ||
    s?.defaultMetaDescription ||
    s?.description ||
    `${siteName} is a free blog platform. Write about technology, life, travel, opinions, and science.`
  return {
    // `absolute` opts out of the layout's "%s | siteName" title template
    // (otherwise the brand would appear twice on the home page).
    title: { absolute: title },
    description,
    robots: robotsMeta(
      seo?.robotsIndex ?? s?.defaultRobotsIndex ?? true,
      seo?.robotsFollow ?? s?.defaultRobotsFollow ?? true,
    ),
    openGraph: {
      type: 'website',
      // og:url was missing entirely on the home page — it's what Facebook,
      // LinkedIn and WhatsApp use to canonicalise a share, so without it the
      // same page shared with different query strings counts as separate URLs.
      url: normalizeUrl(s?.websiteUrl || process.env.NEXT_PUBLIC_SITE_URL),
      siteName,
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      ...(seo?.ogImage || s?.ogImage ? { images: [(seo?.ogImage || s?.ogImage) as string] } : {}),
    },
    alternates: {
      canonical: seo?.canonicalUrl || '/',
      types: { 'application/rss+xml': [{ url: '/feed.xml', title: `${siteName} RSS Feed` }] },
    },
  }
}

const POSTS_PER_PAGE = 9

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>
}) {
  const { tag, page: pageParam } = await searchParams

  const s = await getSiteSetting('blog')
  const siteName = s?.siteName || 'InkDrop'
  // About text: use the admin tagline if set, else a dynamic default that
  // always uses the current site name (no more hardcoded "Flow").
  const aboutText = s?.tagline?.trim()
    || `This is ${siteName}, where I turn my curiosity into tutorials and stories. Whether it's a deep dive into code or a take on trending tech, you'll find it all here. Always open, always learning.`
  // Homepage H1. Kept out of the JSX so a rebrand only has to change one line,
  // and so the filtered/tag view reuses exactly the same heading.
  const homeHeadline = 'Free Coding & Video Editing Tutorials'
  // About stat boxes come from admin (Settings → aboutStats JSON), with defaults.
  const aboutStats: { value: string; label: string }[] = (() => {
    try { const a = JSON.parse(s?.aboutStats || '[]'); return Array.isArray(a) && a.length ? a : null } catch { return null }
  })() ?? [
    { value: '∞', label: 'Tutorials' },
    { value: '100%', label: 'Free' },
    { value: '✦', label: 'Pro Workflows' },
  ]

  const [allPosts, categories, trendingPosts, lessonSlugs] = await Promise.all([
    getPosts(),
    getCategories(),
    getTrendingPosts(4),
    getTutorialLessonSlugs(),
  ])

  // Hide tutorial LESSON posts from the blog feed — they live INSIDE their
  // tutorial (like CodeWithHarry), not as standalone home-page posts. Matched
  // by slug so a lesson never shows twice (feed + tutorial).
  // Safety valve: while EVERY published post is still a tutorial lesson, hiding
  // them all leaves the home page reading "No posts published yet" — an empty
  // home page is worse for readers AND for Google than a lesson also appearing
  // in the feed. So only hide when something would actually be left to show.
  const nonLessonPosts = allPosts.filter((p) => !lessonSlugs.has(p.slug))
  const feedPosts = nonLessonPosts.length > 0 ? nonLessonPosts : allPosts

  const totalViews = allPosts.reduce((a, p) => a + p.view_count, 0)
  // Hiding the per-post count but leaving the total on display would give
  // the same thing away in one number, so the stat goes with it.
  const { showViews } = await getDisplayFlags()
  const activeCat  = categories.find(c => c.slug === tag)

  // Default home = SECTION-WISE (each category's latest posts, grouped by the
  // post's primary category). A ?tag= filter = the classic flat + paginated grid.
  const SECTION_LIMIT = 6
  const tagPosts = tag ? await getPosts(tag) : []
  const tagNonLessons = tagPosts.filter((p) => !lessonSlugs.has(p.slug))
  // Same safety valve as the main feed — never render an empty category view.
  const filteredPosts = tagNonLessons.length > 0 ? tagNonLessons : tagPosts
  const sections = tag ? [] : categories
    .map((cat) => ({ category: cat, posts: feedPosts.filter((p) => p.category_slug === cat.slug).slice(0, SECTION_LIMIT) }))
    .filter((s) => s.posts.length > 0)

  // ── Pagination (only for the filtered category view) ──
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE))
  const page       = Math.min(totalPages, Math.max(1, Number(pageParam) || 1))
  const pagePosts  = filteredPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE)

  return (
    <>
      <Navbar />
      <ReadingProgressBar />

      <div className="blog-home-page">

        {/* Hero banner — exact match with Downloads .hero */}
        <div className="blog-hero">
          <div className="container-fluid">
            <div className="blog-hero-inner" data-hero-animate>
              <div className="blog-hero-eyebrow">✍️ Latest from the blog</div>
              {/* The homepage H1 is the strongest on-page signal a site has, and
                  "Latest Posts" spent it on two words that describe every blog
                  ever made. Say what this one is actually about instead. */}
              <h1 className="blog-hero-title">{homeHeadline}</h1>
              <p className="blog-hero-sub">Discover stories, ideas &amp; perspectives — fresh content every week.</p>
              <div className="blog-hero-stats">
                <div className="blog-hero-stat">
                  <AnimatedStat className="blog-hero-stat-num" value={allPosts.length} suffix="+" />
                  <span className="blog-hero-stat-label">Articles</span>
                </div>
                <div className="blog-hero-stat">
                  <AnimatedStat className="blog-hero-stat-num" value={categories.length} />
                  <span className="blog-hero-stat-label">Categories</span>
                </div>
                {showViews && (
                  <div className="blog-hero-stat">
                    <AnimatedStat className="blog-hero-stat-num" value={totalViews} compact />
                    {/* Our own post_views tally, not GA. Deliberately named so it
                        cannot be mistaken for the admin's site-wide GA page views:
                        this counts reads of the 22 posts, that counts every page. */}
                    <span className="blog-hero-stat-label">Post Views</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar — exact match with Downloads .filterBar */}
        <div className="blog-filter-wrap">
          <div className="container-fluid">
            <div className="blog-filter-bar">
              <Link href="/" className={`blog-filter-pill ${!tag ? 'active' : ''}`}>
                ✨ All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/?tag=${cat.slug}`}
                  className={`blog-filter-pill ${tag === cat.slug ? 'active' : ''}`}
                >
                  {cat.emoji} {cat.name}
                  <span className="blog-filter-count">{cat.post_count}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Ad — between the filter bar and the post sections */}
        <div className="container-fluid" style={{ paddingTop: 16 }}>
          <AdSlot position="betweenPosts" />
        </div>

        {/* Posts + Sidebar */}
        <div className="posts-section" style={{ marginTop: 0 }}>
          <div className="container-fluid">

            {activeCat && (
              <div className="blog-active-filter-banner">
                <span>{activeCat.emoji}</span>
                Showing <strong>{activeCat.name}</strong> posts ({filteredPosts.length})
                <Link href="/" className="blog-clear-filter">Clear ×</Link>
              </div>
            )}

            <div className="row g-4">

              {/* Posts — col-9 */}
              <div className="col-12 col-lg-9">
                {tag ? (
                  /* Filtered category view — flat paginated grid. */
                  filteredPosts.length > 0 ? (
                    <>
                      <div className="row g-4">
                        {pagePosts.map((post, i) => (
                          <div key={post.id} className="col-12 col-sm-6 col-xl-4">
                            <PostCard post={post} priority={i === 0} />
                          </div>
                        ))}
                      </div>
                      <BlogPagination currentPage={page} totalPages={totalPages} basePath="/" params={{ tag }} />
                    </>
                  ) : (
                    <div className="no-posts">
                      <p>No posts in this category yet.</p>
                      <Link href="/" className="back-link" style={{ marginTop: '16px', display: 'inline-block' }}>← View all posts</Link>
                    </div>
                  )
                ) : sections.length > 0 ? (
                  /* Default home — section-wise: each category's latest posts. */
                  sections.map((sec) => (
                    <section key={sec.category.id} className="home-cat-section">
                      <div className="home-cat-head">
                        <h2 className="home-cat-title">
                          <Link href={`/tag/${sec.category.slug}`}>{sec.category.emoji} {sec.category.name}</Link>
                        </h2>
                      </div>
                      <div className="row g-4">
                        {sec.posts.map((post) => (
                          <div key={post.id} className="col-12 col-sm-6 col-xl-4">
                            <PostCard post={post} />
                          </div>
                        ))}
                      </div>
                      <div className="home-cat-viewall-wrap">
                        <Link href={`/tag/${sec.category.slug}`} className="home-cat-viewall">View all {sec.category.name} →</Link>
                      </div>
                    </section>
                  ))
                ) : (
                  <div className="no-posts"><p>No posts published yet.</p></div>
                )}
              </div>

              {/* Sidebar — col-3 */}
              <div className="col-12 col-lg-3">
                <div className="home-sidebar">
                  <CategorySidebar
                    categories={categories}
                    trendingPosts={trendingPosts}
                    showAuthor={true}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* About — adapts to light/dark mode via CSS (.about-section / .dark .about-section) */}
        <section className="about-section" id="about">
          <div className="about-container">
            <div className="about-text">
              <h2>About <span className="brand-color">{siteName}</span></h2>
              <p>{aboutText}</p>
            </div>
            <div className="about-stats">
              {aboutStats.map((st, i) => (
                <div className="stat" key={i}>
                  <span className="stat-n">{st.value}</span>
                  <span className="stat-l">{st.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>

      <Footer />
    </>
  )
}
