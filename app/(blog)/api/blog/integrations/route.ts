/**
 * app/(blog)/api/blog/integrations/route.ts
 * GET  /api/blog/integrations  -> current config, SECRETS MASKED   [admin]
 * PUT  /api/blog/integrations  -> save config                      [admin]
 *
 * Moves Google Analytics / Search Console + image-upload (Cloudinary) config
 * out of .env and into the DB, editable from Admin → Blog → Integrations.
 *
 * Secret handling: the GET never returns the GA private key or Cloudinary
 * secret — only a boolean saying whether one is set. The PUT only overwrites a
 * secret when a new non-empty value is sent, so leaving the field blank keeps
 * the stored secret intact.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

const SITE_KEY = 'blog';
const str = (v: unknown, max = 400) => String(v ?? '').trim().slice(0, max);

export async function GET() {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;

    const row: any = await prisma.siteSetting.findUnique({ where: { siteKey: SITE_KEY } });
    return NextResponse.json({
        analytics: {
            measurementId: row?.gaMeasurementId ?? '',
            ga4PropertyId: row?.ga4PropertyId ?? '',
            clientEmail: row?.gaClientEmail ?? '',
            gscVerification: row?.gscVerification ?? '',
            hasPrivateKey: !!(row?.gaPrivateKey && String(row.gaPrivateKey).trim()),
        },
        upload: {
            provider: (row?.uploadProvider ?? 'local'),
            cloudName: row?.cloudinaryCloud ?? '',
            apiKey: row?.cloudinaryKey ?? '',
            hasApiSecret: !!(row?.cloudinarySecret && String(row.cloudinarySecret).trim()),
        },
        email: {
            host: row?.smtpHost ?? '',
            port: row?.smtpPort ?? '',
            user: row?.smtpUser ?? '',
            from: row?.smtpFrom ?? '',
            hasPass: !!(row?.smtpPass && String(row.smtpPass).trim()),
        },
    });
}

export async function PUT(req: NextRequest) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    try {
        const body = await req.json();
        const a = body.analytics ?? {};
        const u = body.upload ?? {};
        const e = body.email ?? {};

        // Non-secret fields: always written (empty clears them).
        const data: Record<string, any> = {
            gaMeasurementId: str(a.measurementId, 40),
            ga4PropertyId: str(a.ga4PropertyId, 40),
            gaClientEmail: str(a.clientEmail, 200),
            gscVerification: str(a.gscVerification, 200),
            uploadProvider: str(u.provider, 20).toLowerCase() === 'cloudinary' ? 'cloudinary' : 'local',
            cloudinaryCloud: str(u.cloudName, 100),
            cloudinaryKey: str(u.apiKey, 100),
            smtpHost: str(e.host, 120),
            smtpPort: str(e.port, 6),
            smtpUser: str(e.user, 200),
            smtpFrom: str(e.from, 200),
        };

        // Secrets: only overwrite when a new value is provided; blank = keep.
        if (typeof a.privateKey === 'string' && a.privateKey.trim()) {
            data.gaPrivateKey = a.privateKey.trim().slice(0, 8000);
        }
        if (typeof u.apiSecret === 'string' && u.apiSecret.trim()) {
            data.cloudinarySecret = u.apiSecret.trim().slice(0, 200);
        }
        if (typeof e.pass === 'string' && e.pass.trim()) {
            data.smtpPass = e.pass.trim().slice(0, 200);
        }
        // Explicit clear support: caller sends the sentinel "__CLEAR__".
        if (a.privateKey === '__CLEAR__') data.gaPrivateKey = null;
        if (u.apiSecret === '__CLEAR__') data.cloudinarySecret = null;
        if (e.pass === '__CLEAR__') data.smtpPass = null;

        await prisma.siteSetting.upsert({
            where: { siteKey: SITE_KEY },
            create: { siteKey: SITE_KEY, siteName: 'Blog', ...data },
            update: data,
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[PUT /api/blog/integrations]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
