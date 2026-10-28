// app/(blog)/posts/[slug]/page.tsx
// LEGACY REDIRECT ONLY. Posts now live at /<primaryCategory.slug>/<slug>.
// Any old /posts/<slug> link (shared, indexed, bookmarked) is 308-redirected to
// the new canonical URL so no SEO equity or inbound links are lost.
import { permanentRedirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPostBySlug, postHref } from '@/lib/blog'

export default async function LegacyPostRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Only the category slug is needed to build the redirect target, so skip the
  // body's draft-link scan — it would run a query whose result is discarded.
  const post = await getPostBySlug(slug, { skipLinkCheck: true })

  // Live post → permanent redirect to its category-siloed URL.
  // (permanentRedirect throws a navigation signal, so it runs OUTSIDE try/catch.)
  if (post) permanentRedirect(postHref(post))

  // Not live → maybe the slug was renamed; follow a saved 308 redirect if any.
  let toPath: string | null = null
  try {
    const r = await prisma.redirect.findUnique({ where: { fromPath: `/posts/${slug}` } })
    if (r) {
      toPath = r.toPath
      prisma.redirect.update({ where: { id: r.id }, data: { hits: { increment: 1 } } }).catch(() => {})
    }
  } catch { /* fall through to 404 */ }
  if (toPath) permanentRedirect(toPath)

  notFound()
}
