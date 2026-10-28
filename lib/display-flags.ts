/**
 * lib/display-flags.ts
 *
 * What a visitor is allowed to SEE, as opposed to what exists.
 *
 * Two things on this blog are useful to the owner and not to a reader: the
 * per-post view count and the tag chips. A public "1 views" under every post
 * tells every genuine visitor that nobody reads the site, which is a worse
 * thing to broadcast than it looks, and the number is already in the admin
 * panel where it belongs.
 *
 * An administrator always sees everything, so turning a toggle on never hides
 * anything from the person who needs it. Both default to showing, so the site
 * behaves exactly as before until someone ticks a box.
 *
 * Wrapped in React's `cache()` so the settings row and the session are read
 * once per request no matter how many cards are on the page.
 */

import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSiteByKey } from '@/lib/site-context';

export interface DisplayFlags {
    showViews: boolean;
    showTags: boolean;
}

const SHOW_EVERYTHING: DisplayFlags = { showViews: true, showTags: true };

export const getDisplayFlags = cache(async (): Promise<DisplayFlags> => {
    try {
        const [site, session] = await Promise.all([
            getSiteByKey('blog'),
            getServerSession(authOptions).catch(() => null),
        ]);

        const roles = (session?.user as { roles?: string[] } | undefined)?.roles;
        if (roles?.includes('administrator')) return SHOW_EVERYTHING;

        /* `as any` for the same reason as elsewhere in this project: the
           generated Prisma client can lag a schema edit until the next
           `prisma generate`. The ?? false keeps the old behaviour either way. */
        const s = site as unknown as { hideViewCounts?: boolean; hidePostTags?: boolean } | null;
        return {
            showViews: !(s?.hideViewCounts ?? false),
            showTags: !(s?.hidePostTags ?? false),
        };
    } catch {
        /* A settings or session hiccup must never blank the page furniture. */
        return SHOW_EVERYTHING;
    }
});
