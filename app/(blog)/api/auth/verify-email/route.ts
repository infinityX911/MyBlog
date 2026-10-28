/**
 * app/(blog)/api/auth/verify-email/route.ts
 *
 * POST /api/auth/verify-email   { token }
 *
 * Confirms a signup by matching the hashed token (valid 24h). On success the
 * account is marked verified and can log in.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { isSameOrigin } from '@/lib/csrf';

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
    const ip = getClientIp(req.headers);
    const rl = rateLimit(`verify:${ip}`, 20, 15 * 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    try {
        const body = await req.json();
        const token = String(body.token ?? '');
        if (!token) return NextResponse.json({ error: 'Missing verification token.' }, { status: 422 });

        const user = await prisma.user.findFirst({
            where: { verifyToken: sha256(token) },
            select: { id: true, emailVerified: true, verifyExpires: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'This verification link is invalid.' }, { status: 400 });
        }
        if (user.emailVerified) {
            return NextResponse.json({ success: true, message: 'Your email is already verified. You can log in.' });
        }
        if (user.verifyExpires && user.verifyExpires < new Date()) {
            return NextResponse.json({ error: 'This verification link has expired. Please sign up again or request a new one.' }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true, verifyToken: null, verifyExpires: null },
        });

        return NextResponse.json({ success: true, message: 'Email verified! You can now log in.' });
    } catch (err) {
        console.error('[POST /api/auth/verify-email]', err);
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
}
