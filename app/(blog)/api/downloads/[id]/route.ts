/**
 * app/api/downloads/[id]/route.ts
 *
 * GET    /api/downloads/[id]  -> fetch single download with SEO
 * PATCH  /api/downloads/[id]  -> update download + upsert SEO
 * DELETE /api/downloads/[id]  -> delete download (SEO cascades)
 *
 * Next.js 16: params is a Promise — must be awaited
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { resolvePublishState } from '@/lib/scheduling';

type Params = { params: Promise<{ id: string }> };

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const download = await prisma.download.findUnique({
            where: { id },
            include: { seo: true },
        });
        if (!download) return NextResponse.json({ error: 'Download not found' }, { status: 404 });

        return NextResponse.json(download);
    } catch (error) {
        console.error('[GET /api/downloads/:id]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── PATCH ─────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
    const auth = await requirePermission('manage-downloads');
    if (auth.error) return auth.error;
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const body = await req.json();

        // Status-only fast path (used by the list's publish/unpublish toggle).
        // Toggling always clears any pending schedule — an explicit publish or
        // unpublish should win over a timer the author set earlier.
        if (!body.title && (body.status === 'published' || body.status === 'draft')) {
            const existing = await prisma.download.findUnique({ where: { id }, select: { publishedAt: true } });
            const dl = await prisma.download.update({
                where: { id },
                data: {
                    status: body.status,
                    scheduledAt: null,
                    publishedAt: body.status === 'published' ? (existing?.publishedAt ?? new Date()) : null,
                },
            });
            return NextResponse.json(dl);
        }

        const title: string = (body.title ?? '').trim();
        if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 422 });

        const slug = body.slug?.trim() || toSlug(title);
        // draft | scheduled | published — see lib/scheduling.ts.
        const { status, scheduledAt } = resolvePublishState(body.status, body.scheduledAt);

        const existing = await prisma.download.findUnique({ where: { id }, select: { publishedAt: true } });
        const publishedAt = status === 'published'
            ? (existing?.publishedAt ?? new Date())
            : null;

        const seo = body.seo ?? null;

        const tags: string = Array.isArray(body.tags)
            ? body.tags.join(',')
            : (body.tags ?? '');

        const download = await prisma.download.update({
            where: { id },
            data: {
                title,
                slug,
                excerpt:    body.excerpt    ?? '',
                fileUrl:    body.fileUrl    ?? '',
                fileType:   body.fileType   ?? 'PDF',
                fileSize:   body.fileSize   ?? '',
                icon:       body.icon       ?? '📄',
                gradient:   body.gradient   ?? 'gradientPurple',
                image:      body.image      || null,
                content:    body.content    ?? '',
                category:   body.category   ?? 'Tech',
                tags,
                featured:   body.featured   ?? false,
                free:       body.free       ?? true,
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
            },
            include: { seo: true },
        });

        return NextResponse.json(download);
    } catch (error: any) {
        console.error('[PATCH /api/downloads/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'Download not found' }, { status: 404 });
        if (error?.code === 'P2002') return NextResponse.json({ error: 'Slug already in use.' }, { status: 409 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── DELETE ────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('manage-downloads');
    if (auth.error) return auth.error;
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        await prisma.download.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[DELETE /api/downloads/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'Download not found' }, { status: 404 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
