/**
 * app/(blog)/api/redirects/route.ts
 *
 * GET    /api/redirects        → list all redirects (requires 'view-posts')
 * POST   /api/redirects        → add a redirect       (requires 'update-posts')
 * DELETE /api/redirects?id=123 → delete a redirect    (requires 'update-posts')
 *
 * Auto-created redirects (on slug change) live in the same table; this just
 * lets an admin view/add/remove them manually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

function normalizePath(v: string): string {
    let p = v.trim();
    if (!p) return '';
    // Allow full URLs for the target, but force a leading slash for site paths.
    if (!/^https?:\/\//i.test(p) && !p.startsWith('/')) p = '/' + p;
    return p.replace(/\s+/g, '');
}

export async function GET() {
    const auth = await requirePermission('view-posts');
    if (auth.error) return auth.error;
    try {
        const redirects = await prisma.redirect.findMany({ orderBy: { createdAt: 'desc' } });
        return NextResponse.json({ redirects });
    } catch (err) {
        console.error('[GET /api/redirects]', err);
        return NextResponse.json({ error: 'Could not load redirects.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requirePermission('update-posts');
    if (auth.error) return auth.error;
    try {
        const body = await req.json();
        const fromPath = normalizePath(String(body.fromPath ?? ''));
        const toPath = normalizePath(String(body.toPath ?? ''));
        const statusCode = [301, 302, 307, 308].includes(Number(body.statusCode)) ? Number(body.statusCode) : 308;

        if (!fromPath || !toPath) {
            return NextResponse.json({ error: 'Both "from" and "to" paths are required.' }, { status: 422 });
        }
        if (fromPath === toPath) {
            return NextResponse.json({ error: 'From and to cannot be the same.' }, { status: 422 });
        }

        const redirect = await prisma.redirect.upsert({
            where: { fromPath },
            create: { fromPath, toPath, statusCode },
            update: { toPath, statusCode },
        });
        return NextResponse.json({ success: true, redirect }, { status: 201 });
    } catch (err) {
        console.error('[POST /api/redirects]', err);
        return NextResponse.json({ error: 'Could not save redirect.' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const auth = await requirePermission('update-posts');
    if (auth.error) return auth.error;
    try {
        const id = Number(req.nextUrl.searchParams.get('id'));
        if (!id || Number.isNaN(id)) {
            return NextResponse.json({ error: 'A valid id is required.' }, { status: 422 });
        }
        await prisma.redirect.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err?.code === 'P2025') return NextResponse.json({ error: 'Redirect not found.' }, { status: 404 });
        console.error('[DELETE /api/redirects]', err);
        return NextResponse.json({ error: 'Could not delete redirect.' }, { status: 500 });
    }
}
