/**
 * app/api/blog/link-options/route.ts
 *
 * GET /api/blog/link-options
 *   → the list of link targets an editor can point a tutorial lesson at:
 *     every PUBLISHED blog post and CMS page, with its public path + title.
 *   Used by the tutorial-sidebar builder so links are picked (not typed).
 *
 * Requires the 'view-pages' permission (same context as the pages editor).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export async function GET() {
    const auth = await requirePermission('view-pages');
    if (auth.error) return auth.error;

    try {
        const [posts, pages] = await Promise.all([
            prisma.post.findMany({
                where: { status: 'published' },
                select: {
                    title: true, slug: true,
                    primaryCategory: { select: { slug: true } },
                    categories: { take: 1, select: { category: { select: { slug: true } } } },
                },
                orderBy: { publishedAt: 'desc' },
                take: 300,
            }),
            prisma.cmsPage.findMany({
                where: { siteKey: 'blog', status: 'published' },
                select: { title: true, slug: true },
                orderBy: { updatedAt: 'desc' },
                take: 300,
            }),
        ]);

        return NextResponse.json({
            // Category-siloed post URL: /<primaryCategory.slug>/<slug>.
            posts: posts.map((p: any) => {
                const cat = p.primaryCategory?.slug || p.categories?.[0]?.category?.slug || 'uncategorized';
                return { title: p.title, path: `/${cat}/${p.slug}` };
            }),
            pages: pages.map((p) => ({ title: p.title, path: `/${p.slug}` })),
        });
    } catch (error) {
        console.error('[GET /api/blog/link-options]', error);
        return NextResponse.json({ posts: [], pages: [] });
    }
}
