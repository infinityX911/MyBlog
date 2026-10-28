/**
 * app/api/blog/cms-pages/route.ts
 *
 * GET  /api/yt/cms-pages  -> list all yt CMS pages (+ SEO)   [admin]
 * POST /api/yt/cms-pages  -> create a page (+ SEO), server-computed seoScore
 *
 * Reuses the SAME auth + SEO conventions as the Blog/Downloads admin, so the
 * existing SeoPanel + analyzeSeo() drive the health score with zero new logic.
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

// Reserved first-segments a CMS slug may never claim (would shadow system paths).
// Slugs a CMS page may not take, because a real route already owns that path
// and the page would only ever be shadowed by it.
//
// "contact" is deliberately NOT here. /contact is a real route, but it reads a
// CMS page with this exact slug for its sidebar widgets and SEO — so creating
// one is the supported way to edit that page, not a collision.
const RESERVED = new Set(['admin', 'api', 'yt', 'posts', 'tag', 'downloads', 'u', 'account', 'login', 'signup', 'messages', 'notifications', 'verify-email', 'sitemap.xml', 'robots.txt', '_next']);

const toSlug = (v: string) =>
    v.trim().toLowerCase()
        .replace(/^\/+|\/+$/g, '')
        .replace(/[^\w\s/-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

// Allowlist sanitizer for CMS HTML (no <script>/<iframe>/handlers).
const SANITIZE: sanitizeHtml.IOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
        'ul', 'ol', 'li', 'strong', 'em', 'u', 's', 'a', 'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
    ],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height', 'loading'], '*': ['class'] },
    allowedSchemes: ['https', 'http', 'mailto'],
};

function seoCreateData(seo: Partial<SeoData> | null) {
    if (!seo) return undefined;
    return {
        create: {
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
        },
    };
}

export async function GET() {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    try {
        const pages = await prisma.cmsPage.findMany({
            where: { siteKey: SITE_KEY },
            include: { seo: true },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(pages);
    } catch (e) {
        console.error('[GET /api/yt/cms-pages]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    try {
        const body = await req.json();
        const title: string = (body.title ?? '').trim();
        if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 422 });

        const slug = toSlug(body.slug || title);
        if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 422 });
        if (RESERVED.has(slug.split('/')[0]))
            return NextResponse.json({ error: `Slug "${slug}" is reserved` }, { status: 422 });

        const content = sanitizeHtml(body.content ?? '', SANITIZE);
        // draft | scheduled | published — see lib/scheduling.ts.
        const { status, scheduledAt } = resolvePublishState(body.status, body.scheduledAt);
        // Fill any missing SEO field with a safe default before scoring — a
        // partial payload used to blow up analyzeSeo's .trim() calls and 500.
        const seo: SeoData | null = body.seo ? normalizeSeo(body.seo) : null;

        // Authoritative SEO score — recomputed server-side from sanitized input.
        const score = seo ? analyzeSeo(seo, title, content, slug, SITE_URL).score : null;

        const page = await prisma.cmsPage.create({
            data: {
                siteKey: SITE_KEY,
                title, slug, content, status, scheduledAt,
                blocks: typeof body.blocks === 'string' ? body.blocks : null,
                sidebar: typeof body.sidebar === 'string' ? body.sidebar : null,
                heroBg: typeof body.heroBg === 'string' ? body.heroBg.slice(0, 500) : null,
                tags: typeof body.tags === 'string' ? body.tags.slice(0, 500) : null,
                layout: body.layout === 'boxed' ? 'boxed' : 'wide',
                seoScore: score,
                publishedAt: status === 'published' ? new Date() : null,
                seo: seoCreateData(seo),
            },
            include: { seo: true },
        });

        // Tell Bing/Yandex about a new hub the moment it goes live.
        if (status === 'published') void pingIndexNow(['/', '/sitemap.xml', `/${page.slug}`]);

        return NextResponse.json(page, { status: 201 });
    } catch (e: unknown) {
        if (typeof e === 'object' && e && (e as { code?: string }).code === 'P2002')
            return NextResponse.json({ error: 'A page with this slug already exists.' }, { status: 409 });
        console.error('[POST /api/yt/cms-pages]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
