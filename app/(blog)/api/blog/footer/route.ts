/**
 * app/(blog)/api/blog/footer/route.ts
 *
 * GET  /api/blog/footer  -> current footer config (for the admin editor)  [admin]
 * PUT  /api/blog/footer  -> save footer config                            [admin]
 *
 * The public footer renders via getFooterConfig() directly in the Footer
 * server component — this API is only for the admin editor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { getFooterConfig, type FooterColumn, type FooterSocial } from '@/lib/footer';

const SITE_KEY = 'blog';

// GET is public: the footer content is shown on every public page anyway, and
// the client <Footer/> component fetches this. Only PUT (below) is admin-gated.
export async function GET() {
    return NextResponse.json(await getFooterConfig(SITE_KEY));
}

export async function PUT(req: NextRequest) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        // Sanitize into the expected shape (drop anything malformed).
        const columns: FooterColumn[] = Array.isArray(body.columns)
            ? body.columns.map((c: any) => ({
                  heading: String(c?.heading ?? '').slice(0, 60),
                  links: Array.isArray(c?.links)
                      ? c.links.map((l: any) => ({
                            label: String(l?.label ?? '').slice(0, 60),
                            url: String(l?.url ?? '').slice(0, 300),
                        }))
                      : [],
              }))
            : [];

        const socials: FooterSocial[] = Array.isArray(body.socials)
            ? body.socials.map((s: any) => ({
                  platform: String(s?.platform ?? 'website').slice(0, 30),
                  url: String(s?.url ?? '').slice(0, 300),
              }))
            : [];

        const bottomText = String(body.bottomText ?? '').slice(0, 300);

        await prisma.footerConfig.upsert({
            where: { siteKey: SITE_KEY },
            create: { siteKey: SITE_KEY, columns: JSON.stringify(columns), socials: JSON.stringify(socials), bottomText },
            update: { columns: JSON.stringify(columns), socials: JSON.stringify(socials), bottomText },
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[PUT /api/blog/footer]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
