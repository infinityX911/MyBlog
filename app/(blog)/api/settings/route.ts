/**
 * app/api/settings/route.ts
 *
 * GET  /api/settings         -> list all site settings   (requires 'manage-settings')
 * POST /api/settings         -> create or upsert a site setting + its per-page SEO entries (requires 'manage-settings')
 *
 * SECURITY: these endpoints were previously UNAUTHENTICATED — anyone could
 * read every site's settings or overwrite them (e.g. flip robotsIndex off to
 * deindex the whole site, or change the website URL). Now gated behind the
 * 'manage-settings' permission. Note: proxy.ts does NOT cover /api/settings,
 * so this in-handler check is the only line of defense — keep it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
    const auth = await requirePermission('manage-settings');
    if (auth.error) return auth.error;

    try {
        const settings = await prisma.siteSetting.findMany({
            include: { pages: true },
            orderBy: { id: 'asc' },
        });
        return NextResponse.json(settings);
    } catch (error) {
        console.error('[GET /api/settings]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const auth = await requirePermission('manage-settings');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const siteKey: string = (body.siteKey ?? '').trim().toLowerCase();
        if (!siteKey) {
            return NextResponse.json({ error: 'siteKey is required' }, { status: 422 });
        }

        const data = {
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
            // "Removed" is the stronger switch, so it wins: a section that 404s
            // cannot also be enabled. Forcing it here rather than trusting the
            // form means the two flags can never be saved in a contradictory
            // state, whatever posts to this endpoint.
            announcementsRemoved:   body.announcementsRemoved    ?? false,
            membersRemoved:         body.membersRemoved          ?? false,
            announcementsEnabled:   body.announcementsRemoved ? false : (body.announcementsEnabled ?? false),
            membersEnabled:         body.membersRemoved       ? false : (body.membersEnabled       ?? false),
        };

        const setting = await prisma.siteSetting.upsert({
            where: { siteKey },
            create: { siteKey, ...data },
            update: data,
        });

        // Upsert per-page SEO entries if provided
        // (mirrors the logic in app/api/settings/[id]/route.ts PATCH)
        if (Array.isArray(body.pages) && body.pages.length > 0) {
            for (const page of body.pages) {
                await prisma.pageSeo.upsert({
                    where: {
                        siteSettingId_pageSlug: {
                            siteSettingId: setting.id,
                            pageSlug: page.pageSlug,
                        },
                    },
                    create: {
                        siteSettingId:   setting.id,
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
        }

        const result = await prisma.siteSetting.findUnique({
            where: { id: setting.id },
            include: { pages: true },
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[POST /api/settings]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
