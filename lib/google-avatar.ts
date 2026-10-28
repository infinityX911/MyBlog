/**
 * lib/google-avatar.ts
 *
 * Fetches the profile picture Google returns at sign-in and stores it as a
 * local file, exactly like an uploaded avatar.
 *
 * WHY NOT JUST STORE GOOGLE'S URL: it would be a third-party URL rendered on
 * every page the person appears on — it can rot, it leaks a request to Google
 * from every visitor who loads a comment thread, and it puts a value we do not
 * control into an <img src>. This app already decides avatars server-side
 * (see app/api/user/avatar/route.ts); a Google picture goes through the same
 * treatment rather than getting an exception.
 *
 * Every failure is non-fatal. Sign-in must not break because a picture could
 * not be downloaded — the caller falls back to the default avatar.
 */

import { randomBytes } from 'crypto';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';

/** Only Google's own image host. Anything else is not a Google avatar. */
const ALLOWED_HOSTS = new Set(['lh3.googleusercontent.com', 'lh4.googleusercontent.com',
    'lh5.googleusercontent.com', 'lh6.googleusercontent.com', 'googleusercontent.com']);

const MAX_BYTES = 5 * 1024 * 1024;   // a profile picture is never this big
const FETCH_TIMEOUT_MS = 5000;       // sign-in must not hang on a slow image
const SIZE = 256;                    // avatars are displayed small

/**
 * Downloads, re-encodes and saves a Google profile picture.
 * Returns the local URL, or null if anything at all goes wrong.
 */
export async function saveGoogleAvatar(pictureUrl: unknown): Promise<string | null> {
    try {
        if (typeof pictureUrl !== 'string' || !pictureUrl) return null;

        const url = new URL(pictureUrl);
        // https only, and only Google's image host. Without this the "picture"
        // claim would be an arbitrary URL this server fetches on demand —
        // a server-side request forgery hole handed over by the identity layer.
        if (url.protocol !== 'https:') return null;
        const host = url.hostname.toLowerCase();
        if (!ALLOWED_HOSTS.has(host) && !host.endsWith('.googleusercontent.com')) return null;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let res: Response;
        try {
            // `manual`, NOT `follow`. Checking the hostname and then following
            // redirects blindly defeats the check entirely: the first hop is on
            // googleusercontent.com, and hop two could be anywhere — including
            // 169.254.169.254 or another address only this server can reach.
            // That is server-side request forgery, and the identity provider
            // would be the one handing over the URL.
            //
            // Google's avatar URLs serve the image directly, so refusing to
            // follow costs nothing.
            res = await fetch(url.toString(), { signal: controller.signal, redirect: 'manual' });
        } finally {
            clearTimeout(timer);
        }
        if (!res.ok) return null;

        // Belt and braces: a redirect status still means we did not get an image.
        if (res.status >= 300 && res.status < 400) return null;

        // It must actually claim to be an image. sharp would reject a non-image
        // anyway, but failing early keeps a large HTML error page out of memory.
        const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
        if (!contentType.startsWith('image/')) return null;

        // Trust the declared length only as a first filter — the real cap is the
        // byte count below, since Content-Length can lie.
        const declared = Number(res.headers.get('content-length') ?? 0);
        if (declared && declared > MAX_BYTES) return null;

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0 || buf.length > MAX_BYTES) return null;

        // Re-encode through sharp: proves it is a real raster image rather than
        // a renamed file, strips any metadata, and normalises size and format.
        const sharp = (await import('sharp')).default;
        const webp = await sharp(buf, { failOn: 'error', limitInputPixels: 24_000_000 })
            .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
            .webp({ quality: 82 })
            .toBuffer();

        const filename = `g-${Date.now()}-${randomBytes(8).toString('hex')}.webp`;
        const dir = path.join(process.cwd(), 'public', 'avatars');
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, filename), webp);

        return `/avatars/${filename}`;
    } catch {
        // Deliberately silent: a missing picture is cosmetic, and a sign-in that
        // fails because of one would not be.
        return null;
    }
}
