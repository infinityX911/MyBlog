/**
 * app/api/posts/route.ts
 *
 * GET  /api/posts  -> list all posts with SEO + categories   (requires 'view-posts')
 * POST /api/posts  -> create a new post with optional SEO + categories (requires 'create-posts')
 *
 * SECURITY: this route previously had no auth check at all — anyone could
 * POST a new post or read the full unpublished list. Both verbs are now
 * gated; POST also stamps authorId from the session instead of trusting
 * (or silently omitting) a client-supplied value.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifySubscribers } from '@/lib/subscribers';
import { requirePermission, userId } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';
import { sanitizePostHtml } from '@/lib/contentHtml';
import { resolvePublishState } from '@/lib/scheduling';
import { pingIndexNow } from '@/lib/indexnow';

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
    const auth = await requirePermission('view-posts');
    if (auth.error) return auth.error;

    try {
        const posts = await prisma.post.findMany({
            include: {
                seo: true,
                categories: { include: { category: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Flatten categories: [{ category: {...} }] -> [{ id, name, slug }]
        const mapped = posts.map(p => ({
            ...p,
            categories: p.categories.map(pc => ({
                id: pc.category.id,
                name: pc.category.name,
                slug: pc.category.slug,
            })),
        }));

        return NextResponse.json(mapped);
    } catch (error) {
        console.error('[GET /api/posts]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const auth = await requirePermission('create-posts');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const title: string = (body.title ?? '').trim();
        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 422 });
        }

        const slug = body.slug?.trim() || toSlug(title);
        // Sanitize editor HTML before it ever reaches the DB (defense in depth —
        // the render path sanitizes too, but this keeps stored data clean).
        const content: string = sanitizePostHtml(body.content ?? '');
        const excerpt: string = body.excerpt ?? '';
        const featuredImage: string | null = body.featuredImage ?? null;
        const gradient: string | null = body.gradient || null;
        // draft | scheduled | published — see lib/scheduling.ts.
        const { status, scheduledAt } = resolvePublishState(body.status, body.scheduledAt);
        const publishedAt = status === 'published' ? new Date() : null;

        // SEO data (optional)
        const seo = body.seo ?? null;

        // Category IDs (optional) — array of numbers
        const categoryIds: number[] = Array.isArray(body.categoryIds)
            ? body.categoryIds.map((n: any) => Number(n)).filter((n: number) => !isNaN(n))
            : [];

        // Primary category (drives the /<category>/<slug> URL). Must be one of the
        // assigned categories; default to the first if unset/invalid.
        let primaryCategoryId: number | null = body.primaryCategoryId != null ? Number(body.primaryCategoryId) : null;
        if (primaryCategoryId == null || isNaN(primaryCategoryId) || !categoryIds.includes(primaryCategoryId)) {
            primaryCategoryId = categoryIds[0] ?? null;
        }

        const post = await prisma.post.create({
            data: {
                title,
                slug,
                content,
                excerpt,
                featuredImage,
                gradient,
                status,
                primaryCategoryId,
                scheduledAt,
                publishedAt,
                authorId: userId(auth.session),
                ...(seo && {
                    seo: {
                        create: {
                            focusKeyword:        seo.focusKeyword        ?? null,
                            metaTitle:           seo.metaTitle           ?? null,
                            metaDescription:     seo.metaDescription     ?? null,
                            robotsIndex:         seo.robotsIndex         ?? true,
                            robotsFollow:        seo.robotsFollow        ?? true,
                            canonicalUrl:        seo.canonicalUrl        ?? null,
                            ogTitle:             seo.ogTitle             ?? null,
                            ogDescription:       seo.ogDescription       ?? null,
                            ogImage:             seo.ogImage             ?? null,
                            twitterTitle:        seo.twitterTitle        ?? null,
                            twitterDescription:  seo.twitterDescription  ?? null,
                            schemaType:          seo.schemaType          ?? null,
                            schemaJson:          seo.schemaJson          ?? null,
                        },
                    },
                }),
                ...(categoryIds.length > 0 && {
                    categories: {
                        create: categoryIds.map(categoryId => ({ categoryId })),
                    },
                }),
            },
            include: {
                seo: true,
                categories: { include: { category: true } },
            },
        });

        const mapped = {
            ...post,
            categories: post.categories.map(pc => ({
                id: pc.category.id,
                name: pc.category.name,
                slug: pc.category.slug,
            })),
        };

        if (status === 'published') {
            void notifySubscribers({ title: post.title, slug: post.slug, excerpt: post.excerpt }).catch(() => {});
            // Instantly tell Bing/Yandex the new post + homepage changed. The
            // category archive changed too — a new entry appeared on it — and
            // /tag/<slug> is one of the few pages both Bing and Google have
            // actually indexed, so it is worth keeping fresh.
            const primaryCat = mapped.categories.find((c: any) => c.id === (post as any).primaryCategoryId) || mapped.categories[0];
            const postPath = primaryCat ? `/${primaryCat.slug}/${post.slug}` : null;
            const archivePath = primaryCat ? `/tag/${primaryCat.slug}` : null;
            void pingIndexNow([
                '/', '/sitemap.xml',
                ...(postPath ? [postPath] : []),
                ...(archivePath ? [archivePath] : []),
            ]);
        }

        const actorName = (auth.session.user as any)?.name ?? 'Someone';
        await recordEvent({
            type: 'post.create',
            action: `${actorName} ${status === 'published' ? 'published' : 'drafted'} a post`,
            description: `"${post.title}"`,
            link: `/admin/myprojects/blog/${post.id}`,
            actorUserId: userId(auth.session),
            notify: 'admins',
        });

        // Public announcement → notify EVERY user about a freshly published post,
        // linking to the public article. Drafts don't notify anyone.
        if (status === 'published') {
            await recordEvent({
                type: 'post.published',
                action: 'New post published',
                description: `"${post.title}"`,
                link: `/posts/${post.slug}`,
                actorUserId: userId(auth.session),
                notify: 'all',
                notifyMessage: `📝 New post: "${post.title}"`,
            });
        }

        return NextResponse.json(mapped, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/posts]', error);
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'A post with this slug already exists.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
