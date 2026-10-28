import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export async function PUT(req: NextRequest) {
    // Was: any logged-in user could mark contact messages read. Now scoped
    // to the same permission that gates viewing the contact-us list.
    const auth = await requirePermission('view-contactus');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const ids: number[] = body.ids;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
        }

        // Model is ContactUs (@@map("contact_u_s")) → prisma.contactUs
        await prisma.contactUs.updateMany({
            where: { id: { in: ids } },
            data: { read: true },
        });

        return NextResponse.json({ success: true, updated: ids.length });
    } catch (err) {
        console.error('PUT /api/notifications/mark-as-read error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
