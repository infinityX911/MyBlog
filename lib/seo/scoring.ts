/**
 * lib/seo/scoring.ts
 *
 * Shared SEO scoring logic — used by both SeoPanel.tsx (edit/create pages)
 * and the Blog list page (SEO Score column), so the score is consistent
 * everywhere.
 *
 * Checks are grouped into 4 categories:
 *   - basic     : focus keyword, title/meta usage, title & description length
 *   - content   : keyword density, word count, readability
 *   - social    : Open Graph image / title / description
 *   - technical : canonical URL, robots configuration
 *
 * Each category gets its own sub-score (0-100). The overall score is a
 * weighted average of the category scores — Basic SEO and Content carry
 * more weight since they matter most for ranking; Social and Technical
 * carry less so a short post isn't unfairly punished for missing OG/canonical.
 */

export interface SeoData {
    focusKeyword:       string;
    metaTitle:          string;
    metaDescription:    string;
    robotsIndex:        boolean;
    robotsFollow:       boolean;
    canonicalUrl:       string;
    ogTitle:            string;
    ogDescription:      string;
    ogImage:            string;
    twitterTitle:       string;
    twitterDescription: string;
    schemaType:         string;
    schemaJson:         string;
}

/**
 * Coerce a nullable/partial SEO record (e.g. a Prisma row where unset fields
 * are `null`) into a fully-populated SeoData with safe string/boolean defaults.
 * Call this before analyzeSeo/getSeoChecks on any DB-sourced SEO object —
 * otherwise a null focusKeyword/metaTitle crashes the .trim() checks.
 */
export function normalizeSeo(raw: Partial<Record<keyof SeoData, unknown>> | null | undefined): SeoData {
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
    return {
        focusKeyword:       str(raw?.focusKeyword),
        metaTitle:          str(raw?.metaTitle),
        metaDescription:    str(raw?.metaDescription),
        robotsIndex:        bool(raw?.robotsIndex, true),
        robotsFollow:       bool(raw?.robotsFollow, true),
        canonicalUrl:       str(raw?.canonicalUrl),
        ogTitle:            str(raw?.ogTitle),
        ogDescription:      str(raw?.ogDescription),
        ogImage:            str(raw?.ogImage),
        twitterTitle:       str(raw?.twitterTitle),
        twitterDescription: str(raw?.twitterDescription),
        schemaType:         str(raw?.schemaType) || 'WebPage',
        schemaJson:         str(raw?.schemaJson),
    };
}

export type SeoCategory = 'basic' | 'content' | 'social' | 'technical';

export type CheckStatus = 'pass' | 'fail' | 'pending';

export interface Check {
    label:    string;
    pass:     boolean;
    /**
     * 'pending' = not evaluated yet because a prerequisite is missing (e.g. a
     * keyword check before any focus keyword is set). Pending checks render
     * neutral (grey) and are EXCLUDED from the score denominator, so an empty
     * new post isn't shown as falsely passing or unfairly failing.
     */
    status:   CheckStatus;
    info:     string;
    category: SeoCategory;
}

export interface CategoryResult {
    category: SeoCategory;
    label:    string;
    score:    number;   // 0-100
    passed:   number;
    total:    number;
    checks:   Check[];
}

export interface SeoAnalysis {
    checks:      Check[];
    categories:  CategoryResult[];
    score:       number; // overall weighted 0-100
}

// ------ Helpers -----------------------------------------------------------

/** Strip HTML tags before counting words / running readability checks. */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Keyword density: what share of the article's words belong to the focus
 * keyword.
 *
 * The phrase's own length has to be part of the sum. This used to divide the
 * number of MATCHES by the word count, which silently punished every
 * multi-word keyword: "agentic ai vs generative ai" is five words, so three
 * natural mentions are 15 words of keyword — but the old maths counted 3 and
 * reported 0.1% against a 0.5% floor. The only way to pass was to repeat the
 * full phrase about ten times in a 1,900-word post, which is keyword stuffing
 * and reads terribly. The check was pushing writers to make articles worse.
 *
 * Two decimal places, because a five-word keyword moves the number in steps of
 * roughly 0.26% and rounding to one decimal hid the difference between "just
 * under" and "comfortably inside" the range.
 */
export function keywordDensity(content: string, keyword: string): number {
    const plain = stripHtml(content);
    if (!keyword.trim() || !plain.trim()) return 0;
    const words = countWords(plain);
    if (words === 0) return 0;
    const kw = keyword.toLowerCase().trim();
    const matches = plain.toLowerCase().split(kw).length - 1;
    const keywordWords = countWords(kw);
    return parseFloat((((matches * keywordWords) / words) * 100).toFixed(2));
}

/** Plain text of the first <p> (or first ~160 chars if no markup). */
export function firstParagraph(html: string): string {
    // Robust to editors that emit bare text nodes or <div> instead of <p>
    // (our contenteditable does exactly that): skip a leading heading, then read
    // the first ~300 chars of body text. The old version only matched the first
    // <p>, so a div-/text-wrapped intro was missed and the "keyword in first
    // paragraph" check failed even when the keyword WAS present.
    let h = (html || '').trim();
    const lead = h.match(/^\s*<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i);
    if (lead) h = h.slice(lead[0].length);
    return stripHtml(h).trim().slice(0, 300);
}

/** Combined lowercased text of all H1–H6 headings. */
export function headingText(html: string): string {
    const matches = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi) || [];
    return matches.map(h => stripHtml(h)).join(' ').toLowerCase();
}

export function readabilityScore(content: string): number {
    const plain = stripHtml(content);
    const sentences = plain.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length === 0) return 0;
    const words = plain.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;
    const avgSentLen = words.length / sentences.length;
    const avgWordLen = words.reduce((a, w) => a + w.length, 0) / words.length;
    const score = Math.max(0, Math.min(100, 206.835 - 1.015 * avgSentLen - 84.6 * (avgWordLen / 5)));
    return Math.round(score);
}

// Category display labels + weights (must sum to 100)
const CATEGORY_META: Record<SeoCategory, { label: string; weight: number }> = {
    basic:     { label: 'Basic SEO', weight: 40 },
    content:   { label: 'Content',   weight: 35 },
    social:    { label: 'Social',    weight: 15 },
    technical: { label: 'Technical', weight: 10 },
};

/**
 * Build the full list of checks for a post.
 *
 * @param seo      SEO data for the post
 * @param title    Post title
 * @param content  Post content (HTML or plain text — HTML is stripped automatically)
 */
export function getSeoChecks(seo: SeoData, title: string, content: string, slug = '', siteUrl = ''): Check[] {
    const plainContent = stripHtml(content);
    const density = keywordDensity(content, seo.focusKeyword);
    const readability = readabilityScore(content);
    const wordCount = countWords(plainContent);

    const kw = seo.focusKeyword.trim().toLowerCase();
    const hasKw = kw.length > 0;
    // Effective <title> = explicit meta title, else the post title (mirrors
    // buildPostMetadata's `seo?.metaTitle || post.title`). We score what Google
    // ACTUALLY renders, not just the raw field — this fixes the mismatch where
    // an empty metaTitle showed "0 chars / red" while the page had a good title.
    const effectiveTitle = seo.metaTitle.trim() || title.trim();
    const titleHasKw       = hasKw && title.toLowerCase().includes(kw);
    const metaTitleHasKw   = hasKw && effectiveTitle.toLowerCase().includes(kw);
    const metaDescHasKw    = hasKw && seo.metaDescription.toLowerCase().includes(kw);
    // Slug check: match keyword against slug with multiple normalizations.
    // "Next.js SEO" → try "next.js-seo" AND "nextjs-seo" (dots stripped)
    // so both "nextjs-seo-tutorial" and "next-js-seo-tutorial" pass.
    const kwSlug        = kw.replace(/\s+/g, '-');
    const kwSlugNoDots  = kw.replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, '-').toLowerCase();
    const slugLower     = slug.toLowerCase();
    const slugHasKw     = hasKw && (
        slugLower.includes(kwSlug) ||
        (kwSlugNoDots.length > 2 && slugLower.includes(kwSlugNoDots))
    );

    const metaTitle = effectiveTitle;            // length check uses the effective title
    const metaDesc  = seo.metaDescription.trim();

    // Headings that promise a section and then deliver nothing before the next
    // heading. The classic case in this codebase: an "Output" heading written
    // while the screenshot is still being taken, then shipped without it. The
    // reader sees a heading and blank space; Google sees an empty section.
    // A block of code, an image, a table or a video all count as content —
    // only genuinely empty runs are flagged.
    const emptySections: string[] = (() => {
        const parts = content.split(/(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)/i);
        const found: string[] = [];
        for (let i = 1; i < parts.length; i += 2) {
            const heading = stripHtml(parts[i]).trim();
            const after = parts[i + 1] ?? '';
            const hasText  = stripHtml(after).trim().length > 0;
            const hasMedia = /<(img|video|iframe|pre|table|figure)\b/i.test(after);
            if (heading && !hasText && !hasMedia) found.push(heading);
        }
        return found;
    })();

    // An internal link is only worth anything if it resolves. This catches the
    // href typos the render-time draft check can't: a link to a slug that was
    // never created at all still looks fine in the editor.
    const suspiciousLinks: string[] = (() => {
        const hrefs = [...content.matchAll(/<a\b[^>]*href=["']([^"']*)["']/gi)].map((m) => m[1]);
        return hrefs.filter((h) => !h.trim() || h === '#' || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(h));
    })();

    // Canonical is valid if the FIELD holds a real https URL, OR the field is
    // empty but a real site URL is configured — because the app then
    // auto-generates `${siteUrl}/posts/${slug}` (see buildPostMetadata). This
    // stops the check failing on an empty field that actually renders fine.
    const isHttpsRealHost = (u: string) => {
        try {
            const p = new URL(u);
            return p.protocol === 'https:' && !p.hostname.includes('localhost') &&
                   !p.hostname.includes('127.0.0.1') && p.hostname.includes('.');
        } catch { return false; }
    };
    const canonicalField = seo.canonicalUrl.trim();
    const siteBase = siteUrl.trim()
        ? (/^https?:\/\//i.test(siteUrl) ? siteUrl.trim() : `https://${siteUrl.trim()}`).replace(/\/$/, '')
        : '';
    const canonicalOk = canonicalField
        ? isHttpsRealHost(canonicalField)
        : (!!siteBase && slug.length > 0 && isHttpsRealHost(`${siteBase}/${slug}`));

    // Structured data: schema type selected, and any CUSTOM JSON-LD is valid
    // AND complete — has headline/name + datePublished (the core Article fields
    // Google needs for a rich result). Empty custom JSON = fine, because the
    // page renders a complete auto-generated BlogPosting + BreadcrumbList.
    const schemaOk = (() => {
        if (!seo.schemaType.trim()) return false;
        const custom = seo.schemaJson.trim();
        if (!custom) return true;
        try {
            const obj = JSON.parse(custom);
            const nodes = Array.isArray(obj['@graph']) ? obj['@graph'] : [obj];
            return nodes.some((n: any) => n && (n.headline || n.name) && n.datePublished);
        } catch { return false; }
    })();

    // Twitter card has an effective title + description (own field, else OG,
    // else meta/post title — mirrors buildPostMetadata's twitter fallback).
    const twitterTitleEff = (seo.twitterTitle.trim() || seo.ogTitle.trim() || effectiveTitle);
    const twitterDescEff  = (seo.twitterDescription.trim() || seo.ogDescription.trim() || metaDesc);
    const twitterOk = twitterTitleEff.length > 0 && twitterDescEff.length > 0;

    // ── Images: alt-text coverage + keyword in alt ──────────────────────────
    const imgTags  = content.match(/<img[^>]*>/gi) || [];
    const imgCount = imgTags.length;
    const altTexts = imgTags.map(t => {
        const m = t.match(/alt=(["'])([\s\S]*?)\1/i);
        return m ? m[2].trim() : '';
    });
    const allImagesHaveAlt = imgCount > 0 && altTexts.every(a => a.length > 0);
    const kwInAlt = hasKw && altTexts.some(a => a.toLowerCase().includes(kw));

    // ── Internal links (relative, anchor, or same-host absolute) ────────────
    const aTags  = content.match(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>/gi) || [];
    const hrefs  = aTags.map(a => { const m = a.match(/href=(["'])(.*?)\1/i); return m ? m[2].trim() : ''; });
    const siteHost = (() => { try { return new URL(siteBase || 'https://example.com').host.toLowerCase(); } catch { return ''; } })();
    const hasInternalLink = hrefs.some(h => {
        const hh = h.toLowerCase();
        if (!hh) return false;
        if (hh.startsWith('/') || hh.startsWith('#') || hh.startsWith('./') || hh.startsWith('../')) return true;
        if (/^https?:\/\//.test(hh)) { try { return new URL(hh).host.toLowerCase() === siteHost; } catch { return false; } }
        return false; // mailto:, tel:, external link, etc.
    });

    // ── Clean URL slug (lowercase, hyphen-separated words, ≤75 chars) ───────
    const cleanSlug = slug.length > 0 && slug.length <= 75 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

    // ── Self-referencing canonical (effective canonical points to THIS post) ─
    // Posts are now category-siloed (/<category>/<slug>), so accept any canonical
    // that ends in this post's slug (covers /<category>/<slug> and legacy /posts/<slug>).
    const effectiveCanonical = canonicalField || (siteBase && slug ? `${siteBase}/${slug}` : '');
    const selfCanonical = slug.length > 0 && effectiveCanonical.toLowerCase().endsWith(`/${slug.toLowerCase()}`);

    // status helper: a check is 'pending' when its prerequisite is missing
    // (here: no focus keyword yet). Otherwise it's a real pass/fail.
    const st = (pass: boolean, pending = false): CheckStatus =>
        pending ? 'pending' : (pass ? 'pass' : 'fail');

    return [
        // ── BASIC SEO ──────────────────────────────────────────────
        {
            category: 'basic',
            label: 'Focus keyword set',
            pass: hasKw,
            status: st(hasKw),
            info: 'Add a focus keyword so this checklist can analyse your content against it.',
        },
        {
            category: 'basic',
            label: 'Keyword in post title',
            pass: titleHasKw,
            status: st(titleHasKw, !hasKw),
            info: `Your post title should contain "${seo.focusKeyword || 'your focus keyword'}".`,
        },
        {
            category: 'basic',
            label: 'Keyword in meta title',
            pass: metaTitleHasKw,
            status: st(metaTitleHasKw, !hasKw),
            info: 'Your meta title should contain the focus keyword.',
        },
        {
            category: 'basic',
            label: 'Keyword in meta description',
            pass: metaDescHasKw,
            status: st(metaDescHasKw, !hasKw),
            info: 'Your meta description should mention the focus keyword.',
        },
        {
            category: 'basic',
            label: 'Keyword in URL slug',
            pass: slugHasKw,
            status: st(slugHasKw, !hasKw),
            info: `Your post slug should contain the focus keyword (e.g. "${kwSlug}").`,
        },
        {
            category: 'basic',
            label: `Meta title length (${metaTitle.length} chars)`,
            pass: metaTitle.length >= 30 && metaTitle.length <= 60,
            status: st(metaTitle.length >= 30 && metaTitle.length <= 60),
            info: 'Meta title should be 30–60 characters. Set one in the SEO tab.',
        },
        {
            category: 'basic',
            label: `Meta description length (${metaDesc.length} chars)`,
            pass: metaDesc.length >= 70 && metaDesc.length <= 160,
            status: st(metaDesc.length >= 70 && metaDesc.length <= 160),
            info: 'Meta description should be 70–160 characters. Set one in the SEO tab.',
        },

        // ── CONTENT ────────────────────────────────────────────────
        {
            category: 'content',
            label: 'Keyword in first paragraph',
            pass: hasKw && firstParagraph(content).toLowerCase().includes(kw),
            status: st(hasKw && firstParagraph(content).toLowerCase().includes(kw), !hasKw),
            info: 'Mention the focus keyword early — ideally in the opening paragraph.',
        },
        {
            category: 'content',
            label: 'Keyword in a subheading (H2/H3)',
            pass: hasKw && headingText(content).includes(kw),
            status: st(hasKw && headingText(content).includes(kw), !hasKw),
            info: 'Use the focus keyword in at least one subheading (H2 or H3).',
        },
        {
            category: 'content',
            label: `Keyword density (${density}%)`,
            pass: density >= 0.5 && density <= 2.5,
            status: st(density >= 0.5 && density <= 2.5, !hasKw),
            info: 'Ideal keyword density is 0.5% – 2.5%. Use the focus keyword naturally a few times in your content.',
        },
        {
            category: 'content',
            label: `Word count (${wordCount} words)`,
            pass: wordCount >= 300,
            status: st(wordCount >= 300, wordCount === 0),
            info: 'Content should have at least 300 words for good SEO. Keep writing!',
        },
        {
            category: 'content',
            label: `Readability score (${readability}/100)`,
            pass: readability >= 60,
            status: st(readability >= 60, wordCount === 0),
            info: 'Aim for a readability score above 60 (Flesch scale). Use shorter sentences and simpler words.',
        },

        {
            category: 'content',
            label: 'Image with alt text in content',
            pass: /<img[^>]+alt=(["'])[^"'\1]+\1/i.test(content),
            status: st(/<img[^>]+alt=(["'])[^"'\1]+\1/i.test(content), wordCount === 0),
            info: 'Add at least one image with descriptive alt text in the post body.',
        },
        {
            category: 'content',
            label: 'All images have alt text',
            pass: allImagesHaveAlt,
            // Not applicable (pending) until there is at least one image.
            status: st(allImagesHaveAlt, imgCount === 0),
            info: 'Every image needs a descriptive alt attribute for accessibility and image SEO.',
        },
        {
            category: 'content',
            label: 'Focus keyword in image alt',
            pass: kwInAlt,
            status: st(kwInAlt, !hasKw || imgCount === 0),
            info: 'Include the focus keyword in at least one image’s alt text where it fits naturally.',
        },
        {
            category: 'content',
            label: 'Internal link in content',
            pass: hasInternalLink,
            status: st(hasInternalLink, wordCount === 0),
            info: 'Link to at least one of your other posts/pages to build topical authority and help crawlers.',
        },
        {
            category: 'content',
            label: emptySections.length
                ? `Empty section: ${emptySections.slice(0, 3).map((h) => `“${h}”`).join(', ')}${emptySections.length > 3 ? ` +${emptySections.length - 3} more` : ''}`
                : 'No empty sections',
            pass: emptySections.length === 0,
            status: st(emptySections.length === 0, wordCount === 0),
            info: 'Every heading needs something under it before the next heading — a paragraph, a code block, or an image. An "Output" heading with nothing beneath it reads as a broken page.',
        },
        {
            category: 'content',
            label: suspiciousLinks.length ? `Broken links (${suspiciousLinks.length})` : 'No placeholder links',
            pass: suspiciousLinks.length === 0,
            status: st(suspiciousLinks.length === 0, wordCount === 0),
            info: 'Empty hrefs, bare "#" and localhost URLs are placeholders that shipped by accident. Point them somewhere real or remove the link.',
        },

        // ── SOCIAL ─────────────────────────────────────────────────
        {
            category: 'social',
            label: 'Open Graph image set',
            pass: seo.ogImage.trim().length > 0,
            status: st(seo.ogImage.trim().length > 0),
            info: 'Add an OG image (1200x630px recommended) for better social media previews.',
        },
        {
            category: 'social',
            label: 'Open Graph title/description set',
            pass: seo.ogTitle.trim().length > 0 || seo.ogDescription.trim().length > 0 || (metaTitle.length > 0 && metaDesc.length > 0),
            status: st(seo.ogTitle.trim().length > 0 || seo.ogDescription.trim().length > 0 || (metaTitle.length > 0 && metaDesc.length > 0)),
            info: 'Set an OG title/description, or a meta title + description which are used as fallback.',
        },
        {
            category: 'social',
            label: 'Twitter card title/description',
            pass: twitterOk,
            status: st(twitterOk),
            info: 'Set a Twitter title + description, or rely on the OG / meta values used as fallback (a description must exist somewhere).',
        },

        // ── TECHNICAL ──────────────────────────────────────────────
        {
            category: 'technical',
            label: 'Canonical URL valid',
            pass: canonicalOk,
            status: st(canonicalOk),
            info: 'Canonical must be a real HTTPS URL. Leave the field empty and it is auto-generated from your site URL + slug, or set one explicitly (not localhost).',
        },
        {
            category: 'technical',
            label: 'Structured data complete & valid',
            pass: schemaOk,
            status: st(schemaOk),
            info: 'Schema type is set and any custom JSON-LD is valid and has headline + datePublished. Leave the JSON-LD box empty to use the auto-generated schema, or click Auto-generate.',
        },
        {
            category: 'technical',
            label: 'Clean URL slug',
            pass: cleanSlug,
            status: st(cleanSlug, slug.length === 0),
            info: 'Use a short, lowercase, hyphen-separated slug (no spaces, underscores, or symbols), ideally under 75 characters.',
        },
        {
            category: 'technical',
            label: 'Self-referencing canonical',
            pass: selfCanonical,
            status: st(selfCanonical, slug.length === 0),
            info: 'The canonical URL should point to THIS post (…/posts/your-slug), not another page — otherwise Google may drop it from the index.',
        },
        {
            category: 'technical',
            label: 'Page set to index + follow',
            pass: seo.robotsIndex === true && seo.robotsFollow === true,
            status: st(seo.robotsIndex === true && seo.robotsFollow === true),
            info: 'Robots index and follow should both be enabled for public posts to rank.',
        },
    ];
}

/** Group checks by category and compute each category's sub-score. */
export function getCategoryResults(checks: Check[]): CategoryResult[] {
    const categories: SeoCategory[] = ['basic', 'content', 'social', 'technical'];
    return categories.map(category => {
        const categoryChecks = checks.filter(c => c.category === category);
        // Pending checks (prerequisite missing) are excluded from the score so
        // they neither falsely boost nor unfairly lower it.
        const evaluated = categoryChecks.filter(c => c.status !== 'pending');
        const passed = evaluated.filter(c => c.status === 'pass').length;
        const total = evaluated.length;
        const score = total === 0 ? 0 : Math.round((passed / total) * 100);
        return {
            category,
            label: CATEGORY_META[category].label,
            score,
            passed,
            total,
            checks: categoryChecks,
        };
    });
}

/** Weighted overall score across categories. */
export function overallScore(checks: Check[]): number {
    const results = getCategoryResults(checks);
    let weightedSum = 0;
    let weightTotal = 0;
    for (const result of results) {
        const weight = CATEGORY_META[result.category].weight;
        weightedSum += result.score * weight;
        weightTotal += weight;
    }
    if (weightTotal === 0) return 0;
    return Math.round(weightedSum / weightTotal);
}

export function scoreColor(score: number): string {
    if (score >= 75) return '#27ae60';
    if (score >= 40) return '#f39c12';
    return '#e74c3c';
}

export function scoreLabel(score: number): string {
    if (score >= 75) return 'Good';
    if (score >= 40) return 'Needs work';
    return 'Poor';
}

/**
 * Convenience: run the full analysis in one call.
 * Used by the SEO panel (with full content) and the blog list page
 * (with post.title, post.content, post.seo).
 */
export function analyzeSeo(seo: SeoData, title: string, content: string, slug = '', siteUrl = ''): SeoAnalysis {
    const checks = getSeoChecks(seo, title, content, slug, siteUrl);
    const categories = getCategoryResults(checks);
    const score = overallScore(checks);
    return { checks, categories, score };
}
