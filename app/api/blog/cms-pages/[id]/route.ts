/**
 * app/api/blog/cms-pages/[id]/route.ts
 *
 * GET    /api/blog/cms-pages/:id  -> single page (+ SEO)   [admin]
 * PUT    /api/blog/cms-pages/:id  -> update page + SEO, recompute seoScore
 * DELETE /api/blog/cms-pages/:id  -> delete page (SEO cascades)
 */

import { NextRequest, NextResponse } from 'next/server';
import sanitizeHtml from 'sanitize-html';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { analyzeSeo, normalizeSeo, type SeoData } from '@/lib/seo/scoring';
import { resolvePublishState } from '@/lib/scheduling';
import { pingIndexNow } from '@/lib/indexnow';

const SITE_KEY = 'blog';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://inkdrop.blog';
// See the note in ../route.ts — "contact" is intentionally allowed, because the
// /contact route reads a CMS page with that slug as its content source.
const RESERVED = new Set(['admin', 'api', 'yt', 'posts', 'tag', 'downloads', 'u', 'account', 'login', 'signup', 'messages', 'notifications', 'verify-email', 'sitemap.xml', 'robots.txt', '_next']);

const toSlug = (v: string) =>
    v.trim().toLowerCase()
        .replace(/^\/+|\/+$/g, '')
        .replace(/[^\w\s/-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

const SANITIZE: sanitizeHtml.IOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
        'ul', 'ol', 'li', 'strong', 'em', 'u', 's', 'a', 'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
    ],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height', 'loading'], '*': ['class'] },
    allowedSchemes: ['https', 'http', 'mailto'],
};

function seoWriteData(seo: Partial<SeoData>) {
    return {
        focusKeyword: seo.focusKeyword ?? null,
        metaTitle: seo.metaTitle ?? null,
        metaDescription: seo.metaDescription ?? null,
        robotsIndex: seo.robotsIndex ?? true,
        robotsFollow: seo.robotsFollow ?? true,
        canonicalUrl: seo.canonicalUrl ?? null,
        ogTitle: seo.ogTitle ?? null,
        ogDescription: seo.ogDescription ?? null,
        ogImage: seo.ogImage ?? null,
        twitterTitle: seo.twitterTitle ?? null,
        twitterDescription: seo.twitterDescription ?? null,
        schemaType: seo.schemaType ?? null,
        schemaJson: seo.schemaJson ?? null,
    };
}

async function getId(ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    return Number(id);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    const id = await getId(ctx);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
    try {
        const page = await prisma.cmsPage.findUnique({ where: { id }, include: { seo: true } });
        if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(page);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Server error';
        console.error('[GET /api/blog/cms-pages/:id]', e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    const id = await getId(ctx);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

    try {
        const existing = await prisma.cmsPage.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await req.json();
        const title: string = (body.title ?? existing.title).trim();
        const slug = toSlug(body.slug || existing.slug);
        if (RESERVED.has(slug.split('/')[0]))
            return NextResponse.json({ error: `Slug "${slug}" is reserved` }, { status: 422 });

        const content = sanitizeHtml(body.content ?? existing.content, SANITIZE);
        // draft | scheduled | published. If the client omits `status` entirely we
        // keep the row as-is, so a partial save can't silently unpublish a page.
        const { status, scheduledAt } = body.status === undefined
            ? { status: existing.status, scheduledAt: (existing as any).scheduledAt ?? null }
            : resolvePublishState(body.status, body.scheduledAt);
        // normalizeSeo fills in every missing field with a safe default. Without
        // it a partial payload (e.g. `{ metaTitle }` from an API client) reached
        // analyzeSeo, whose .trim() calls threw on the undefined fields and
        // turned an ordinary save into a 500.
        const seo: SeoData | null = body.seo ? normalizeSeo(body.seo) : null;
        const score = seo ? analyzeSeo(seo, title, content, slug, SITE_URL).score : existing.seoScore;

        const page = await prisma.cmsPage.update({
            where: { id },
            data: {
                title, slug, content, status, scheduledAt,
                blocks: typeof body.blocks === 'string' ? body.blocks : null,
                sidebar: typeof body.sidebar === 'string' ? body.sidebar : (existing as any).sidebar,
                heroBg: typeof body.heroBg === 'string' ? body.heroBg.slice(0, 500) : (existing as any).heroBg,
                tags: typeof body.tags === 'string' ? body.tags.slice(0, 500) : (existing as any).tags,
                layout: body.layout === 'boxed' ? 'boxed' : (body.layout === 'wide' ? 'wide' : (existing as any).layout ?? 'wide'),
                seoScore: score,
                publishedAt: status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt,
                ...(seo && { seo: { upsert: { create: seoWriteData(seo), update: seoWriteData(seo) } } }),
            },
            include: { seo: true },
        });

        // IndexNow: same treatment posts already get. Without this a hub page
        // like /phptutorials could be published and edited for weeks and Bing
        // would never be told it existed.
        if (status === 'published') void pingIndexNow(['/', '/sitemap.xml', `/${page.slug}`]);

        return NextResponse.json(page);
    } catch (e: unknown) {
        if (typeof e === 'object' && e && (e as { code?: string }).code === 'P2002')
            return NextResponse.json({ error: 'A page with this slug already exists.' }, { status: 409 });
        console.error('[PUT /api/blog/cms-pages/:id]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    const id = await getId(ctx);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
    try {
        const body = await req.json();
        const data: Record<string, unknown> = {};
        if (body.status === 'published' || body.status === 'draft') {
            data.status = body.status;
            // An explicit publish/unpublish from the list beats any pending timer.
            data.scheduledAt = null;
            const existing = await prisma.cmsPage.findUnique({ where: { id } });
            if (body.status === 'published' && existing && !existing.publishedAt) data.publishedAt = new Date();
        }
        if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 422 });
        const page = await prisma.cmsPage.update({ where: { id }, data });

        // Publishing straight from the pages list goes through PATCH, not PUT,
        // so it needs its own ping or that route stays invisible to Bing.
        if (data.status === 'published') void pingIndexNow(['/', '/sitemap.xml', `/${page.slug}`]);

        return NextResponse.json(page);
    } catch (e) {
        console.error('[PATCH /api/blog/cms-pages/:id]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    const id = await getId(ctx);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
    try {
        await prisma.cmsPage.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[DELETE /api/blog/cms-pages/:id]', e);
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
}
