'use client';

/**
 * components/admin/blog/SeoPanel.tsx
 *
 * Reusable Yoast-style SEO panel used inside Add/Edit post pages.
 * Plan Step 3: SEO panel component
 *
 * Features:
 *  - Focus keyword input
 *  - Meta title + description with character counters
 *  - Robots index / follow toggles
 *  - Canonical URL
 *  - Open Graph (title, description, image)
 *  - Twitter card (title, description)
 *  - Schema.org type selector
 *  - Live SEO score checker (keyword density, title length, desc length, readability)
 *    — now powered by the shared lib/seo/scoring module, grouped into
 *    Basic SEO / Content / Social / Technical categories with sub-scores,
 *    so the score matches the Blog list page exactly.
 *  - Google SERP preview
 */

import React, { useState } from 'react';
import {
    type SeoData as SharedSeoData,
    analyzeSeo,
    scoreColor,
    scoreLabel,
} from '@/lib/seo/scoring';
import { sanitizePostHtml } from '@/lib/contentHtml';

export type SeoData = SharedSeoData;

export const emptySeo = (): SeoData => ({
    focusKeyword:       '',
    metaTitle:          '',
    metaDescription:    '',
    robotsIndex:        true,
    robotsFollow:       true,
    canonicalUrl:       '',
    ogTitle:            '',
    ogDescription:      '',
    ogImage:            '',
    twitterTitle:       '',
    twitterDescription: '',
    schemaType:         'BlogPosting',
    schemaJson:         '',
});

interface SeoPanelProps {
    seo: SeoData;
    onChange: (seo: SeoData) => void;
    postTitle?: string;
    postContent?: string;
    postSlug?: string;
    postAuthor?: string;
    /** ISO date string of original publish date (edit page only).
     *  If provided, schema auto-generate uses this as datePublished
     *  instead of today — so editing an old post doesn't reset its date. */
    postPublishedAt?: string;
    /** Site name from site_settings DB (e.g. "InkDrop").
     *  Used in schema publisher.name and as fallback for title separator.
     *  Avoids using document.title which would give "Admin Panel". */
    siteName?: string;
    /** Canonical site URL from site_settings DB (e.g. "https://inkdrop.blog").
     *  Used in schema url, mainEntityOfPage, and publisher.logo.
     *  Avoids using window.location.origin which gives localhost. */
    siteUrl?: string;
    /** The post's primary category name (e.g. "Tech") — used for the schema
     *  articleSection instead of a hardcoded "Tutorial". */
    postCategory?: string;
    /** URL path prefix for the live/preview URL. Blog posts live at
     *  "/posts/<slug>" (default); CMS pages live at "/<slug>" — pass "". */
    urlBasePath?: string;
}

// ------ Component -------------------------------------------------------

export default function SeoPanel({ seo, onChange, postTitle = '', postContent = '', postSlug = '', postAuthor = '', postPublishedAt = '', siteName = '', siteUrl = '', postCategory = '', urlBasePath = '/posts' }: SeoPanelProps) {
    const [activeTab, setActiveTab] = useState<'seo' | 'og' | 'twitter' | 'schema' | 'score'>('seo');
    // Normalise: "/posts" → "/posts", "" → "" (page lives at /<slug>).
    const basePath = urlBasePath ? `/${urlBasePath.replace(/^\/+|\/+$/g, '')}` : '';

    const set = (key: keyof SeoData, value: any) => onChange({ ...seo, [key]: value });

    // Builds JSON-LD structured data from the post's existing fields using
    // JSON.stringify, which always produces syntactically valid JSON — this
    // replaces the old workflow of hand-typing/pasting JSON into the
    // textarea below, which was the root cause of "Expected ',' or '}'"
    // parse errors when the post was rendered (raw newlines/formatting
    // pasted in broke JSON.parse on the server).
    const generateSchemaJson = () => {
        const plainExcerpt = (postContent || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 160);

        // Prefer site settings URL (from DB) over window.location.origin
        // because window.location gives localhost in dev — wrong for schema.
        const rawSiteUrl = siteUrl ||
            (typeof window !== 'undefined' && window.location.origin) ||
            (process.env.NEXT_PUBLIC_SITE_URL ?? '');

        // Ensure https:// protocol for production
        const baseUrl = /^https?:\/\//i.test(rawSiteUrl)
            ? rawSiteUrl.replace(/\/$/, '')
            : `https://${rawSiteUrl}`.replace(/\/$/, '');

        const postUrl = postSlug ? `${baseUrl}${basePath}/${postSlug}` : baseUrl;

        // Count words in content for wordCount field
        const wordCount = (postContent || '')
            .replace(/<[^>]*>/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean).length;

        // Use original publish date if editing; today for new posts
        const today = new Date().toISOString().slice(0, 10);
        const publishDate = postPublishedAt
            ? postPublishedAt.slice(0, 10)
            : today;

        const schema: Record<string, any> = {
            '@context': 'https://schema.org',
            '@type': seo.schemaType || 'BlogPosting',
            headline: postTitle || 'Untitled',
            description: seo.metaDescription || plainExcerpt || seo.ogDescription || '',
            image: seo.ogImage || seo.featuredImage || '',
            datePublished: publishDate,
            dateModified: today,
            author: {
                '@type': 'Person',
                name: postAuthor || 'Author',
            },
            publisher: {
                '@type': 'Organization',
                // Use site name from DB settings — never document.title
                // (which would give "Admin Panel" or the post title).
                name: siteName || 'Publisher',
                logo: {
                    '@type': 'ImageObject',
                    url: `${baseUrl}/og-image.png`,
                },
            },
            url: postUrl,
            mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': postUrl,
            },
            ...(seo.focusKeyword ? { keywords: seo.focusKeyword } : {}),
            ...(wordCount > 0 ? { wordCount } : {}),
            ...(postCategory ? { articleSection: postCategory } : {}),
        };

        // Remove empty string values so schema stays clean
        Object.keys(schema).forEach(k => {
            if (schema[k] === '' || schema[k] === null || schema[k] === undefined) {
                delete schema[k];
            }
        });

        // JSON.stringify guarantees valid JSON — no risk of broken commas/quotes
        onChange({ ...seo, schemaJson: JSON.stringify(schema, null, 2) });
    };

    // Score must be computed against SANITIZED content — the same HTML
    // that will actually render on the page. Scoring raw editor HTML gives
    // inflated results because it sees tags (strong, img, ul) that the
    // sanitizer or the editor's output may strip before saving.
    const sanitizedContentForScoring = sanitizePostHtml(postContent);
    const { checks, categories, score } = analyzeSeo(seo, postTitle, sanitizedContentForScoring, postSlug, siteUrl);

    // Pending checks (e.g. keyword checks before a focus keyword is set) are
    // shown neutral and don't count toward the passed/total tally.
    const evaluatedChecks = checks.filter(c => c.status !== 'pending');
    const passedCount = checks.filter(c => c.status === 'pass').length;

    // Visuals per status — keeps the JSX below readable.
    const statusVisual = (status: 'pass' | 'fail' | 'pending') => {
        if (status === 'pass')    return { icon: '✓', color: '#27ae60', bg: 'rgba(39,174,96,0.08)' };
        if (status === 'pending') return { icon: '○', color: '#9aa0a6', bg: 'rgba(154,160,166,0.10)' };
        return { icon: '✗', color: '#e74c3c', bg: 'rgba(231,76,60,0.06)' };
    };

    const serpTitle = seo.metaTitle || postTitle || 'Page Title';
    const serpDesc = seo.metaDescription || 'No meta description set — add one to improve click-through rate.';
    // SERP preview base. Do NOT use window.location.origin here — it is ''
    // on the server (SSR) but 'http://localhost:3000' on the client, which made
    // the server and client render different URLs → React hydration mismatch.
    // siteUrl (from settings) is empty on the first render of both server and
    // client, so falling back to the public env URL keeps them identical; once
    // the settings fetch resolves, siteUrl updates client-side (no mismatch).
    const serpBase = siteUrl || (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yoursite.com');
    const serpUrl = seo.canonicalUrl || `${serpBase}${basePath}/${postSlug}`;
    const isLocalhostCanonical = serpUrl.includes('localhost') || serpUrl.includes('127.0.0.1');

    const tabStyle = (tab: string): React.CSSProperties => ({
        padding: '6px 12px',
        border: 'none',
        borderBottom: activeTab === tab ? '2px solid #0858f7' : '2px solid transparent',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: activeTab === tab ? 600 : 400,
        color: activeTab === tab ? '#0858f7' : 'inherit',
    });

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '8px 10px',
        border: '1px solid var(--bs-border-color, #dee2e6)',
        borderRadius: '4px',
        fontSize: '13px',
        background: 'var(--input-bg, transparent)',
        color: 'inherit',
        boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '12px',
        fontWeight: 600,
        display: 'block',
        marginBottom: '4px',
        opacity: 0.75,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    };

    return (
        <div className="seo-panel-root" style={{ border: '1px solid var(--bs-border-color, #dee2e6)', borderRadius: '8px', overflow: 'hidden', marginTop: '16px' }}>

            {/* Header with score */}
            <div style={{ background: 'var(--seo-panel-header-bg, #f8f9fa)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bs-border-color, #dee2e6)' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>SEO Analysis</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        border: `3px solid ${scoreColor(score)}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, color: scoreColor(score),
                    }}>
                        {score}
                    </div>
                    <span style={{ fontSize: '12px', color: scoreColor(score), fontWeight: 600 }}>
                        {scoreLabel(score)}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--bs-border-color, #dee2e6)', padding: '0 8px', background: 'var(--seo-panel-header-bg, #f8f9fa)' }}>
                <button style={tabStyle('seo')} onClick={() => setActiveTab('seo')}>SEO</button>
                <button style={tabStyle('og')} onClick={() => setActiveTab('og')}>Open Graph</button>
                <button style={tabStyle('twitter')} onClick={() => setActiveTab('twitter')}>Twitter</button>
                <button style={tabStyle('schema')} onClick={() => setActiveTab('schema')}>Schema</button>
                <button style={tabStyle('score')} onClick={() => setActiveTab('score')}>
                    {/* Same denominator as the summary inside the panel: pending
                        checks are excluded from BOTH. This tab used checks.length
                        (24) while the panel used evaluatedChecks.length (22), so
                        one tally read "16/24" here and "16 of 22" there. */}
                    Checklist ({passedCount}/{evaluatedChecks.length})
                </button>
            </div>

            <div style={{ padding: '16px' }}>

                {/* ── SEO TAB ── */}
                {activeTab === 'seo' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        {/* SERP preview */}
                        <div style={{ background: 'var(--seo-serp-bg, #fff)', border: '1px solid var(--bs-border-color, #dee2e6)', borderRadius: '8px', padding: '12px 16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.6, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'inherit' }}>Google preview</div>
                            <div style={{ fontSize: '18px', color: '#1a0dab', cursor: 'pointer', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {serpTitle}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--seo-serp-url, #006621)', marginBottom: '4px' }}>{serpUrl}</div>
                            <div style={{ fontSize: '13px', color: 'var(--seo-serp-desc, #545454)', lineHeight: 1.5 }}>
                                {serpDesc.length > 160 ? serpDesc.slice(0, 157) + '...' : serpDesc}
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Focus keyword</label>
                            <input style={inputStyle} type="text" value={seo.focusKeyword}
                                onChange={e => set('focusKeyword', e.target.value)}
                                placeholder="e.g. next.js tutorial" />
                        </div>

                        <div>
                            <label style={labelStyle}>
                                Meta title
                                <span style={{ float: 'right', fontWeight: 400, color: seo.metaTitle.length > 60 ? '#e74c3c' : '#27ae60' }}>
                                    {seo.metaTitle.length}/60
                                </span>
                            </label>
                            <input style={{ ...inputStyle, borderColor: seo.metaTitle.length > 60 ? '#e74c3c' : undefined }}
                                type="text" value={seo.metaTitle}
                                onChange={e => set('metaTitle', e.target.value)}
                                placeholder={postTitle || 'SEO title for this post'} />
                        </div>

                        <div>
                            <label style={labelStyle}>
                                Meta description
                                <span style={{ float: 'right', fontWeight: 400, color: seo.metaDescription.length > 160 ? '#e74c3c' : seo.metaDescription.length >= 70 ? '#27ae60' : '#f39c12' }}>
                                    {seo.metaDescription.length}/160
                                </span>
                            </label>
                            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
                                value={seo.metaDescription}
                                onChange={e => set('metaDescription', e.target.value)}
                                placeholder="Brief description shown in search results (70–160 chars)" />
                        </div>

                        <div>
                            <label style={labelStyle}>Canonical URL</label>
                            <input style={inputStyle} type="url" value={seo.canonicalUrl}
                                onChange={e => set('canonicalUrl', e.target.value)}
                                placeholder="https://yoursite.com/post-slug" />
                        </div>

                        {/* Robots toggles */}
                        <div style={{ display: 'flex', gap: '24px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                <input type="checkbox" checked={seo.robotsIndex}
                                    onChange={e => set('robotsIndex', e.target.checked)} />
                                <span><b>Index</b> this post</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                <input type="checkbox" checked={seo.robotsFollow}
                                    onChange={e => set('robotsFollow', e.target.checked)} />
                                <span><b>Follow</b> links in this post</span>
                            </label>
                        </div>

                        {/* Robots preview */}
                        <div style={{ background: 'var(--seo-panel-header-bg, #f8f9fa)', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace', color: 'inherit' }}>
                            {`<meta name="robots" content="${seo.robotsIndex ? 'index' : 'noindex'}, ${seo.robotsFollow ? 'follow' : 'nofollow'}">`}
                        </div>
                    </div>
                )}

                {/* ── OPEN GRAPH TAB ── */}
                {activeTab === 'og' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ fontSize: '12px', opacity: 0.6, lineHeight: 1.5 }}>
                            Open Graph tags control how your post appears when shared on Facebook, LinkedIn, WhatsApp, etc.
                        </div>
                        <div>
                            <label style={labelStyle}>OG title</label>
                            <input style={inputStyle} type="text" value={seo.ogTitle}
                                onChange={e => set('ogTitle', e.target.value)}
                                placeholder={seo.metaTitle || postTitle || 'Title for social sharing'} />
                        </div>
                        <div>
                            <label style={labelStyle}>OG description</label>
                            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
                                value={seo.ogDescription}
                                onChange={e => set('ogDescription', e.target.value)}
                                placeholder="Description for social sharing" />
                        </div>
                        <div>
                            <label style={labelStyle}>OG image URL</label>
                            <input style={inputStyle} type="url" value={seo.ogImage}
                                onChange={e => set('ogImage', e.target.value)}
                                placeholder="https://yoursite.com/images/post-og.jpg (1200x630px recommended)" />
                        </div>
                        {seo.ogImage && (
                            <div style={{ border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden', maxWidth: '400px' }}>
                                <img src={seo.ogImage} alt="OG preview" style={{ width: '100%', display: 'block' }}
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <div style={{ padding: '8px 10px', background: '#f8f9fa', fontSize: '12px' }}>
                                    <div style={{ fontWeight: 600 }}>{seo.ogTitle || postTitle}</div>
                                    <div style={{ opacity: 0.6, marginTop: '2px' }}>{seo.ogDescription || seo.metaDescription}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TWITTER TAB ── */}
                {activeTab === 'twitter' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ fontSize: '12px', opacity: 0.6 }}>
                            Twitter card tags control how your post appears when shared on X (Twitter).
                        </div>
                        <div>
                            <label style={labelStyle}>Twitter title</label>
                            <input style={inputStyle} type="text" value={seo.twitterTitle}
                                onChange={e => set('twitterTitle', e.target.value)}
                                placeholder={seo.ogTitle || seo.metaTitle || postTitle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Twitter description</label>
                            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
                                value={seo.twitterDescription}
                                onChange={e => set('twitterDescription', e.target.value)}
                                placeholder={seo.ogDescription || seo.metaDescription || 'Description for Twitter'} />
                        </div>
                    </div>
                )}

                {/* ── SCHEMA TAB ── */}
                {activeTab === 'schema' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ fontSize: '12px', opacity: 0.6 }}>
                            Schema.org structured data helps Google understand your content and show rich results.
                        </div>
                        <div>
                            <label style={labelStyle}>Schema type</label>
                            <select style={inputStyle} value={seo.schemaType}
                                onChange={e => set('schemaType', e.target.value)}>
                                <option value="BlogPosting">BlogPosting (recommended for blog posts)</option>
                                <option value="Article">Article</option>
                                <option value="WebPage">WebPage</option>
                                <option value="FAQPage">FAQPage</option>
                                <option value="HowTo">HowTo</option>
                                <option value="Product">Product</option>
                                <option value="Person">Person</option>
                                <option value="Organization">Organization</option>
                            </select>
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <label style={{ ...labelStyle, marginBottom: 0 }}>Custom JSON-LD (optional — overrides auto-generated)</label>
                                <button
                                    type="button"
                                    onClick={generateSchemaJson}
                                    style={{
                                        fontSize: '12px', fontWeight: 600, color: '#fff', background: '#6c63ff',
                                        border: 'none', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer',
                                    }}
                                    title="Builds valid JSON-LD from your title, meta description, slug, and OG image — avoids hand-typing JSON that can break on save."
                                >
                                    ✨ Auto-generate
                                </button>
                            </div>
                            <p style={{ fontSize: '11px', opacity: 0.55, margin: '0 0 8px' }}>
                                Leave this empty to use the auto-generated schema automatically, or click Auto-generate to
                                fill it in from your post's title/description/slug — safer than typing JSON by hand, which
                                can break the page if a comma or quote is missing.
                            </p>
                            <textarea style={{ ...inputStyle, height: '140px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                                value={seo.schemaJson}
                                onChange={e => set('schemaJson', e.target.value)}
                                placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "${seo.schemaType}",\n  "headline": "${postTitle}"\n}`} />
                            {seo.schemaJson.trim() && (() => {
                                try {
                                    JSON.parse(seo.schemaJson);
                                    return <p style={{ fontSize: '11px', color: '#27ae60', margin: '6px 0 0' }}>✓ Valid JSON</p>;
                                } catch {
                                    return (
                                        <p style={{ fontSize: '11px', color: '#e74c3c', margin: '6px 0 0' }}>
                                            ✗ This isn't valid JSON and will break the page when published. Click Auto-generate to replace it with a valid version.
                                        </p>
                                    );
                                }
                            })()}
                            {!seo.schemaJson.trim() && (
                                <p style={{ fontSize: '11px', color: '#27ae60', margin: '6px 0 0', lineHeight: 1.5 }}>
                                    ✓ Auto-generated schema is active (BlogPosting + BreadcrumbList) and rendered on the
                                    published page — this box is empty on purpose. Leave it empty to keep the automatic
                                    schema, or paste custom JSON-LD above only if you want to override it.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── SCORE / CHECKLIST TAB ── */}
                {activeTab === 'score' && (
                    <div>
                        {/* Overall score */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%',
                                border: `4px solid ${scoreColor(score)}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '16px', fontWeight: 700, color: scoreColor(score),
                            }}>
                                {score}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                    {score >= 75 ? 'Good SEO' : score >= 40 ? 'Needs improvement' : 'Poor SEO'}
                                </div>
                                <div style={{ fontSize: '12px', opacity: 0.6 }}>
                                    {passedCount} of {evaluatedChecks.length} checks passed
                                </div>
                            </div>
                        </div>

                        {/* Category breakdown */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {categories.map(cat => (
                                <div key={cat.category}>
                                    {/* Category header with mini-score */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        marginBottom: '8px',
                                    }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700 }}>
                                            {cat.label}
                                            <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: '8px', fontSize: '12px' }}>
                                                {cat.passed}/{cat.total}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            minWidth: '40px', height: '22px', borderRadius: '11px', padding: '0 8px',
                                            fontSize: '11px', fontWeight: 700,
                                            color: scoreColor(cat.score),
                                            border: `1px solid ${scoreColor(cat.score)}`,
                                        }}>
                                            {cat.score}%
                                        </div>
                                    </div>

                                    {/* Checks within category */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {cat.checks.map((check, i) => {
                                            const v = statusVisual(check.status);
                                            return (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                                padding: '8px 10px',
                                                background: v.bg,
                                                borderRadius: '6px',
                                                borderLeft: `3px solid ${v.color}`,
                                            }}>
                                                <span style={{ fontSize: '14px', marginTop: '1px', color: v.color }}>{v.icon}</span>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{check.label}</div>
                                                    {check.status !== 'pass' && (
                                                        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>{check.info}</div>
                                                    )}
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
