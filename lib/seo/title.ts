/**
 * lib/seo/title.ts — one job: stop the brand suffix appearing twice.
 *
 * The blog layout sets `title: { template: '%s | <siteName>' }`, so every page
 * that returns a plain string title gets the brand appended automatically.
 * When an editor also types the brand into the SEO panel's "Meta title"
 * ("PHP Tutorial … | Flow's Blog"), Next appends it a SECOND time:
 *
 *     PHP Tutorial Learn PHP From Scratch (2026) | Flow's Blog | Flow's Blog
 *
 * `cleanTitle()` strips a trailing "<separator> <brand>" from a DB-provided
 * title so the template can add exactly one suffix. It is deliberately
 * conservative:
 *   - it only strips when a SEPARATOR precedes the brand, so a title that is
 *     simply "Flow's Blog" (or "Flow's Blog Weekly") is left untouched;
 *   - it never returns an empty string;
 *   - curly vs straight apostrophes both match ("Flow's" / "Flow’s");
 *   - it loops, so an already-doubled suffix collapses to none.
 * Titles WITHOUT a suffix pass through unchanged.
 */

/** Brands stripped even when no siteName is passed (the site's own name). */
const DEFAULT_BRANDS = ["Flow's Blog", 'Flow Syntax', 'theflowsyntax.com'];

/** Separator characters an editor may have used before the brand. */
const SEP_CLASS = '[|\\u2013\\u2014\\u00B7\\u2022:~\\-]';

/** Straight/curly apostrophes → "'" (1:1 char swap, so indexes stay valid). */
function normalizeApostrophes(s: string): string {
    return s.replace(/[‘’ʼ´`]/g, "'");
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove a trailing " | Site Name" / " - Site Name" / " — Site Name" suffix.
 *
 * @param title    the raw title from the DB (SEO panel or record title)
 * @param siteName the current site name from Admin → Settings, when available
 */
export function cleanTitle(title: string | null | undefined, siteName?: string | null): string {
    let out = String(title ?? '').trim();
    if (!out) return out;

    const brands = Array.from(
        new Set(
            [siteName, ...DEFAULT_BRANDS]
                .map((b) => normalizeApostrophes(String(b ?? '')).trim())
                .filter((b) => b.length > 1),
        ),
    );
    if (brands.length === 0) return out;

    let changed = true;
    let guard = 0;
    while (changed && guard++ < 5) {
        changed = false;
        for (const brand of brands) {
            const re = new RegExp(`\\s*${SEP_CLASS}\\s*${escapeRegExp(brand)}\\s*$`, 'i');
            // Match against the apostrophe-normalized copy (same length, so the
            // match index is valid on `out`), but slice the ORIGINAL string.
            const m = normalizeApostrophes(out).match(re);
            if (m && typeof m.index === 'number' && m.index > 0) {
                out = out.slice(0, m.index).trim();
                changed = true;
            }
        }
    }

    return out || String(title).trim();
}

export default cleanTitle;
