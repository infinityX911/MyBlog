/**
 * lib/media.ts — shared helpers for the Media Library.
 *
 * Everything here exists to keep ONE rule true: a request may only ever touch a
 * file that genuinely lives inside `public/uploads`. Filenames arrive from the
 * browser, so they are attacker-controlled input — `../` sequences, absolute
 * paths, URL-encoded separators and symlinks all have to be rejected before any
 * fs call happens, not after.
 */

import 'server-only';
import path from 'path';
import { readdir, stat, realpath } from 'fs/promises';
import { prisma } from '@/lib/prisma';

/** Absolute path of the uploads root. Everything must resolve inside this. */
export function uploadsRoot(): string {
    return path.join(process.cwd(), 'public', 'uploads');
}

export type MediaFile = {
    /** Public URL, e.g. "/uploads/blog/1786…webp" */
    url: string;
    /** Path relative to the uploads root, e.g. "blog/1786…webp" */
    rel: string;
    name: string;
    folder: string;
    size: number;
    modified: string;
    ext: string;
};

const IMAGE_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif', '.gif']);

/**
 * Resolve a client-supplied relative path to an absolute one, or return null
 * if it escapes the uploads root in any way.
 *
 * The realpath check at the end matters: without it a symlink placed inside
 * uploads could point anywhere on the host, and every earlier string check
 * would still pass.
 */
export async function safeResolve(rel: string): Promise<string | null> {
    if (typeof rel !== 'string' || !rel.trim()) return null;
    // Strip a leading "/uploads/" so the API accepts either form.
    let cleaned = rel.trim().replace(/^\/+/, '').replace(/^uploads\//, '');
    // Null bytes and backslashes are never legitimate here.
    if (cleaned.includes('\0') || cleaned.includes('\\')) return null;
    // Decode once so "%2e%2e%2f" can't sneak past the ".." test below.
    try { cleaned = decodeURIComponent(cleaned); } catch { return null; }
    if (cleaned.includes('\0') || cleaned.includes('..')) return null;
    if (path.isAbsolute(cleaned)) return null;

    const root = uploadsRoot();
    const abs = path.resolve(root, cleaned);
    if (abs !== root && !abs.startsWith(root + path.sep)) return null;

    try {
        const real = await realpath(abs);
        const realRoot = await realpath(root);
        if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return null;
        return real;
    } catch {
        return null; // does not exist
    }
}

/** Walk the uploads tree. Depth-capped so a symlink loop can't spin forever. */
export async function listMedia(max = 2000): Promise<MediaFile[]> {
    const root = uploadsRoot();
    const out: MediaFile[] = [];

    async function walk(dir: string, depth: number): Promise<void> {
        if (depth > 4 || out.length >= max) return;
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            return; // uploads folder may not exist yet on a fresh install
        }
        for (const e of entries) {
            if (out.length >= max) return;
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) {
                await walk(abs, depth + 1);
                continue;
            }
            if (!e.isFile()) continue;                 // skip symlinks/sockets
            const ext = path.extname(e.name).toLowerCase();
            if (!IMAGE_EXT.has(ext)) continue;
            try {
                const s = await stat(abs);
                const rel = path.relative(root, abs).split(path.sep).join('/');
                out.push({
                    url: `/uploads/${rel}`,
                    rel,
                    name: e.name,
                    folder: path.dirname(rel) === '.' ? '' : path.dirname(rel),
                    size: s.size,
                    modified: s.mtime.toISOString(),
                    ext: ext.slice(1),
                });
            } catch { /* file vanished mid-walk */ }
        }
    }

    await walk(root, 0);
    out.sort((a, b) => b.modified.localeCompare(a.modified));
    return out;
}

export type Usage = { where: string; label: string; id?: number };

/**
 * Find everything that references these files, so the UI can warn before a
 * delete breaks a live page. Matches on the URL substring, which catches both
 * the relative form stored by the editor and any absolute form pasted by hand.
 */
export async function findUsage(urls: string[]): Promise<Record<string, Usage[]>> {
    const result: Record<string, Usage[]> = {};
    for (const u of urls) result[u] = [];
    if (!urls.length) return result;

    const add = (url: string, where: string, label: string, id?: number) => {
        if (result[url]) result[url].push({ where, label, id });
    };
    const hit = (hay: unknown, needle: string) =>
        typeof hay === 'string' && hay.includes(needle);

    try {
        const [posts, pages, downloads, settings, users] = await Promise.all([
            prisma.post.findMany({ select: { id: true, title: true, content: true, featuredImage: true, seo: { select: { ogImage: true } } } }),
            prisma.cmsPage.findMany({ select: { id: true, title: true, content: true, blocks: true, heroBg: true, seo: { select: { ogImage: true } } } }),
            prisma.download.findMany({ select: { id: true, title: true, content: true, image: true, seo: { select: { ogImage: true } } } }),
            prisma.siteSetting.findMany({ select: { id: true, siteKey: true, ogImage: true, siteIcon: true, adminLogo: true, authorImage: true } }),
            prisma.user.findMany({ where: { avatarUrl: { not: null } }, select: { id: true, name: true, avatarUrl: true } }),
        ]);

        for (const u of urls) {
            for (const p of posts) {
                if (hit(p.content, u) || hit(p.featuredImage, u) || hit(p.seo?.ogImage, u)) add(u, 'Post', p.title, p.id);
            }
            for (const p of pages) {
                if (hit(p.content, u) || hit(p.blocks, u) || hit(p.heroBg, u) || hit(p.seo?.ogImage, u)) add(u, 'Page', p.title, p.id);
            }
            for (const d of downloads) {
                if (hit(d.content, u) || hit(d.image, u) || hit(d.seo?.ogImage, u)) add(u, 'Download', d.title, d.id);
            }
            for (const s of settings) {
                if (hit(s.ogImage, u) || hit(s.siteIcon, u) || hit(s.adminLogo, u) || hit(s.authorImage, u)) add(u, 'Settings', s.siteKey, s.id);
            }
            for (const usr of users) {
                if (hit(usr.avatarUrl, u)) add(u, 'User avatar', usr.name, usr.id);
            }
        }
    } catch (err) {
        console.error('[media findUsage]', err);
    }
    return result;
}
