/**
 * 09-seo-save-api.ts  →  deploy as  app/api/cms-pages/[id]/route.ts
 * (create endpoint app/api/cms-pages/route.ts follows the identical pattern)
 *
 * SECURE PERSISTENCE PIPELINE for CMS pages + their SEO satellite.
 * Three non-negotiables demonstrated here:
 *
 *   1. NEVER trust the client's SEO score. The panel's live score is advisory
 *      UI; the authoritative CmsPage.seoScore is recomputed HERE from the
 *      sanitized content with the same pure engine (file 08). A tampered
 *      request can't award itself "89 Good".
 *   2. Sanitize HTML at WRITE time (sanitize-html — already in your deps),
 *      then again implicitly at render time via <SafeHtml> (file 10).
 *      Defense in depth: rows are clean even if a future consumer forgets.
 *   3. Slug safety: normalize → validate against RESERVED_SLUGS (file 04) →
 *      rely on the compound unique (siteSettingId, slug) for per-tenant
 *      collision handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getToken } from 'next-auth/jwt';
import sanitizeHtml from 'sanitize-html';
import { prisma } from '@/lib/prisma';
import { getSiteByKey, siteOrigin } from '@/lib/site-context';
import { normalizeCmsSlug, validateCmsSlug } from '@/lib/reserved-slugs';
import { adapters, analyzeSeo, toSeoData } from '@/lib/seo/engine';
import type { SeoData } from '@/lib/seo/scoring';

// ─── Sanitization policy for CMS/editor markup ───────────────────────────────
// Allowlist, not blocklist: everything not listed is stripped. Notably absent:
// <script>, <iframe>, <style>, event handler attributes, javascript: URLs.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
        'ul', 'ol', 'li', 'strong', 'em', 'u', 's', 'a', 'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
    ],
    allowedAttributes: {
        a: ['href', 'title', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
        '*': ['class'], // Tailwind tw:* classes from the editor survive
    },
    // Kills javascript:, data:text/html and friends on href/src.
    allowedSchemes: ['https', 'http', 'mailto'],
    // External links can't reach window.opener.
    transformTags: {
        a: (tag, attribs) => ({
            tagName: 'a',
            attribs: attribs.target === '_blank'
                ? { ...attribs, rel: 'noopener noreferrer' }
                : attribs,
        }),
    },
};

// ─── Auth helper: same RBAC contract as the rest of the admin API surface ────
async function requirePermission(req: NextRequest, permission: string) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const perms = (token?.permissions as string[] | undefined) ?? [];
    if (!token || !perms.includes(permission)) return null;
    return token;
}

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/cms-pages/:id — update page + SEO, recompute score, revalidate
// ═════════════════════════════════════════════════════════════════════════════
export async function PUT(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> }, // Next 16: params is a Promise
) {
    const auth = await requirePermission(req, 'manage-pages');
    if (!auth) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    const { id } = await ctx.params;
    const pageId = Number(id);
    if (!Number.isInteger(pageId)) {
        return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    // ── 1. Load the row WITH its tenant — all writes stay tenant-scoped ──────
    const existing = await prisma.cmsPage.findUnique({
        where: { id: pageId },
        include: { siteSetting: true, seo: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    // ── 2. Slug: normalize → reserved-word/system-path validation ────────────
    const slug = normalizeCmsSlug(String(body.slug ?? existing.slug));
    const verdict = validateCmsSlug(slug);
    if (!verdict.ok) {
        return NextResponse.json(
            { error: `Slug rejected (${verdict.reason})`, offendingSegment: verdict.offendingSegment },
            { status: 422 },
        );
    }

    // ── 3. Content: sanitize BEFORE anything else touches it ─────────────────
    const title = String(body.title ?? existing.title).trim().slice(0, 255);
    const content = sanitizeHtml(String(body.content ?? existing.content), SANITIZE_OPTIONS);

    // ── 4. SEO fields: coerce through toSeoData (unknown → typed, no extras) ─
    const seoInput: SeoData = toSeoData(body.seo ?? existing.seo);

    // ── 5. AUTHORITATIVE score — server-side, from sanitized inputs ──────────
    const site = existing.siteSetting;
    const analysis = analyzeSeo(
        adapters.cmsPage({ title, slug, content, seo: seoInput }, siteOrigin(site)),
    );

    // ── 6. Persist atomically: page + satellite + denormalized score ─────────
    try {
        const updated = await prisma.cmsPage.update({
            where: { id: pageId },
            data: {
                title,
                slug,
                content,
                seoScore: analysis.score,
                status: body.status === 'published' ? 'published' : 'draft',
                publishedAt:
                    body.status === 'published' && !existing.publishedAt
                        ? new Date() : existing.publishedAt,
                seo: {
                    upsert: {
                        create: seoInput,
                        update: seoInput,
                    },
                },
            },
            include: { seo: true },
        });

        // ── 7. Cache coherence: the public page + this tenant's sitemap ──────
        revalidatePath(`/${slug}`);            // visible path (blog tenant)
        revalidatePath(`/yt/${slug}`);         // internal path (prefixed tenants)
        revalidateTag(`site:${site.siteKey}`); // sitemap/robots pick up changes

        // Echo the server analysis so the panel can reconcile its live score
        // with the authoritative one (they match unless the client tampered).
        return NextResponse.json({ page: updated, seoAnalysis: analysis });
    } catch (err: unknown) {
        // Compound-unique violation → duplicate slug within THIS site only.
        if (typeof err === 'object' && err && (err as { code?: string }).code === 'P2002') {
            return NextResponse.json(
                { error: `A page with slug "${slug}" already exists on this site.` },
                { status: 409 },
            );
        }
        throw err;
    }
}
