/**
 * /api/admin-branding
 *
 * Global admin-panel branding (logo image + brand text shown in the admin
 * navbar/sidebar). Stored on the canonical 'blog' SiteSetting row so it stays
 * a single global value regardless of how many sites exist.
 *
 *   GET  -> { adminLogo, adminBrand }            (public — used by the navbar)
 *   PUT  -> save { adminLogo?, adminBrand? }     (requires 'manage-settings')
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

const KEY = 'blog';

export async function GET() {
    try {
        const s = await prisma.siteSetting.findUnique({
            where: { siteKey: KEY },
            select: { adminLogo: true, adminBrand: true },
        });
        return NextResponse.json({
            adminLogo: s?.adminLogo ?? '',
            adminBrand: s?.adminBrand ?? '',
        });
    } catch {
        return NextResponse.json({ adminLogo: '', adminBrand: '' });
    }
}

export async function PUT(req: NextRequest) {
    const auth = await requirePermission('manage-settings');
    if (auth.error) return auth.error;

    try {
        const body = await req.json().catch(() => ({}));
        const adminLogo = typeof body.adminLogo === 'string' ? body.adminLogo.trim() : undefined;
        const adminBrand = typeof body.adminBrand === 'string' ? body.adminBrand.trim() : undefined;

        const data: { adminLogo?: string | null; adminBrand?: string | null } = {};
        if (adminLogo !== undefined) data.adminLogo = adminLogo || null;
        if (adminBrand !== undefined) data.adminBrand = adminBrand || null;

        const saved = await prisma.siteSetting.upsert({
            where: { siteKey: KEY },
            create: { siteKey: KEY, siteName: 'Blog', ...data },
            update: data,
            select: { adminLogo: true, adminBrand: true },
        });
        return NextResponse.json({ adminLogo: saved.adminLogo ?? '', adminBrand: saved.adminBrand ?? '' });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message || 'Save failed' }, { status: 500 });
    }
}
