// app/(blog)/tag/[tag]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PostCard from '@/components/PostCard'
import CategorySidebar from '@/components/CategorySidebar'
import AuthorCard from '@/components/AuthorCard'
import BlogPagination from '@/components/BlogPagination'
import ReadingProgressBar from '@/components/ReadingProgressBar'
import { getPosts, getCategories } from '@/lib/blog'
import { getSiteUrl, getSiteSetting } from '@/lib/siteSettings'
import { cleanTitle } from '@/lib/seo/title'
import { robotsMeta } from '@/lib/seo/robots'
import { getDisplayFlags } from '@/lib/display-flags'

const TAG_PER_PAGE = 9

// Render tag pages on-demand (per request), NOT at build time. The old
// generateStaticParams queried the DB during `next build` — but the DB isn't
// running then, so the build failed. Tags are dynamic + DB-driven anyway.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>
  searchParams: Promise<{ page?: string }>
}): Promise<Metadata> {
  const { tag } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const categories = await getCategories()
  const cat = categories.find((c) => c.slug === tag)
  if (!cat) return { title: 'Not Found' }
  // Settings-driven canonical — NEVER hardcode the domain (staging/preview would
  // point Google at the wrong origin). Each paginated page SELF-canonicalizes,
  // page 2+ is noindex,follow so the paginated slices don't clutter the index
  // while the post links still pass equity.
  const base = await getSiteUrl('blog')
  const canonical = page > 1 ? `${base}/tag/${tag}?page=${page}` : `${base}/tag/${tag}`

  // cleanTitle() is defensive here: the category name comes from the DB, so an
  // admin who saved "Web Development | Flow's Blog" as the name would otherwise
  // get the brand twice once the layout's title template appends it.
  const settings = await getSiteSetting('blog')
  const siteName = settings?.siteName
  const title = cleanTitle(
    page > 1 ? `${cat.emoji} ${cat.name} Posts — Page ${page}` : `${cat.emoji} ${cat.name} Posts`,
    siteName,
  )
  // Bing's Recommendations flagged this archive for a short meta description:
  // the old one-liner came out at 116 characters, under the 150–160 window
  // search engines like. This is the only page on the site it flagged, and it
  // is also one of the few URLs both Bing and Google have actually indexed, so
  // it is worth the extra clause. Long category names could push past 160, so
  // the fuller sentence is dropped rather than truncated mid-word.
  const descLead = `Every ${cat.name} tutorial on ${siteName || 'the site'}, newest first.`
  const descFull = `${descLead} Free, hands-on lessons with runnable code and real output you can follow start to finish.`
  const description = descFull.length <= 160 ? descFull : descLead

  // Social image: newest post in this category, so a shared category link
  // previews real content instead of the global site logo.
  const catPosts = await getPosts(tag)
  const image = catPosts.find((p) => p.thumbnail_url)?.thumbnail_url || undefined

  return {
    title,
    description,
    alternates: { canonical },
    // Page 1 of a category archive IS indexable. It was briefly noindex on the
    // theory that the hand-written hubs (/web-development-tutorials,
    // /phptutorials) cover the same posts and would compete — but at this size
    // the hubs aren't indexed yet and the archive is, so noindexing it removed a
    // working page in favour of one Google hasn't seen. Revisit around 15–20
    // posts, when the hubs are established and duplication is a real risk.
    // Page 2+ stays noindex,follow: paginated slices have no standalone value,
    // but the post links still pass equity.
    robots: robotsMeta(page === 1, true),
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      description,
      ...(siteName ? { siteName } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { tag } = await params
  const { page: pageParam } = await searchParams
  const [posts, categories] = await Promise.all([getPosts(tag), getCategories()])
  const cat = categories.find((c) => c.slug === tag)

  if (!cat) notFound()

  const totalViews = posts.reduce((a, p) => a + p.view_count, 0)
  const { showViews } = await getDisplayFlags()
  const totalPages = Math.max(1, Math.ceil(posts.length / TAG_PER_PAGE))
  const page = Math.min(totalPages, Math.max(1, Number(pageParam) || 1))
  const pagePosts = posts.slice((page - 1) * TAG_PER_PAGE, page * TAG_PER_PAGE)

  return (
    <>
      <Navbar />
      <ReadingProgressBar />

      <div className="blog-home-page">

        {/* Hero banner — exact match with Downloads .hero */}
        <div className="blog-hero">
          <div className="container-fluid">
            <div className="blog-hero-inner" data-hero-animate>
              <div className="blog-hero-eyebrow">{cat.emoji} Category</div>
              <h1 className="blog-hero-title">{cat.name} Posts</h1>
              <p className="blog-hero-sub">Browse all posts filed under {cat.name}.</p>
              <div className="blog-hero-stats">
                <div className="blog-hero-stat">
                  <span className="blog-hero-stat-num">{posts.length}</span>
                  <span className="blog-hero-stat-label">Posts</span>
                </div>
                <div className="blog-hero-stat">
                  <span className="blog-hero-stat-num">{categories.length}</span>
                  <span className="blog-hero-stat-label">Categories</span>
                </div>
                {showViews && (
                  <div className="blog-hero-stat">
                    <span className="blog-hero-stat-num">{totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews}</span>
                    <span className="blog-hero-stat-label">Total Views</span>
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
              <Link href="/" className="blog-filter-pill">
                ✨ All
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/tag/${c.slug}`}
                  className={`blog-filter-pill ${c.slug === tag ? 'active' : ''}`}
                >
                  {c.emoji} {c.name}
                  <span className="blog-filter-count">{c.post_count}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Posts + Sidebar */}
        <div className="posts-section" style={{ marginTop: 0 }}>
          <div className="container-fluid">
            <div className="row g-4">

              {/* Posts — col-9 */}
              <div className="col-12 col-lg-9">
                {pagePosts.length > 0 ? (
                  <>
                    <div className="row g-4">
                      {pagePosts.map((post, i) => (
                        <div key={post.id} className="col-12 col-sm-6 col-xl-4">
                          <PostCard post={post} priority={i === 0} />
                        </div>
                      ))}
                    </div>
                    <BlogPagination currentPage={page} totalPages={totalPages} basePath={`/tag/${tag}`} />
                  </>
                ) : (
                  <div className="no-posts">
                    <p>No posts in this category yet.</p>
                    <Link href="/" className="back-link" style={{ marginTop: '16px', display: 'inline-block' }}>← Back to Home</Link>
                  </div>
                )}
              </div>

              {/* Sidebar — col-3 */}
              <div className="col-12 col-lg-3">
                <div className="home-sidebar">
                  <AuthorCard />
                  <CategorySidebar categories={categories} />
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      <Footer />
    </>
  )
}
