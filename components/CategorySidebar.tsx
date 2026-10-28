// components/CategorySidebar.tsx
import Link from 'next/link'
import { postHref, type Category, type Post } from '@/lib/blog'
import { getSiteSetting } from '@/lib/siteSettings'
import { readableOn, edgeOn } from '@/lib/readable-color'

interface Props {
  categories:     Category[]
  trendingPosts?: Post[]
  showAuthor?:    boolean
}

// Fallbacks used only when the admin hasn't filled the fields yet.
const FALLBACK_NAME = 'Flow'
const FALLBACK_BIO  = 'Turning curiosity into tutorials and stories about code & tech.'

export default async function CategorySidebar({
  categories,
  trendingPosts = [],
  showAuthor = false,
}: Props) {
  // Author/brand card content is admin-controlled via Admin → Settings → Sitemap & OG.
  const settings = showAuthor ? await getSiteSetting('blog') : null
  // Show the card unless the admin EXPLICITLY turned it off. `?? true` also
  // keeps it visible before `prisma db push` adds the column (undefined → show).
  const authorOn   = (settings?.authorEnabled ?? true) !== false
  const authorName = settings?.authorName?.trim() || FALLBACK_NAME
  const authorImg  = settings?.authorImage?.trim() || ''
  const authorBio  = settings?.authorBio?.trim() || FALLBACK_BIO
  const themeColor = settings?.themeColor?.trim() || '#5b4fcf'
  // See lib/readable-color.ts - the picker can hold #ffffff, so the ink and
  // the outline are derived from the background instead of hardcoded white.
  const onTheme = readableOn(themeColor)
  const themeEdge = edgeOn(themeColor)
  const authorLink = settings?.authorLink?.trim() || ''
  const isExternalLink = /^https?:\/\//i.test(authorLink) && !/localhost/i.test(authorLink)

  // The card's inner content (shared by the linked + non-linked versions).
  // Clean, minimal look to match the other white sidebar cards — no banner.
  const authorCardInner = (
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
        <span className="gradient-avatar-ring">
          {authorImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={authorImg}
              alt={authorName}
              referrerPolicy="no-referrer"
              style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: themeColor, color: onTheme, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 32 }}>
              {authorName.charAt(0).toUpperCase()}
            </div>
          )}
        </span>
      </div>
      <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{authorName}</p>
      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.7 }}>{authorBio}</p>
      {authorLink && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '8px 18px', borderRadius: 999, background: themeColor, color: onTheme, border: `1px solid ${themeEdge}`, fontSize: 12.5, fontWeight: 700 }}>
          {isExternalLink ? 'Visit' : 'View profile'}
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>→</span>
        </span>
      )}
    </div>
  )

  return (
    <aside className="sidebar">

      {/* Author Card — admin-controlled (image, name, description, link). */}
      {showAuthor && authorOn && (
        authorLink ? (
          <a
            href={authorLink}
            {...(isExternalLink ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="sidebar-box author-card-link"
            style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
          >
            {authorCardInner}
          </a>
        ) : (
          <div className="sidebar-box">
            {authorCardInner}
          </div>
        )
      )}

      {/* Categories Box */}
      <div className="sidebar-box">
        <h2 className="sidebar-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h7"/>
          </svg>
          Categories
        </h2>
        <ul className="sidebar-cat-list">
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link href={`/tag/${cat.slug}`} className="sidebar-cat-item">
                <span className="sidebar-cat-left">
                  <span className="sidebar-cat-emoji">{cat.emoji}</span>
                  <span className="sidebar-cat-name">{cat.name}</span>
                </span>
                <span className="sidebar-cat-count">{cat.post_count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Trending Posts Box — dynamic */}
      {trendingPosts.length > 0 && (
        <div className="sidebar-box">
          <h2 className="sidebar-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Trending
          </h2>
          <ul className="sidebar-trending-list">
            {trendingPosts.map((post, i) => (
              <li key={post.slug}>
                <Link href={postHref(post)} className="sidebar-trending-item">
                  <span className="trending-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="trending-title">{post.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tags Cloud Box — dynamic from categories */}
      <div className="sidebar-box">
        <h2 className="sidebar-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          Tags
        </h2>
        <div className="sidebar-tags">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/tag/${cat.slug}`} className="sidebar-tag">
              {cat.emoji} {cat.name}
            </Link>
          ))}
        </div>
      </div>

    </aside>
  )
}
