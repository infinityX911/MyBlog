/**
 * GET /api/media/[...path]
 *
 * Serves locally-uploaded files from /public/uploads reliably. In the
 * standalone (Docker) production build, files written to public/uploads at
 * runtime (into the mounted volume) were 404-ing because the framework's
 * static handler only knew about files present at build time. This route reads
 * the file straight off disk instead, so uploaded images always resolve.
 *
 * A next.config rewrite maps  /uploads/:path*  ->  /api/media/:path*  so the
 * public URLs the uploader returns keep working unchanged.
 *
 * Security:
 *  - path is confined to the uploads directory (no ../ traversal)
 *  - only a whitelist of image extensions is served
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');

const CONTENT_TYPES: Record<string, string> = {
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml', // never written by our uploader, but harmless to read
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const segments = (await params).path ?? [];

    // Reject any traversal / absolute segments outright.
    if (segments.some((s) => s.includes('..') || s.includes('\0') || path.isAbsolute(s))) {
        return NextResponse.json({ error: 'Bad path.' }, { status: 400 });
    }

    const target = path.join(UPLOADS_ROOT, ...segments);
    const resolved = path.resolve(target);
    // Confine strictly to the uploads directory.
    if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
        return NextResponse.json({ error: 'Unsupported media type.' }, { status: 415 });
    }

    try {
        const data = await fs.readFile(resolved);
        return new NextResponse(new Uint8Array(data), {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
}
