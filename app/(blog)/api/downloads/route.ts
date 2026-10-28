/**
 * app/api/downloads/route.ts
 *
 * GET  /api/downloads  -> list all downloads with SEO
 * POST /api/downloads  -> create a new download with optional SEO
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, userId } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';
import { resolvePublishState } from '@/lib/scheduling';
import { pingIndexNow } from '@/lib/indexnow';

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET() {
    try {
        const downloads = await prisma.download.findMany({
            include: { seo: true },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(downloads);
    } catch (error) {
        console.error('[GET /api/downloads]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const auth = await requirePermission('manage-downloads');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const title: string = (body.title ?? '').trim();
        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 422 });
        }

        const slug = body.slug?.trim() || toSlug(title);
        // draft | scheduled | published — see lib/scheduling.ts.
        const { status, scheduledAt } = resolvePublishState(body.status, body.scheduledAt);
        const publishedAt = status === 'published' ? new Date() : null;

        const seo = body.seo ?? null;

        const tags: string = Array.isArray(body.tags)
            ? body.tags.join(',')
            : (body.tags ?? '');

        const download = await prisma.download.create({
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
                    },
                }),
            },
            include: { seo: true },
        });

        await recordEvent({
            type: 'download.create',
            action: `${(auth.session.user as any)?.name ?? 'Someone'} added a download`,
            description: `"${download.title}"`,
            link: '/admin/myprojects/downloads',
            actorUserId: userId(auth.session),
            notify: 'admins',
        });

        // /downloads is public and sitemapped, so a new entry changes it.
        if (status === 'published') void pingIndexNow(['/downloads', '/sitemap.xml']);

        return NextResponse.json(download, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/downloads]', error);
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'A download with this slug already exists.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
