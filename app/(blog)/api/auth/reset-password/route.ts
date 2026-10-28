/**
 * app/(blog)/api/auth/reset-password/route.ts
 *
 * POST /api/auth/reset-password
 *   { token, password }                  → reset via email link
 *   { identifier, code, password }       → reset via OTP code (email or phone)
 *
 * Verifies the hashed token/code, enforces expiry + attempt limits, sets the
 * new bcrypt(12) password, marks the request used, and logs the event.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { isSameOrigin } from '@/lib/csrf';
import { recordEvent } from '@/lib/activity';

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
    const ip = getClientIp(req.headers);
    const rl = rateLimit(`reset:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json(
            { error: 'Too many attempts. Please try again later.' },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
        );
    }

    try {
        const body = await req.json();
        const password = String(body.password ?? '');
        if (password.length < 8 || password.length > 200) {
            return NextResponse.json({ error: 'Password must be 8–200 characters.' }, { status: 422 });
        }

        const token = body.token ? String(body.token) : '';
        const code = body.code ? String(body.code).trim() : '';
        const identifier = String(body.identifier ?? '').trim();

        let reset: { id: number; userId: number; expiresAt: Date; usedAt: Date | null; attempts: number } | null = null;

        if (token) {
            // ── Email-link flow ──────────────────────────────
            reset = await prisma.passwordReset.findFirst({
                where: { tokenHash: sha256(token), usedAt: null },
                select: { id: true, userId: true, expiresAt: true, usedAt: true, attempts: true },
            });
        } else if (code && identifier) {
            // ── OTP flow ─────────────────────────────────────
            const isEmail = identifier.includes('@');
            const user = await prisma.user.findFirst({
                where: isEmail ? { email: identifier.toLowerCase() } : { phone: identifier },
                select: { id: true },
            });
            if (user) {
                const candidate = await prisma.passwordReset.findFirst({
                    where: { userId: user.id, usedAt: null },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, userId: true, expiresAt: true, usedAt: true, attempts: true, codeHash: true },
                });
                if (candidate) {
                    if (candidate.attempts >= 5) {
                        return NextResponse.json({ error: 'Too many incorrect codes. Request a new one.' }, { status: 429 });
                    }
                    if (candidate.codeHash === sha256(code)) {
                        reset = candidate;
                    } else {
                        await prisma.passwordReset.update({ where: { id: candidate.id }, data: { attempts: { increment: 1 } } });
                        return NextResponse.json({ error: 'Incorrect code.' }, { status: 422 });
                    }
                }
            }
        } else {
            return NextResponse.json({ error: 'Invalid request.' }, { status: 422 });
        }

        if (!reset) {
            return NextResponse.json({ error: 'This reset link or code is invalid.' }, { status: 400 });
        }
        if (reset.expiresAt < new Date()) {
            return NextResponse.json({ error: 'This reset link or code has expired.' }, { status: 400 });
        }

        const hashed = await bcrypt.hash(password, 12);
        await prisma.$transaction([
            prisma.user.update({ where: { id: reset.userId }, data: { password: hashed } }),
            prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
            // Invalidate any other outstanding requests for this user.
            prisma.passwordReset.deleteMany({ where: { userId: reset.userId, usedAt: null } }),
        ]);

        await recordEvent({
            type: 'auth.password_reset',
            action: 'Password was reset',
            description: 'Account password reset via forgot-password flow.',
            link: '/admin/login',
            actorUserId: reset.userId,
            subjectUserId: reset.userId,
            notify: 'admins',
        });

        return NextResponse.json({ success: true, message: 'Password updated. You can now sign in.' });
    } catch (err) {
        console.error('[POST /api/auth/reset-password]', err);
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
}
