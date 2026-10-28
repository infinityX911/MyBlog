/**
 * lib/footer.ts — SERVER-only footer helper (uses prisma).
 *
 * Types/constants/defaults live in ./footer-data (prisma-free) so client
 * components can import those without pulling prisma into the browser bundle.
 */

import { cache } from 'react';
import { prisma } from './prisma';
import { DEFAULT_FOOTER, safeParse, type FooterColumn, type FooterSocial, type FooterData } from './footer-data';

// Re-export the prisma-free bits so existing server imports (`from '@/lib/footer'`)
// keep working.
export * from './footer-data';

/** Read the footer config for a site (cached per request). */
export const getFooterConfig = cache(async (siteKey = 'blog'): Promise<FooterData> => {
    try {
        const row = await prisma.footerConfig.findUnique({ where: { siteKey } });
        if (!row) return DEFAULT_FOOTER;
        const columns = safeParse<FooterColumn[]>(row.columns, DEFAULT_FOOTER.columns);
        const socials = safeParse<FooterSocial[]>(row.socials, DEFAULT_FOOTER.socials);
        return {
            columns: Array.isArray(columns) ? columns : DEFAULT_FOOTER.columns,
            socials: Array.isArray(socials) ? socials : DEFAULT_FOOTER.socials,
            bottomText: row.bottomText?.trim() || DEFAULT_FOOTER.bottomText,
        };
    } catch (err) {
        console.error('[getFooterConfig]', err);
        return DEFAULT_FOOTER;
    }
});
