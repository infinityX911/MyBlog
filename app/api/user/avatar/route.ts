/**
 * app/api/user/avatar/route.ts
 *
 * POST /api/user/avatar  → upload profile photo
 *
 * Security (defense in depth — every layer assumes the previous one was bypassed):
 *  - Requires the 'upload-avatar' permission, checked LIVE against the DB (not
 *    the session snapshot), so an admin revoke takes effect instantly.
 *  - userId always from session — the stored filename is
 *    <userId>-<random>.<ext>; the original filename is NEVER used, so neither
 *    path traversal (../../) nor SQL injection via filename is possible. (The
 *    DB write goes through Prisma's parameterised queries regardless.)
 *  - Type validated by declared MIME + real magic bytes BEFORE decoding.
 *  - The image is then fully RE-ENCODED through sharp. This is the key step:
 *    re-encoding keeps only decoded pixel data, so any steganographic payload,
 *    embedded PHP/script, trailing polyglot bytes, or malicious EXIF is
 *    discarded — the file written to disk is a brand-new clean image.
 *  - sharp's `limitInputPixels` guards against decompression ("pixel") bombs.
 *  - SVG is intentionally NOT accepted (it can carry <script> → stored XSS),
 *    and even if one were submitted it fails the magic-byte check.
 *  - Output dir is served statically by Next.js, never by a PHP interpreter,
 *    and the extension is forced to an image type — so no RCE path exists.
 *  - Size capped at 2 MB; random filename also removes upload race/collision.
 *  - Any rejected/odd attempt is logged to the Activity feed → admins see it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { randomBytes } from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { requireAuth, userId } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { isSameOrigin } from '@/lib/csrf';

const MAX_BYTES   = 2 * 1024 * 1024; // 2 MB on the wire
const MAX_DIM     = 1024;            // avatars never need to be larger
const MAX_PIXELS  = 24_000_000;      // ~24 MP hard ceiling → blocks pixel bombs

const ALLOWED: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/gif':  'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
};

/** Verify the real file type from its first bytes (magic numbers). */
function sniffImage(buf: Buffer): string | null {
    if (buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
    const ascii = buf.toString('ascii', 0, 12);
    if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp';
    if (ascii.slice(4, 8) === 'ftyp' && ascii.slice(8, 12).startsWith('avif')) return 'avif';
    return null;
}

/**
 * Re-encode the raw upload into a clean image of the same family.
 * Animated GIF/WebP are preserved as animated; everything else is flattened
 * to a single frame. Metadata is dropped (sharp strips it unless asked to
 * keep it) so EXIF / hidden payloads never reach disk.
 * Returns the clean buffer + the canonical extension, or throws on a bad image.
 */
async function reencode(input: Buffer, realExt: string): Promise<{ data: Buffer; ext: string }> {
    const animated = realExt === 'gif' || realExt === 'webp';
    const pipeline = sharp(input, {
        limitInputPixels: MAX_PIXELS,   // throws if the declared canvas is too big
        animated,
        failOn: 'error',
    })
        // Honour EXIF orientation, then the metadata is discarded on output.
        .rotate()
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true });

    switch (realExt) {
        case 'jpg':  return { data: await pipeline.jpeg({ quality: 82 }).toBuffer(), ext: 'jpg' };
        case 'png':  return { data: await pipeline.png().toBuffer(),                 ext: 'png' };
        case 'gif':  return { data: await pipeline.gif().toBuffer(),                 ext: 'gif' };
        case 'avif': return { data: await pipeline.avif({ quality: 55 }).toBuffer(), ext: 'avif' };
        case 'webp':
        default:     return { data: await pipeline.webp({ quality: 82 }).toBuffer(), ext: 'webp' };
    }
}

export async function POST(req: NextRequest) {
    // ── CSRF / same-origin guard ───────────────────────────────────────────────
    // Reject forged uploads submitted from another site. The browser stamps the
    // attacker's Origin/Referer, which won't match our host.
    if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }

    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const actorName = (auth.session.user as any)?.name ?? 'A user';

    // ── Rate limit ─────────────────────────────────────────────────────────────
    // Cap uploads per user (and per IP) so nobody can hammer the endpoint with
    // automated requests — re-encoding is CPU-heavy, so this also protects the
    // server from resource exhaustion. 10 uploads / 5 minutes is plenty.
    const ip = getClientIp(req.headers);
    const rl = rateLimit(`avatar:${me}:${ip}`, 10, 5 * 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json(
            { error: `Too many uploads. Try again in ${rl.retryAfter}s.` },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
        );
    }

    // ── LIVE permission check against the DATABASE, not the session ────────────
    // The JWT session is a snapshot from login, so a revoked permission would
    // still appear there. Checking the DB makes a revoke take effect instantly.
    const dbUser = await prisma.user.findUnique({
        where: { id: me },
        select: { permissions: { select: { permission: { select: { slug: true } } } } },
    });
    const hasUpload = !!dbUser?.permissions.some(up => up.permission.slug === 'upload-avatar');
    if (!hasUpload) {
        await recordEvent({
            type: 'avatar.denied',
            action: `${actorName} tried to upload a profile photo without permission`,
            link: '/admin/management/users',
            actorUserId: me,
            subjectUserId: me,
            notify: 'admins',
        });
        return NextResponse.json(
            { error: 'You do not have permission to upload a profile photo.' },
            { status: 403 }
        );
    }

    try {
        const form = await req.formData();
        const file = form.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided.' }, { status: 422 });
        }

        const declaredExt = ALLOWED[file.type];
        const buffer = Buffer.from(await file.arrayBuffer());
        const realExt = sniffImage(buffer);

        // Reject anything that isn't a genuine image (by declared type AND bytes).
        if (!declaredExt || !realExt) {
            await recordEvent({
                type: 'avatar.reject',
                action: `${actorName} tried to upload a non-image file as their photo`,
                description: `Rejected "${file.name}" (${file.type || 'unknown type'}).`,
                link: '/admin/management/users',
                actorUserId: me,
                subjectUserId: me,
                notify: 'admins',
            });
            return NextResponse.json(
                { error: 'Only real JPEG, PNG, GIF, WebP, or AVIF images are accepted.' },
                { status: 422 }
            );
        }

        if (buffer.byteLength > MAX_BYTES) {
            return NextResponse.json({ error: 'Image must be under 2 MB.' }, { status: 413 });
        }

        // ── Re-encode through sharp ────────────────────────────────────────────
        // This is what neutralises steganography / embedded code / polyglots:
        // only the decoded pixels survive. A corrupt or bomb image throws here
        // and is rejected (and logged) rather than ever touching disk.
        let clean: { data: Buffer; ext: string };
        try {
            clean = await reencode(buffer, realExt);
        } catch {
            await recordEvent({
                type: 'avatar.reject',
                action: `${actorName} uploaded a file that failed image re-encoding`,
                description: `Rejected "${file.name}" — not a decodable ${realExt.toUpperCase()} image (possible polyglot or corrupt file).`,
                link: '/admin/management/users',
                actorUserId: me,
                subjectUserId: me,
                notify: 'admins',
            });
            return NextResponse.json(
                { error: 'That file could not be processed as a valid image.' },
                { status: 422 }
            );
        }

        // Random, non-guessable filename. Never derived from user input, so
        // path traversal / SQL injection via the name is impossible, and two
        // concurrent uploads can't collide (no race condition).
        const filename  = `${me}-${randomBytes(12).toString('hex')}.${clean.ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'avatars');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, filename), clean.data);

        await recordEvent({
            type: 'avatar.update',
            action: `${actorName} updated their profile photo`,
            link: '/admin/account',
            actorUserId: me,
            subjectUserId: me,
            notify: 'admins',
        });

        return NextResponse.json({ url: `/avatars/${filename}` }, { status: 201 });
    } catch (err) {
        console.error('[POST /api/user/avatar]', err);
        return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
    }
}
