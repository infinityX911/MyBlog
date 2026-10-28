/**
 * app/api/settings/[id]/route.ts
 *
 * GET   /api/settings/[id]  -> fetch single site setting with pages (requires 'manage-settings')
 * PATCH /api/settings/[id]  -> update site setting + upsert page SEO entries (requires 'manage-settings')
 *
 * Next.js 16: params is a Promise — must be awaited
 *
 * SECURITY: previously unauthenticated (anyone could read/modify any site's
 * settings). Now gated behind 'manage-settings'. proxy.ts does NOT match
 * /api/settings, so these in-handler checks are the only gate — keep them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

type Params = { params: Promise<{ id: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('manage-settings');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const setting = await prisma.siteSetting.findUnique({
            where: { id },
            include: { pages: true },
        });
        if (!setting) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(setting);
    } catch (error) {
        console.error('[GET /api/settings/:id]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
    const auth = await requirePermission('manage-settings');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const body = await req.json();

        // Update main site setting
        const setting = await prisma.siteSetting.update({
            where: { id },
            data: {
                siteName:               (body.siteName               ?? '').trim(),
                siteType:               body.siteType                ?? 'custom',
                tagline:                body.tagline                 ?? null,
                emailAddress:           body.emailAddress            ?? null,
                websiteUrl:             body.websiteUrl              ?? null,
                description:            body.description             ?? null,
                defaultMetaTitle:       body.defaultMetaTitle        ?? null,
                defaultMetaDescription: body.defaultMetaDescription  ?? null,
                titleSeparator:         body.titleSeparator          ?? '|',
                defaultRobotsIndex:     body.defaultRobotsIndex      ?? true,
                defaultRobotsFollow:    body.defaultRobotsFollow     ?? true,
                ogImage:                body.ogImage                 ?? null,
                siteIcon:               body.siteIcon                ?? null,
                themeColor:             body.themeColor              ?? '#5b4fcf',
                metaKeywords:           body.metaKeywords            ?? null,
                twitterHandle:          body.twitterHandle           ?? null,
                authorEnabled:          body.authorEnabled           ?? true,
                authorName:             body.authorName              ?? null,
                authorImage:            body.authorImage             ?? null,
                authorBio:              body.authorBio               ?? null,
                authorLink:             body.authorLink              ?? null,
                aboutStats:             body.aboutStats              ?? null,
                sitemapEnabled:         body.sitemapEnabled          ?? true,
                notifyOnRegister:       body.notifyOnRegister        ?? true,
                registrationEnabled:    body.registrationEnabled     ?? true,
                directMessageNotify:    body.directMessageNotify     ?? false,
                membershipApproval:     body.membershipApproval      ?? false,
                hideViewCounts:         body.hideViewCounts          ?? false,
                hidePostTags:           body.hidePostTags            ?? false,
                // "Removed" wins over "Enabled" — see the note in the schema.
                announcementsRemoved:   body.announcementsRemoved    ?? false,
                membersRemoved:         body.membersRemoved          ?? false,
                announcementsEnabled:   body.announcementsRemoved ? false : (body.announcementsEnabled ?? false),
                membersEnabled:         body.membersRemoved       ? false : (body.membersEnabled       ?? false),
            },
        });

        // Upsert per-page SEO entries if provided
        if (Array.isArray(body.pages) && body.pages.length > 0) {
            for (const page of body.pages) {
                await prisma.pageSeo.upsert({
                    where: {
                        siteSettingId_pageSlug: {
                            siteSettingId: id,
                            pageSlug: page.pageSlug,
                        },
                    },
                    create: {
                        siteSettingId:   id,
                        pageSlug:        page.pageSlug,
                        pageLabel:       page.pageLabel        ?? page.pageSlug,
                        metaTitle:       page.metaTitle        ?? null,
                        metaDescription: page.metaDescription  ?? null,
                        robotsIndex:     page.robotsIndex      ?? true,
                        robotsFollow:    page.robotsFollow     ?? true,
                        canonicalUrl:    page.canonicalUrl     ?? null,
                        ogTitle:         page.ogTitle          ?? null,
                        ogDescription:   page.ogDescription    ?? null,
                        ogImage:         page.ogImage          ?? null,
                    },
                    update: {
                        pageLabel:       page.pageLabel        ?? page.pageSlug,
                        metaTitle:       page.metaTitle        ?? null,
                        metaDescription: page.metaDescription  ?? null,
                        robotsIndex:     page.robotsIndex      ?? true,
                        robotsFollow:    page.robotsFollow     ?? true,
                        canonicalUrl:    page.canonicalUrl     ?? null,
                        ogTitle:         page.ogTitle          ?? null,
                        ogDescription:   page.ogDescription    ?? null,
                        ogImage:         page.ogImage          ?? null,
                    },
                });
            }

            // Remove page-SEO rows the user deleted in the editor
            const keepSlugs: string[] = body.pages.map((p: any) => p.pageSlug).filter(Boolean);
            await prisma.pageSeo.deleteMany({
                where: { siteSettingId: id, pageSlug: { notIn: keepSlugs.length ? keepSlugs : ['__none__'] } },
            });
        }

        const updated = await prisma.siteSetting.findUnique({
            where: { id },
            include: { pages: true },
        });

        // Bust the cross-request site-config cache so robots.txt, sitemap.xml
        // and generateMetadata reflect this save on the very next request.
        revalidateTag(`site:${setting.siteKey}`, 'max');

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('[PATCH /api/settings/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// Remove a site (and its per-page SEO, which cascades). Used by the Sites tab.
export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('manage-settings');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        await prisma.pageSeo.deleteMany({ where: { siteSettingId: id } });
        await prisma.siteSetting.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[DELETE /api/settings/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
