/**
 * app/api/admin/comments/route.ts
 *
 * GET /api/admin/comments?status=pending  → list comments for moderation
 *   status is optional: 'pending' | 'approved' | 'rejected'. Omit for all.
 *
 * Requires the 'view-comments' permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export async function GET(req: NextRequest) {
    const auth = await requirePermission('view-comments');
    if (auth.error) return auth.error;

    const status = req.nextUrl.searchParams.get('status');
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status filter.' }, { status: 422 });
    }

    try {
        const comments = await prisma.comment.findMany({
            where: status ? { status } : undefined,
            include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true, isTrusted: true } },
                post: { select: { id: true, title: true, slug: true } },
                parent: { select: { id: true, content: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });

        return NextResponse.json({ comments });
    } catch (error) {
        console.error('[GET /api/admin/comments]', error);
        return NextResponse.json({ error: 'Could not load comments.' }, { status: 500 });
    }
}
