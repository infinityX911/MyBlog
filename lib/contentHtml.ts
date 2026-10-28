/**
 * lib/contentHtml.ts
 *
 * Post-process stored post HTML before rendering.
 *
 * sanitizePostHtml(): the security-critical one. The post body comes from the
 *   rich-text editor and is rendered with dangerouslySetInnerHTML, so without
 *   sanitizing it a post author (or anyone who compromises an author account)
 *   could store <script>, onerror=, javascript: URLs, <iframe>, etc. and run
 *   code in every visitor's browser — a stored XSS. We run the HTML through
 *   sanitize-html with an allowlist that keeps all normal blog formatting
 *   (headings, lists, links, images, code blocks, tables) while stripping
 *   anything executable. Applied BOTH on write (so the DB never holds a
 *   payload) and on render (so already-stored content is cleaned too).
 *
 * addExternalLinkAttrs(): finds <a> tags pointing to OTHER domains and adds
 *   rel="nofollow noopener noreferrer" + target="_blank". Internal links
 *   (relative, anchors, or same-host) are left untouched so internal link
 *   equity still flows. This is the standard SEO + security treatment for
 *   outbound links.
 */

import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr', 'blockquote', 'pre', 'code',
        'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'mark', 'sub', 'sup', 'small',
        'ul', 'ol', 'li',
        'a', 'img', 'iframe', 'figure', 'figcaption',
        'span', 'div',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    ],
    allowedAttributes: {
        a: ['href', 'name', 'target', 'rel', 'title'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
        // Video embeds. Host is locked to YouTube/Vimeo via allowedIframeHostnames
        // below, so this can't be used to embed arbitrary/hostile origins.
        iframe: ['src', 'title', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'loading'],
        // class is needed for syntax highlighting + the editor's styling hooks.
        // style is allowed but tightly restricted by allowedStyles below.
        '*': ['class', 'style'],
        th: ['colspan', 'rowspan', 'scope'],
        td: ['colspan', 'rowspan'],
        col: ['span'],
        ol: ['start', 'type'],
    },
    // Only these CSS properties survive — everything else (position,
    // background-image:url(), etc.) is stripped, so allowing `style` is safe.
    // Enables editor features: text colour, highlight, alignment, image width.
    allowedStyles: {
        '*': {
            color: [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/, /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/, /^[a-zA-Z]+$/],
            'background-color': [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/, /^rgba\(/, /^[a-zA-Z]+$/],
            'text-align': [/^(left|right|center|justify)$/],
            width: [/^\d{1,3}(\.\d+)?%$/, /^\d{1,4}px$/],
        },
    },
    // Only safe URL schemes; this blocks javascript:, vbscript:, etc.
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'], iframe: ['https'] },
    // Iframes may ONLY embed these hosts — everything else is stripped. This is
    // what makes allowing <iframe> safe (no arbitrary-origin framing / clickjacking).
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com', 'player.vimeo.com'],
    allowProtocolRelative: false,
    // Drop the entire contents of these tags, not just the tags themselves.
    disallowedTagsMode: 'discard',
    nonBooleanAttributes: [],
    // <script>/<style> are not in allowedTags, so they're removed along with
    // their text content here (so raw JS/CSS text doesn't leak into the page).
    nonTextTags: ['script', 'style', 'textarea', 'noscript', 'object', 'embed'],
};

/** Remove any executable / unsafe HTML from editor-authored post content. */
export function sanitizePostHtml(html: string): string {
    if (!html) return html;
    return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * Diagnose editor output quality — returns true if the HTML has
 * real semantic tags (h2-h6, strong, ul, li, img, a) which indicates
 * the rich-text editor is producing proper HTML rather than div soup.
 * Use this in development to detect editor configuration problems early.
 * A post that returns false will score lower on SEO checkers even if it
 * looks correct in the editor preview.
 */
export function hasSemanticsHtml(html: string): boolean {
    if (!html) return false;
    return /<(h[2-6]|strong|b|ul|ol|li|img|a)[ >]/i.test(html);
}

/**
 * Prepare editor-authored <img> tags for the front-end.
 *
 * Runs AFTER sanitizing (so the added attributes aren't stripped again) and is
 * purely additive — an attribute the author already set always wins.
 *
 *   loading="lazy"      off-screen article images don't block the first paint;
 *                       this is the single biggest mobile/Core-Web-Vitals win
 *                       for image-heavy posts.
 *   decoding="async"    decode off the main thread, so a big screenshot can't
 *                       stall scrolling on a phone.
 *   data-zoomable="1"   marks CONTENT images (and only those) for the click-to-
 *                       zoom lightbox — avatars, post-card thumbs and other UI
 *                       images never get it, so nothing else becomes clickable.
 */
export function enhanceContentImages(html: string): string {
    if (!html) return html;
    return html.replace(/<img\b[^>]*>/gi, (tag) => {
        const m = tag.match(/^(<img\b[\s\S]*?)(\s*\/?>)$/i);
        if (!m) return tag;
        let head = m[1];
        const close = m[2].trim() === '/>' ? ' />' : '>';
        if (!/\sloading=/i.test(head)) head += ' loading="lazy"';
        if (!/\sdecoding=/i.test(head)) head += ' decoding="async"';
        if (!/\sdata-zoomable=/i.test(head)) head += ' data-zoomable="1"';
        return head + close;
    });
}

export function addExternalLinkAttrs(html: string, siteUrl: string): string {
    if (!html) return html;

    let host = '';
    try { host = new URL(siteUrl).host.toLowerCase(); } catch { /* ignore */ }

    return html.replace(/<a\b[^>]*>/gi, (tag) => {
        const hrefMatch = tag.match(/href=(["'])(.*?)\1/i);
        if (!hrefMatch) return tag;
        const href = hrefMatch[2].trim();

        // External = absolute http(s) URL to a different host.
        const isAbsolute = /^https?:\/\//i.test(href);
        if (!isAbsolute) return tag; // relative / anchor / mailto → internal
        let linkHost = '';
        try { linkHost = new URL(href).host.toLowerCase(); } catch { return tag; }
        if (host && linkHost === host) return tag; // same site

        let newTag = tag;
        if (!/\btarget=/i.test(newTag)) {
            newTag = newTag.replace(/\s*>$/, ' target="_blank">');
        }
        if (/\brel=/i.test(newTag)) {
            newTag = newTag.replace(/\brel=(["'])(.*?)\1/i, (_m, q, val) => {
                const vals = new Set(String(val).split(/\s+/).filter(Boolean));
                vals.add('nofollow'); vals.add('noopener'); vals.add('noreferrer');
                return `rel=${q}${[...vals].join(' ')}${q}`;
            });
        } else {
            newTag = newTag.replace(/\s*>$/, ' rel="nofollow noopener noreferrer">');
        }
        return newTag;
    });
}
