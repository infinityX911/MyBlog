/**
 * app/(blog)/api/subscribe/route.ts
 * GET    -> current user's subscription status
 * POST   -> subscribe (login required); optionally stores a browser push subscription
 * DELETE -> unsubscribe
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, userId } from '@/lib/rbac';

export async function GET() {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ subscribed: false, authenticated: false });
    const uid = userId(auth.session);
    const sub = await prisma.subscriber.findUnique({ where: { userId: uid } });
    return NextResponse.json({
        authenticated: true,
        subscribed: !!sub,
        wantsEmail: sub?.wantsEmail ?? true,
        wantsPush: !!(sub?.pushEndpoint),
    });
}

export async function POST(req: NextRequest) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const uid = userId(auth.session);
    const email = (auth.session.user as any)?.email as string | undefined;
    if (!email) return NextResponse.json({ error: 'No email on account.' }, { status: 422 });

    const body = await req.json().catch(() => ({}));
    const sub = body.subscription; // { endpoint, keys: { p256dh, auth } }
    const data: any = {
        email,
        wantsEmail: body.wantsEmail !== false,
        wantsPush: body.wantsPush !== false,
    };
    if (sub?.endpoint && sub?.keys) {
        data.pushEndpoint = sub.endpoint;
        data.pushKeys = JSON.stringify(sub.keys);
    }

    try {
        const row = await prisma.subscriber.upsert({
            where: { userId: uid },
            create: { userId: uid, ...data },
            update: data,
        });
        return NextResponse.json({ ok: true, subscribed: true, id: row.id });
    } catch (e) {
        console.error('[POST /api/subscribe]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function DELETE() {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const uid = userId(auth.session);
    try {
        await prisma.subscriber.deleteMany({ where: { userId: uid } });
        return NextResponse.json({ ok: true, subscribed: false });
    } catch (e) {
        console.error('[DELETE /api/subscribe]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
