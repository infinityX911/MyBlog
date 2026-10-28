/**
 * app/(blog)/api/settings/detect-pages/route.ts
 *
 * GET /api/settings/detect-pages  (requires 'manage-settings')
 *
 * Scans the Next.js `app/` directory for real page routes and returns them
 * grouped by route group ( (blog), (yt-downloader), … ). Dynamic routes
 * ([slug], [...slug]), private folders (_x), and the api/admin trees are
 * skipped. Lets the Settings > Per-Page SEO tab auto-detect a new project's
 * pages so they can be given SEO settings.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { promises as fs } from 'fs';
import path from 'path';

const PAGE_FILES = new Set(['page.tsx', 'page.jsx', 'page.ts', 'page.js']);

function labelFor(seg: string): string {
    if (!seg) return 'Home';
    return seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export async function GET() {
    const auth = await requirePermission('manage-settings');
    if (auth.error) return auth.error;

    try {
        const appDir = path.join(process.cwd(), 'app');
        const results: Record<string, { slug: string; label: string }[]> = {};

        async function walk(dir: string): Promise<void> {
            let entries;
            try {
                entries = await fs.readdir(dir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const e of entries) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) {
                    await walk(full);
                } else if (PAGE_FILES.has(e.name)) {
                    const rel = path.relative(appDir, dir);
                    const parts = rel.split(path.sep).filter(Boolean);

                    // Skip internal trees
                    if (parts.some(p => p === 'api' || p === 'admin')) continue;

                    // Route group ( (blog) etc ) — used only to bucket the result
                    const groupPart = parts.find(p => p.startsWith('(') && p.endsWith(')'));
                    const group = groupPart ?? 'root';

                    // Public URL segments: drop route groups and private folders
                    const urlSegs = parts.filter(
                        p => !(p.startsWith('(') && p.endsWith(')')) && !p.startsWith('_'),
                    );

                    // Skip dynamic routes ([slug], [...slug])
                    if (urlSegs.some(p => p.includes('[') || p.includes(']'))) continue;

                    const slug = urlSegs.length ? '/' + urlSegs.join('/') : '/';
                    const label = labelFor(urlSegs[urlSegs.length - 1] ?? '');
                    (results[group] ??= []).push({ slug, label });
                }
            }
        }

        await walk(appDir);

        const groups = Object.entries(results)
            .map(([group, pages]) => {
                const seen = new Set<string>();
                const uniq = pages.filter(p => (seen.has(p.slug) ? false : (seen.add(p.slug), true)));
                uniq.sort((a, b) => a.slug.localeCompare(b.slug));
                return { group, pages: uniq };
            })
            .filter(g => g.pages.length > 0)
            .sort((a, b) => a.group.localeCompare(b.group));

        return NextResponse.json({ groups });
    } catch (e) {
        console.error('[GET /api/settings/detect-pages]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
