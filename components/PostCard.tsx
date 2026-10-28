// components/PostCard.tsx
import Link from 'next/link'
import Image from 'next/image'
import { postHref, type Post } from '@/lib/blog'
import { getDisplayFlags } from '@/lib/display-flags'

// Compact view count, e.g. 1234 -> "1.2k", 2_500_000 -> "2.5M".
function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n ?? 0)
}

export default async function PostCard({ post, priority = false }: { post: Post; priority?: boolean }) {
  // Server component, so it can read the toggles itself rather than having
  // every page that renders a card thread two more props down.
  const { showViews, showTags } = await getDisplayFlags()
  const tags = showTags ? (post.tag ?? '').split(',').map(t => t.trim()).filter(Boolean) : []
  return (
    <article className={`post-card${post.featured ? ' featured' : ''}`}>
      <div className={`post-thumb ${post.thumb_class}`}>
        {post.thumbnail_url ? (
          <Image
            src={post.thumbnail_url}
            alt={post.title}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 768px) 100vw, 33vw"
            // Eager-load the first (above-the-fold) image to improve LCP;
            // lazy-load the rest. Set by the parent list via `priority`.
            priority={priority}
          />
        ) : null}
        <span className="post-badge">{post.category_emoji} {post.category_name}</span>
        {post.featured && <span className="featured-tag">⭐ Featured</span>}
      </div>
      <div className="post-body">
        <div className="post-meta">
          {post.date} · {post.read_min} min read
          {showViews && <> · {formatViews(post.view_count)} views</>}
        </div>
        <h2 className="post-title">{post.title}</h2>
        <p className="post-excerpt">{post.excerpt}</p>
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '2px 0 12px' }}>
            {tags.map(t => (
              <span key={t} style={{ fontSize: 11, fontWeight: 600, color: '#6b5bd0', background: '#f1effc', borderRadius: 999, padding: '3px 10px' }}>{t}</span>
            ))}
          </div>
        )}
        <Link href={postHref(post)} className="post-link">Read More →</Link>
      </div>
    </article>
  )
}
