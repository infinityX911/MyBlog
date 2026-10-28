/**
 * lib/nav.ts — server-side read of the admin-managed navbar.
 *
 * Why this exists: <Navbar> is a client component that used to fetch
 * /api/nav-items in a useEffect. That meant the SERVER-rendered HTML always
 * shipped the component's hardcoded fallback links (/tag/tech, /tag/life, …,
 * /#posts) — links that 404 on this site — and the real menu only appeared
 * after hydration. So every crawl of every page saw nine dead links, and the
 * actual internal links (tutorial hubs) were in no page's HTML at all.
 *
 * Reading the same data on the server lets the layout hand the real menu to
 * the Navbar as its initial state, so the correct links are in the HTML.
 *
 * Shape matches GET /api/nav-items exactly (a one-level tree) so the client
 * component can consume either source without branching.
 */

import { cache } from 'react';
import { prisma } from '@/lib/prisma';

export type NavChild = {
    id: number;
    label: string;
    url: string;
    icon: string | null;
    parentId: number | null;
    sortOrder: number;
    visible: boolean;
};
export type NavNode = NavChild & { children: NavChild[] };

/** Visible navbar tree for a site. Never throws — a DB hiccup yields []. */
export const getNavItems = cache(async (siteKey = 'blog'): Promise<NavNode[]> => {
    try {
        const items = await prisma.navItem.findMany({
            where: { siteKey },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        const visible = items.filter((i) => i.visible !== false);
        return visible
            .filter((i) => i.parentId == null)
            .map((t) => ({
                ...(t as unknown as NavChild),
                children: visible.filter((c) => c.parentId === t.id) as unknown as NavChild[],
            }));
    } catch (err) {
        console.error('[getNavItems]', err);
        return [];
    }
});
