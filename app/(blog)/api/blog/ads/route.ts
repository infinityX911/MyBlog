/**
 * app/(blog)/api/blog/ads/route.ts
 * GET  /api/blog/ads  -> current AdSense config (admin editor)   [admin]
 * PUT  /api/blog/ads  -> save AdSense config                     [admin]
 *
 * The public site reads ads via getAdsConfig() directly (server components);
 * this API is only for the admin editor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { getAdsConfig, AD_POSITIONS, type AdPosition } from '@/lib/ads';

const SITE_KEY = 'blog';

export async function GET() {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    return NextResponse.json(await getAdsConfig(SITE_KEY));
}

export async function PUT(req: NextRequest) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    try {
        const body = await req.json();
        const enabled = body.enabled === true;
        const clientId = String(body.clientId ?? '').trim().slice(0, 60);
        // Keep only the known positions; cap each code length.
        const slotsIn = (body.slots && typeof body.slots === 'object') ? body.slots : {};
        const slots: Record<string, string> = {};
        for (const pos of AD_POSITIONS as AdPosition[]) {
            slots[pos] = String(slotsIn[pos] ?? '').slice(0, 4000);
        }

        await prisma.siteSetting.upsert({
            where: { siteKey: SITE_KEY },
            create: { siteKey: SITE_KEY, siteName: 'Blog', adsEnabled: enabled, adsClientId: clientId, adsSlots: JSON.stringify(slots) },
            update: { adsEnabled: enabled, adsClientId: clientId, adsSlots: JSON.stringify(slots) },
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[PUT /api/blog/ads]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
