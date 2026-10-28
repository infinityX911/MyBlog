// app/api/upload-image/route.ts
//
// Secure image upload endpoint used by the blog editor.
// Supports two storage backends, chosen in Admin → Blog → Integrations
// (with an .env fallback):
//   provider=local      -> saves to /public/uploads (default)
//   provider=cloudinary -> saves to Cloudinary (needs the Cloudinary credentials)
//
// Security:
//  - requires an authenticated admin session (next-auth)
//  - whitelists MIME types (no SVG — SVG can carry executable script)
//  - hard caps file size (default 8MB, override with UPLOAD_MAX_MB)
//  - re-encodes every upload through sharp (strips EXIF/GPS metadata,
//    strips any payload hidden in the original bytes, guarantees the
//    output is actually a valid raster image and not a renamed file)
//  - converts to WebP for smaller, next-gen-format delivery (better Core
//    Web Vitals / SEO image score) while keeping a JPEG fallback flag
//  - generates a random, unguessable filename (no path traversal, no
//    overwriting another user's file, no leaking the original filename)

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { requireAnyPermission, userId } from '@/lib/rbac';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { isSameOrigin } from '@/lib/csrf';
import { getIntegrations } from '@/lib/integrations';
import { recordEvent } from '@/lib/activity';

export const runtime = 'nodejs';

// ~24 MP hard ceiling on the decoded canvas → blocks decompression ("pixel")
// bombs where a tiny file expands to gigabytes of RAM when decoded.
const MAX_PIXELS = 24_000_000;

// sharp is loaded lazily inside the handler (not at module top-level).
// On Windows, a broken/missing native sharp binary throws at import time,
// which crashes this whole route module and makes the client's fetch()
// fail with an opaque "Failed to fetch" instead of a real HTTP error.
// Loading it lazily lets us catch that failure and return real JSON.
async function loadSharp() {
    try {
        const mod = await import('sharp');
        return mod.default;
    } catch (err: any) {
        throw new Error(
            'Image processing library (sharp) failed to load on the server. ' +
            'This usually means its native binary is broken for your platform — ' +
            'see fix-sharp-windows.txt for the fix. Original error: ' + (err?.message ?? String(err))
        );
    }
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? 8);
const MAX_BYTES = MAX_MB * 1024 * 1024;

function randomFilename(ext: string) {
    return `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
}

async function uploadLocal(buffer: Buffer): Promise<{ url: string; width: number; height: number }> {
    // Re-encode via sharp: strips metadata, validates it's a real image,
    // and converts to WebP (next-gen format) for SEO / performance.
    const sharp = await loadSharp();
    const image = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS });
    const meta = await image.metadata();

    const webpBuffer = await image
        .resize({ width: 2000, withoutEnlargement: true }) // sane upper bound
        .webp({ quality: 82 })
        .toBuffer();

    const filename = randomFilename('webp');
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'blog');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), webpBuffer);

    return {
        url: `/uploads/blog/${filename}`,
        width: meta.width ?? 0,
        height: meta.height ?? 0,
    };
}

async function uploadCloudinary(
    buffer: Buffer,
    creds: { cloudName: string; apiKey: string; apiSecret: string },
): Promise<{ url: string; width: number; height: number }> {
    const { cloudName, apiKey, apiSecret } = creds;

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary is not configured — set the cloud name / API key / API secret under Admin → Blog → Integrations.');
    }

    // Strip metadata + convert to WebP locally before sending upstream —
    // keeps the same security guarantee (re-encoded, validated image)
    // even when the final storage is a third party.
    const sharp = await loadSharp();
    const webpBuffer = await sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
        .resize({ width: 2000, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

    const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'blog', resource_type: 'image', format: 'webp', overwrite: false },
            (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(webpBuffer);
    });

    return {
        url: uploadResult.secure_url as string,
        width: uploadResult.width ?? 0,
        height: uploadResult.height ?? 0,
    };
}

export async function POST(req: NextRequest) {
    // ── CSRF / same-origin guard ───────────────────────────────────────────────
    if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }

    // ── Permission gate ────────────────────────────────────────────────────────
    // Content authors (create-posts) OR settings managers (manage-settings —
    // favicon / OG image / admin logo uploads) may use this endpoint.
    const auth = await requireAnyPermission(['create-posts', 'manage-settings']);
    if (auth.error) return auth.error;
    const me = userId(auth.session);
    const actorName = (auth.session.user as any)?.name ?? 'A user';

    // ── Rate limit ─────────────────────────────────────────────────────────────
    // Re-encoding is CPU-heavy; cap per user+IP to stop spam / resource abuse.
    const ip = getClientIp(req.headers);
    const rl = rateLimit(`upload-image:${me}:${ip}`, 30, 5 * 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json(
            { error: `Too many uploads. Try again in ${rl.retryAfter}s.` },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
        );
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
        // Security event: a non-image (possible shell/script/SVG) was submitted.
        await recordEvent({
            type: 'upload.reject',
            action: `${actorName} tried to upload a non-image file`,
            description: `Rejected "${file.name}" (${file.type || 'unknown type'}) at the image uploader.`,
            link: '/admin/management/users',
            actorUserId: me, subjectUserId: me, notify: 'admins',
        }).catch(() => {});
        return NextResponse.json(
            { error: `Unsupported file type "${file.type}". Allowed: JPEG, PNG, WebP, AVIF.` },
            { status: 415 }
        );
    }

    if (file.size > MAX_BYTES) {
        return NextResponse.json(
            { error: `File too large. Max size is ${MAX_MB}MB.` },
            { status: 413 }
        );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Provider + Cloudinary credentials now come from Admin → Blog → Integrations
    // (with an .env fallback baked into getIntegrations).
    const upload = (await getIntegrations()).upload;

    // If someone selected "Cloudinary" in Integrations but left any credential
    // blank, DON'T hard-fail every upload across the whole site — fall back to
    // local storage (still secure: re-encoded via sharp) and log a warning so
    // the misconfiguration is visible. This was a likely cause of "uploads stop
    // working everywhere" after touching the Integrations tab.
    const cloudinaryReady = upload.provider === 'cloudinary'
        && !!upload.cloudName && !!upload.apiKey && !!upload.apiSecret;
    if (upload.provider === 'cloudinary' && !cloudinaryReady) {
        console.warn('[upload-image] Cloudinary selected but credentials are incomplete — falling back to local storage.');
    }

    try {
        const result = cloudinaryReady
            ? await uploadCloudinary(buffer, { cloudName: upload.cloudName, apiKey: upload.apiKey, apiSecret: upload.apiSecret })
            : await uploadLocal(buffer);

        return NextResponse.json({
            url: result.url,
            width: result.width,
            height: result.height,
            format: 'webp',
            provider: upload.provider,
        });
    } catch (err: any) {
        console.error('Upload failed:', err);
        const message = err?.message ?? 'Upload failed. Please try again.';
        // sharp throws on corrupt / non-image data — keep a friendlier
        // message for that specific case, but otherwise surface the
        // real error (e.g. "sharp failed to load...") so it's debuggable
        // instead of a generic, silent failure.
        const isInvalidImage = typeof message === 'string' && message.includes('Input buffer');
        if (isInvalidImage) {
            // Passed the MIME check but failed to decode — a disguised/polyglot
            // file (e.g. a script renamed .png). Log it as a security event.
            await recordEvent({
                type: 'upload.reject',
                action: `${actorName} uploaded a file that failed image decoding`,
                description: 'A file with an image type but non-image bytes was rejected at the uploader (possible disguised/polyglot file).',
                link: '/admin/management/users',
                actorUserId: me, subjectUserId: me, notify: 'admins',
            }).catch(() => {});
        }
        return NextResponse.json(
            { error: isInvalidImage ? 'File is not a valid image.' : message },
            { status: 500 }
        );
    }
}
