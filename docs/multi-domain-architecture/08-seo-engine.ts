/**
 * 08-seo-engine.ts  →  deploy as  lib/seo/engine.ts
 *
 * UNIVERSAL SEO PANEL ENGINE — one abstraction over your existing, proven
 * lib/seo/scoring.ts so ANY content kind (blog Post, Download, CmsPage on any
 * site, future PORTFOLIO project) is analyzed by the identical rules and
 * produces the identical "89 Good" / "22 Low" health score everywhere.
 *
 * What was Post-specific in scoring.ts and how it generalizes:
 *   • canonical + slug checks hardcode `/posts/${slug}`  → becomes pathPrefix
 * ONE required patch to lib/seo/scoring.ts (backwards compatible — the
 * existing Post call sites don't change because the default stays '/posts'):
 *
 *   -export function getSeoChecks(seo, title, content, slug = '', siteUrl = '')
 *   +export function getSeoChecks(seo, title, content, slug = '', siteUrl = '', pathPrefix = '/posts')
 *
 *   then replace the two hardcoded template strings inside:
 *     `${siteBase}/posts/${slug}`      → `${siteBase}${pathPrefix}/${slug}`
 *     `.endsWith(`/posts/${slug…}`)`   → `.endsWith(`${pathPrefix}/${slug…}`)`
 *   (for CMS pages that live at the root, pass pathPrefix = '')
 *
 * Everything else below is ADDITIVE.
 */

import {
    getSeoChecks,
    type Check,
    type SeoAnalysis,
    type SeoCategory,
    type SeoData,
} from '@/lib/seo/scoring';

// ─────────────────────────────────────────────────────────────────────────────
// A. THE ABSTRACTION: SeoSubject
//    "Anything scoreable" reduced to the five inputs the checks actually read.
//    Adapters (section C) map each DB shape onto this — the engine never
//    imports Prisma models, so it runs identically on the server (route
//    handlers, file 09) and in the browser (live panel, section D).
// ─────────────────────────────────────────────────────────────────────────────

export type SeoSubjectKind = 'post' | 'download' | 'cms-page';

export interface SeoSubject {
    kind: SeoSubjectKind;
    /** Human title of the content (post title / page title). */
    title: string;
    /** Slug WITHOUT prefix ("my-article", "legal/privacy"). */
    slug: string;
    /** Raw HTML content (engine strips tags itself). */
    content: string;
    /** Tenant's canonical origin — drives canonical/internal-link checks
     *  against the CORRECT domain per site. */
    siteUrl: string;
    /** Visible URL prefix for this kind: '/posts' for posts, '' for CMS pages. */
    pathPrefix: string;
    /** The 13 SEO fields — identical shape across PostSeo/DownloadSeo/CmsPageSeo. */
    seo: SeoData;
}

// ─────────────────────────────────────────────────────────────────────────────
// B. THE ENGINE — pure function: subject in, analysis out. Reuses scoring.ts
//    checks + your weighted category model (Basic 40 / Content 35 / Social 15 /
//    Technical 10) so scores stay consistent with the current blog panel.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<SeoCategory, { label: string; weight: number }> = {
    basic:     { label: 'Basic SEO', weight: 40 },
    content:   { label: 'Content',   weight: 35 },
    social:    { label: 'Social',    weight: 15 },
    technical: { label: 'Technical', weight: 10 },
};

/** Score bucket shown as the badge color/word in the panel UI. */
export function scoreLabel(score: number): 'Good' | 'OK' | 'Low' {
    return score >= 80 ? 'Good' : score >= 50 ? 'OK' : 'Low';
}

export function analyzeSeo(subject: SeoSubject): SeoAnalysis {
    // If you exported buildSeoAnalysis from scoring.ts, call it directly here
    // instead — this reimplementation of the aggregation mirrors it exactly.
    // NOTE: the 6th argument requires the pathPrefix patch to scoring.ts
    // described in this file's header — apply it BEFORE deploying this file,
    // or TypeScript will (correctly) reject the extra argument here.
    const checks: Check[] = getSeoChecks(
        subject.seo,
        subject.title,
        subject.content,
        subject.slug,
        subject.siteUrl,
        subject.pathPrefix,
    );

    const categories = (Object.keys(CATEGORY_META) as SeoCategory[]).map((cat) => {
        const catChecks = checks.filter((c) => c.category === cat);
        // 'pending' checks (prereq missing, e.g. no focus keyword yet) are
        // excluded from the denominator — an empty draft isn't unfairly "22 Low"
        // on rules it can't satisfy yet.
        const evaluated = catChecks.filter((c) => c.status !== 'pending');
        const passed = evaluated.filter((c) => c.status === 'pass').length;
        const score = evaluated.length === 0 ? 0 : Math.round((passed / evaluated.length) * 100);
        return {
            category: cat,
            label: CATEGORY_META[cat].label,
            score,
            passed,
            total: evaluated.length,
            checks: catChecks,
        };
    });

    // Weighted overall — categories with zero evaluated checks drop out of the
    // weighting instead of dragging the score to 0.
    const active = categories.filter((c) => c.total > 0);
    const weightSum = active.reduce((a, c) => a + CATEGORY_META[c.category].weight, 0);
    const score = weightSum === 0 ? 0 : Math.round(
        active.reduce((a, c) => a + c.score * CATEGORY_META[c.category].weight, 0) / weightSum,
    );

    return { checks, categories, score };
}

// ─────────────────────────────────────────────────────────────────────────────
// C. ADAPTERS — one tiny function per content kind. Adding a new CMS layout
//    type to the ecosystem = writing one adapter; the panel, the score column,
//    and the persistence pipeline all light up automatically.
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize a nullable DB satellite row into the non-null SeoData the engine
 *  expects (mirrors how SeoPanel initializes empty fields today). */
export function toSeoData(row: Partial<Record<keyof SeoData, unknown>> | null | undefined): SeoData {
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
    return {
        focusKeyword: s(row?.focusKeyword),
        metaTitle: s(row?.metaTitle),
        metaDescription: s(row?.metaDescription),
        robotsIndex: b(row?.robotsIndex, true),
        robotsFollow: b(row?.robotsFollow, true),
        canonicalUrl: s(row?.canonicalUrl),
        ogTitle: s(row?.ogTitle),
        ogDescription: s(row?.ogDescription),
        ogImage: s(row?.ogImage),
        twitterTitle: s(row?.twitterTitle),
        twitterDescription: s(row?.twitterDescription),
        schemaType: s(row?.schemaType) || 'WebPage',
        schemaJson: s(row?.schemaJson),
    };
}

export const adapters = {
    post: (p: { title: string; slug: string; content: string; seo?: unknown }, siteUrl: string): SeoSubject => ({
        kind: 'post', title: p.title, slug: p.slug, content: p.content,
        siteUrl, pathPrefix: '/posts', seo: toSeoData(p.seo as never),
    }),
    download: (d: { title: string; slug: string; excerpt?: string | null; seo?: unknown }, siteUrl: string): SeoSubject => ({
        kind: 'download', title: d.title, slug: d.slug, content: d.excerpt ?? '',
        siteUrl, pathPrefix: '/downloads', seo: toSeoData(d.seo as never),
    }),
    cmsPage: (c: { title: string; slug: string; content: string; seo?: unknown }, siteUrl: string): SeoSubject => ({
        kind: 'cms-page', title: c.title, slug: c.slug, content: c.content,
        siteUrl, pathPrefix: '', seo: toSeoData(c.seo as never), // CMS pages live at root
    }),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// D. FRONTEND WIRING — how the existing SeoPanel becomes universal.
//
// components/admin/blog/SeoPanel.tsx currently computes checks from post
// fields directly. Generalize its props to ONE prop:
//
//   interface SeoPanelProps {
//       subject: SeoSubject;                  // built via adapters.* by the page
//       onSeoChange(seo: SeoData): void;      // parent owns form state, as today
//   }
//
// Inside, the live score is just:
//
//   const analysis = useMemo(() => analyzeSeo(subject), [subject]);
//   // analysis.score → badge number; scoreLabel(analysis.score) → "Good"/"Low"
//   // analysis.categories → the grouped check lists with pass/fail/pending
//
// Because analyzeSeo is pure and synchronous, "real-time" costs nothing: it
// re-runs in the same render as every keystroke (debounce content at ~300ms if
// posts get very large). The blog create/edit pages pass adapters.post(...),
// the downloader CMS editor passes adapters.cmsPage(...) — SAME component,
// SAME checks UI, correct per-site domain via subject.siteUrl.
// ─────────────────────────────────────────────────────────────────────────────
