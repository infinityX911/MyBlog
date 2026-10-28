/**
 * app/api/admin/media/route.ts — the Media Library.
 *
 *   GET    /api/admin/media            list every uploaded file   [view-media]
 *   POST   /api/admin/media            upload a file              [upload-media]
 *   DELETE /api/admin/media            delete files               [delete-media]
 *
 * Security model — same shape as the blog uploader, tightened for a tool that
 * can also DELETE:
 *   • every verb needs its own permission (browsing ≠ adding ≠ destroying)
 *   • same-origin check on the writing verbs, so another site can't drive it
 *   • rate limits per user, because re-encoding and fs walks are not free
 *   • every path from the client goes through safeResolve(), which refuses
 *     anything that escapes public/uploads (…/, absolute paths, symlinks)
 *   • uploads are re-encoded through sharp: metadata stripped, real image
 *     verified, output always WebP — a renamed script can't survive that
 *   • deletes are refused for files still referenced by a post/page/download
 *     unless the caller explicitly confirms
 *   • uploads and deletes are written to the activity log
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import path from 'path';
import { writeFile, mkdir, unlink, stat } from 'fs/promises';
import { requirePermission, userId } from '@/lib/rbac';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { isSameOrigin } from '@/lib/csrf';
import { recordEvent } from '@/lib/activity';
import { listMedia, safeResolve, findUsage, uploadsRoot } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? 8);
const MAX_BYTES = MAX_MB * 1024 * 1024;
const MAX_PIXELS = 24_000_000;                  // blocks decompression bombs

/** Folders a client may upload into. An arbitrary string would be a path risk. */
const FOLDERS = ['blog', 'downloads', 'site', 'misc'];

async function loadSharp() {
    const mod = await import('sharp');
    return mod.default;
}

// ── GET: list ────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const auth = await requirePermission('view-media');
    if (auth.error) return auth.error;

    try {
        const files = await listMedia();
        const q = (req.nextUrl.searchParams.get('q') || '').toLowerCase().trim();
        const folder = req.nextUrl.searchParams.get('folder') || '';

        let out = files;
        if (folder) out = out.filter((f) => f.folder === folder);
        if (q) out = out.filter((f) => f.name.toLowerCase().includes(q) || f.folder.toLowerCase().includes(q));

        return NextResponse.json({
            files: out,
            total: files.length,
            folders: Array.from(new Set(files.map((f) => f.folder))).filter(Boolean).sort(),
            totalBytes: files.reduce((a, f) => a + f.size, 0),
        });
    } catch (err) {
        console.error('[GET /api/admin/media]', err);
        return NextResponse.json({ error: 'Could not read the uploads folder.' }, { status: 500 });
    }
}

// ── POST: upload ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
    const auth = await requirePermission('upload-media');
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const who = (auth.session.user as any)?.name ?? 'A user';

    const rl = rateLimit(`media-upload:${me}:${getClientIp(req.headers)}`, 40, 5 * 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json(
            { error: `Too many uploads. Try again in ${rl.retryAfter}s.` },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
        );
    }

    let form: FormData;
    try { form = await req.formData(); }
    catch { return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 }); }

    const folderRaw = String(form.get('folder') || 'blog');
    const folder = FOLDERS.includes(folderRaw) ? folderRaw : 'blog';

    const files = form.getAll('file').filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    if (files.length > 20) return NextResponse.json({ error: 'Up to 20 files at a time.' }, { status: 400 });

    const dir = path.join(uploadsRoot(), folder);
    await mkdir(dir, { recursive: true });

    const saved: { url: string; name: string; width: number; height: number; size: number }[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const file of files) {
        if (!ALLOWED_MIME.has(file.type)) {
            failed.push({ name: file.name, error: `Unsupported type "${file.type || 'unknown'}".` });
            await recordEvent({
                type: 'upload.reject',
                action: `${who} tried to upload a non-image file to the media library`,
                description: `Rejected "${file.name}" (${file.type || 'unknown type'}).`,
                actorUserId: me, subjectUserId: me, notify: 'admins',
            }).catch(() => {});
            continue;
        }
        if (file.size > MAX_BYTES) {
            failed.push({ name: file.name, error: `Too large (max ${MAX_MB}MB).` });
            continue;
        }
        try {
            const sharp = await loadSharp();
            const buf = Buffer.from(await file.arrayBuffer());
            const img = sharp(buf, { failOn: 'error', limitInputPixels: MAX_PIXELS });
            const meta = await img.metadata();
            const webp = await img.resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();

            const name = `${Date.now()}-${randomBytes(8).toString('hex')}.webp`;
            await writeFile(path.join(dir, name), webp);
            saved.push({
                url: `/uploads/${folder}/${name}`,
                name,
                width: meta.width ?? 0,
                height: meta.height ?? 0,
                size: webp.length,
            });
        } catch (err: any) {
            failed.push({ name: file.name, error: err?.message?.includes('Input buffer') ? 'Not a valid image.' : 'Processing failed.' });
        }
    }

    if (saved.length) {
        await recordEvent({
            type: 'media.upload',
            action: `${who} uploaded ${saved.length} file${saved.length === 1 ? '' : 's'} to the media library`,
            description: saved.map((s) => s.name).join(', ').slice(0, 400),
            link: '/admin/management/media',
            actorUserId: me, subjectUserId: me,
        }).catch(() => {});
    }

    return NextResponse.json({ saved, failed }, { status: saved.length ? 201 : 400 });
}

// ── DELETE: remove ───────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
    const auth = await requirePermission('delete-media');
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const who = (auth.session.user as any)?.name ?? 'A user';

    const rl = rateLimit(`media-delete:${me}`, 60, 5 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: 'Too many deletions. Slow down.' }, { status: 429 });

    let body: any;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

    const paths: string[] = Array.isArray(body?.paths) ? body.paths.slice(0, 50) : [];
    const force = body?.force === true;
    if (!paths.length) return NextResponse.json({ error: 'No files given.' }, { status: 400 });

    // Refuse anything still referenced, unless the caller confirmed.
    const urls = paths.map((p) => (p.startsWith('/uploads/') ? p : `/uploads/${String(p).replace(/^\/+/, '')}`));
    const usage = await findUsage(urls);
    const inUse = urls.filter((u) => (usage[u] || []).length > 0);
    if (inUse.length && !force) {
        return NextResponse.json(
            { error: 'Some files are still in use.', inUse, usage },
            { status: 409 },
        );
    }

    const deleted: string[] = [];
    const errors: { path: string; error: string }[] = [];

    for (const p of paths) {
        const abs = await safeResolve(p);
        if (!abs) {
            errors.push({ path: p, error: 'Not found, or outside the uploads folder.' });
            // A traversal attempt is worth recording — this should never happen
            // from the real UI.
            if (String(p).includes('..')) {
                await recordEvent({
                    type: 'media.traversal',
                    action: `${who} sent a suspicious media path`,
                    description: `Blocked delete for "${String(p).slice(0, 200)}".`,
                    actorUserId: me, subjectUserId: me, notify: 'admins',
                }).catch(() => {});
            }
            continue;
        }
        try {
            const s = await stat(abs);
            if (!s.isFile()) { errors.push({ path: p, error: 'Not a file.' }); continue; }
            await unlink(abs);
            deleted.push(p);
        } catch (err: any) {
            errors.push({ path: p, error: err?.code === 'ENOENT' ? 'Already gone.' : 'Delete failed.' });
        }
    }

    if (deleted.length) {
        await recordEvent({
            type: 'media.delete',
            action: `${who} deleted ${deleted.length} file${deleted.length === 1 ? '' : 's'} from the media library`,
            description: deleted.join(', ').slice(0, 400) + (inUse.length ? ' (some were still referenced)' : ''),
            link: '/admin/management/media',
            actorUserId: me, subjectUserId: me, notify: 'admins',
        }).catch(() => {});
    }

    return NextResponse.json({ deleted, errors });
}
