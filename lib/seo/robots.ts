/**
 * lib/seo/robots.ts — one place that builds the per-page robots directives.
 *
 * The blog layout asks for `max-image-preview: large` (plus unlimited snippet
 * and video preview), but Next's Metadata merge REPLACES `robots` wholesale:
 * a page returning `robots: { index, follow }` wiped those directives, so every
 * post and page shipped a bare `<meta name="robots" content="index, follow">`.
 *
 * Why that matters for images:
 *   • Google search shows only a small thumbnail without max-image-preview:large.
 *   • Google Discover — which is what fills Chrome's "recommended articles" on
 *     the new-tab page for mobile — will not feature an article at all unless
 *     the page opts in with max-image-preview:large.
 *   • Bing reads the same directive.
 *
 * The directives go on BOTH the generic `robots` meta (Bing, others) and the
 * `googleBot` one, which is how Next emits them.
 *
 * NOTE: the directive is only half of it — Google Discover also requires the
 * image itself to be at least 1200px wide. A 640px cover opts in but still
 * won't qualify for a large preview.
 */

import type { Metadata } from 'next';

export function robotsMeta(index = true, follow = true): Metadata['robots'] {
    const directives = {
        index,
        follow,
        'max-image-preview': 'large' as const,
        'max-snippet': -1,
        'max-video-preview': -1,
    };
    return { ...directives, googleBot: { ...directives } };
}

export default robotsMeta;
