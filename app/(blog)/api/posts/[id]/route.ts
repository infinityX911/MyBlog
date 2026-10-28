/**
 * app/api/posts/[id]/route.ts
 *
 * GET    /api/posts/[id]  -> fetch single post with SEO + categories (requires 'view-posts')
 * PATCH  /api/posts/[id]  -> update post + upsert SEO + sync categories (requires 'update-posts')
 * DELETE /api/posts/[id]  -> delete post (requires 'delete-posts')
 *
 * Next.js 16: params is a Promise — must be awaited
 *
 * SECURITY: this route previously had no auth check at all. All three
 * verbs are now permission-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pingIndexNow } from '@/lib/indexnow';
import { prisma } from '@/lib/prisma';
import { notifySubscribers } from '@/lib/subscribers';
import { requirePermission, userId } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';
import { sanitizePostHtml } from '@/lib/contentHtml';
import { resolvePublishState } from '@/lib/scheduling';

type Params = { params: Promise<{ id: string }> };

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('view-posts');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const post = await prisma.post.findUnique({
            where: { id },
            include: {
                seo: true,
                categories: { include: { category: true } },
            },
        });
        if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

        const mapped = {
            ...post,
            categories: post.categories.map(pc => ({
                id: pc.category.id,
                name: pc.category.name,
                slug: pc.category.slug,
            })),
        };

        return NextResponse.json(mapped);
    } catch (error) {
        console.error('[GET /api/posts/:id]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
    const auth = await requirePermission('update-posts');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const body = await req.json();
        const title: string = (body.title ?? '').trim();
        if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 422 });

        const slug = body.slug?.trim() || toSlug(title);
        // draft | scheduled | published — see lib/scheduling.ts.
        const { status, scheduledAt } = resolvePublishState(body.status, body.scheduledAt);

        // If publishing for first time, set publishedAt
        const existing = await prisma.post.findUnique({ where: { id }, select: { publishedAt: true, status: true, slug: true } });

        // ── Slug changed → auto-create a permanent redirect (old → new) so
        //    previously-shared links don't 404 (protects SEO). ──────────────
        if (existing && existing.slug && existing.slug !== slug) {
            const fromPath = `/posts/${existing.slug}`;
            const toPath   = `/posts/${slug}`;
            try {
                // Re-point any existing redirects that pointed at the OLD path
                // to the NEW path (avoid redirect chains).
                await prisma.redirect.updateMany({ where: { toPath: fromPath }, data: { toPath } });
                // Remove a stale redirect that would now collide / loop.
                await prisma.redirect.deleteMany({ where: { fromPath: toPath } });
                await prisma.redirect.upsert({
                    where: { fromPath },
                    create: { fromPath, toPath, statusCode: 308 },
                    update: { toPath, statusCode: 308 },
                });
            } catch (e) {
                console.error('[posts PATCH] redirect upsert failed:', e);
            }
        }
        const publishedAt = status === 'published'
            ? (existing?.publishedAt ?? new Date())
            : null;

        const seo = body.seo ?? null;

        // Category IDs — if provided (even empty array), fully sync (replace) the set
        const categoryIds: number[] | null = Array.isArray(body.categoryIds)
            ? body.categoryIds.map((n: any) => Number(n)).filter((n: number) => !isNaN(n))
            : null;

        // Primary category (drives the /<category>/<slug> URL). Only update it when
        // categories were sent; clamp to one of the assigned categories.
        let primaryCategoryId: number | null | undefined = undefined;
        if (categoryIds !== null) {
            primaryCategoryId = body.primaryCategoryId != null ? Number(body.primaryCategoryId) : null;
            if (primaryCategoryId == null || isNaN(primaryCategoryId) || !categoryIds.includes(primaryCategoryId)) {
                primaryCategoryId = categoryIds[0] ?? null;
            }
        }

        const post = await prisma.post.update({
            where: { id },
            data: {
                title,
                slug,
                ...(primaryCategoryId !== undefined && { primaryCategoryId }),
                content:      sanitizePostHtml(body.content ?? ''),
                excerpt:      body.excerpt       ?? '',
                featuredImage: body.featuredImage ?? null,
                gradient: body.gradient || null,
                status,
                scheduledAt,
                publishedAt,
                ...(seo && {
                    seo: {
                        upsert: {
                            create: {
                                focusKeyword:       seo.focusKeyword       ?? null,
                                metaTitle:          seo.metaTitle          ?? null,
                                metaDescription:    seo.metaDescription    ?? null,
                                robotsIndex:        seo.robotsIndex        ?? true,
                                robotsFollow:       seo.robotsFollow       ?? true,
                                canonicalUrl:       seo.canonicalUrl       ?? null,
                                ogTitle:            seo.ogTitle            ?? null,
                                ogDescription:      seo.ogDescription      ?? null,
                                ogImage:            seo.ogImage            ?? null,
                                twitterTitle:       seo.twitterTitle       ?? null,
                                twitterDescription: seo.twitterDescription ?? null,
                                schemaType:         seo.schemaType         ?? null,
                                schemaJson:         seo.schemaJson         ?? null,
                            },
                            update: {
                                focusKeyword:       seo.focusKeyword       ?? null,
                                metaTitle:          seo.metaTitle          ?? null,
                                metaDescription:    seo.metaDescription    ?? null,
                                robotsIndex:        seo.robotsIndex        ?? true,
                                robotsFollow:       seo.robotsFollow       ?? true,
                                canonicalUrl:       seo.canonicalUrl       ?? null,
                                ogTitle:            seo.ogTitle            ?? null,
                                ogDescription:      seo.ogDescription      ?? null,
                                ogImage:            seo.ogImage            ?? null,
                                twitterTitle:       seo.twitterTitle       ?? null,
                                twitterDescription: seo.twitterDescription ?? null,
                                schemaType:         seo.schemaType         ?? null,
                                schemaJson:         seo.schemaJson         ?? null,
                            },
                        },
                    },
                }),
                ...(categoryIds !== null && {
                    categories: {
                        deleteMany: {},
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

        await recordEvent({
            type: 'post.update',
            action: `${(auth.session.user as any)?.name ?? 'Someone'} updated a post`,
            description: `"${post.title}"`,
            link: `/admin/myprojects/blog/${post.id}`,
            actorUserId: userId(auth.session),
            notify: 'admins',
        });

        // A draft going live for the first time → announce to every user (once).
        if (existing?.status !== 'published' && status === 'published') {
            await recordEvent({
                type: 'post.published',
                action: 'New post published',
                description: `"${post.title}"`,
                link: `/posts/${post.slug}`,
                actorUserId: userId(auth.session),
                notify: 'all',
                notifyMessage: `📝 New post: "${post.title}"`,
            });
            // Email + browser-push subscribers (only the first time it goes live)
            void notifySubscribers({ title: post.title, slug: post.slug, excerpt: post.excerpt }).catch(() => {});
        }

        // IndexNow: ping on ANY published save (new publish OR edit of a live
        // post) so Bing/Yandex re-crawl the changed article + homepage promptly.
        // The category archive is included because it lists this post, and
        // /tag/<slug> is one of the few URLs both engines have indexed.
        if (status === 'published') {
            const primaryCat = mapped.categories.find((c: any) => c.id === (post as any).primaryCategoryId) || mapped.categories[0];
            const postPath = primaryCat ? `/${primaryCat.slug}/${post.slug}` : null;
            const archivePath = primaryCat ? `/tag/${primaryCat.slug}` : null;
            void pingIndexNow([
                '/', '/sitemap.xml',
                ...(postPath ? [postPath] : []),
                ...(archivePath ? [archivePath] : []),
            ]);
        }

        return NextResponse.json(mapped);
    } catch (error: any) {
        console.error('[PATCH /api/posts/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        if (error?.code === 'P2002') return NextResponse.json({ error: 'Slug already in use.' }, { status: 409 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('delete-posts');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const removed = await prisma.post.findUnique({ where: { id }, select: { title: true } });
        await prisma.post.delete({ where: { id } });
        await recordEvent({
            type: 'post.delete',
            action: `${(auth.session.user as any)?.name ?? 'Someone'} deleted a post`,
            description: removed ? `"${removed.title}"` : undefined,
            link: '/admin/myprojects/blog',
            actorUserId: userId(auth.session),
            notify: 'admins',
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[DELETE /api/posts/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
