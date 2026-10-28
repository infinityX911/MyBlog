/**
 * DELETE /api/announcements/[id]   [manage-announcements]
 * Remove an announcement (its likes + comments cascade via the schema).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('manage-announcements');
    if (auth.error) return auth.error;
    const id = Number((await params).id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

    await prisma.announcement.delete({ where: { id } }).catch(() => {});
    return NextResponse.json({ ok: true });
}
