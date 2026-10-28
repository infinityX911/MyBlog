/**
 * app/api/admin/media/usage/route.ts
 *
 * POST /api/admin/media/usage  →  where is each of these files referenced?
 *
 * Lets the library answer "is it safe to delete this?" BEFORE the user clicks
 * delete, instead of finding out afterwards that a live post lost its image.
 * Read-only, so it only needs the browse permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { findUsage } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = await requirePermission('view-media');
    if (auth.error) return auth.error;

    let body: any;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

    const paths: string[] = Array.isArray(body?.paths) ? body.paths.slice(0, 100) : [];
    if (!paths.length) return NextResponse.json({ usage: {} });

    const urls = paths.map((p) => (p.startsWith('/uploads/') ? p : `/uploads/${String(p).replace(/^\/+/, '')}`));
    return NextResponse.json({ usage: await findUsage(urls) });
}
