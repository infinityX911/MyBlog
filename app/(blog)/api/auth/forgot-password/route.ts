/**
 * app/(blog)/api/auth/forgot-password/route.ts
 *
 * POST /api/auth/forgot-password  { identifier }   (email or phone)
 *
 * Generates a reset token (for the email link) + a 6-digit OTP (for the
 * "mobile code" flow), stores their hashes with a 15-minute expiry, and
 * delivers them. ALWAYS returns a generic success so attackers can't probe
 * which emails/phones exist. Rate-limited per IP.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { isSameOrigin } from '@/lib/csrf';
import { getSiteUrl } from '@/lib/siteSettings';
import { deliverEmail, deliverSms } from '@/lib/delivery';

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const GENERIC = { success: true, message: 'If an account matches, a reset link and code have been sent.' };

export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
    const ip = getClientIp(req.headers);
    const rl = rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
        );
    }

    try {
        const body = await req.json();
        const identifier = String(body.identifier ?? '').trim();
        if (!identifier) {
            return NextResponse.json({ error: 'Please enter your email or phone.' }, { status: 422 });
        }

        const isEmail = identifier.includes('@');
        const user = await prisma.user.findFirst({
            where: isEmail
                ? { email: identifier.toLowerCase() }
                : { phone: identifier },
            select: { id: true, email: true, phone: true, name: true },
        });

        // Don't leak existence — always return generic success.
        if (!user) return NextResponse.json(GENERIC);

        // Invalidate any previous unused requests for this user.
        await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });

        const token = crypto.randomBytes(32).toString('hex');
        const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
        const channel = isEmail ? 'email' : 'sms';

        await prisma.passwordReset.create({
            data: {
                userId: user.id,
                tokenHash: sha256(token),
                codeHash: sha256(code),
                channel,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
        });

        // Use the origin the request actually came in on, so the link works in
        // dev (localhost) and prod alike.
        const baseUrl = await getSiteUrl(); // public site URL (Settings → websiteUrl), not the internal 0.0.0.0:3000 origin behind nginx
        const link = `${baseUrl}/admin/reset-password?token=${token}`;
        const message =
            `Hi ${user.name},\n\n` +
            `Reset your password using this link (valid 15 minutes):\n${link}\n\n` +
            `Or enter this code: ${code}\n\n` +
            `If you didn't request this, ignore this message.`;

        // Fire-and-forget: never block the HTTP response on SMTP. A blocked or
        // slow mail server would otherwise leave the UI stuck on "Sending...".
        // The generic success below is returned regardless of delivery outcome.
        if (isEmail && user.email) void deliverEmail(user.email, 'Reset your password', message).catch((e) => console.error('[forgot] email send failed:', e));
        else if (user.phone) void deliverSms(user.phone, `Your password reset code is ${code} (valid 15 min).`).catch((e) => console.error('[forgot] sms send failed:', e));

        return NextResponse.json(GENERIC);
    } catch (err) {
        console.error('[POST /api/auth/forgot-password]', err);
        // Still generic — avoid leaking anything.
        return NextResponse.json(GENERIC);
    }
}
