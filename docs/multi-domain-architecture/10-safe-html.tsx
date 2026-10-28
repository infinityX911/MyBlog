/**
 * 10-safe-html.tsx  →  deploy as  components/SafeHtml.tsx
 *
 * XSS-SAFE RENDERING of user-generated CMS markup.
 *
 * Threat model: CmsPage.content is authored in the admin panel — but "admin
 * authored" is NOT "trusted": an editor account can be phished, a future
 * lower-privilege "Author" role may gain page access, and stored XSS in an
 * admin-editable field is the classic privilege-escalation path (a planted
 * <script> then runs in a SUPER-admin's session).
 *
 * Defense in depth, three layers:
 *   1. WRITE:   sanitize-html allowlist at persistence time (file 09).
 *   2. READ:    sanitize AGAIN here before dangerouslySetInnerHTML — protects
 *               against rows written by older/other code paths, direct SQL,
 *               or a future bug in layer 1. sanitize-html runs fine in Server
 *               Components (Node), so the client ships zero sanitizer bytes
 *               and unsanitized markup never even reaches the browser.
 *   3. BROWSER: your CSP (next.config.ts) blocks inline event handlers' and
 *               foreign-origin scripts' impact if something ever slipped by.
 *
 * NEVER render CMS content with plain dangerouslySetInnerHTML anywhere else —
 * this component is the single sanctioned sink.
 */

import sanitizeHtml from 'sanitize-html';

// Keep the READ policy at least as strict as the WRITE policy (file 09).
// Centralize: move SANITIZE_OPTIONS into lib/sanitize-policy.ts and import it
// in both places so the two layers can't drift apart.
const READ_POLICY: sanitizeHtml.IOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
        'ul', 'ol', 'li', 'strong', 'em', 'u', 's', 'a', 'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
    ],
    allowedAttributes: {
        a: ['href', 'title', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
        '*': ['class'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
};

interface SafeHtmlProps {
    /** Stored (already write-sanitized) CMS HTML. */
    html: string;
    /** Optional wrapper class — e.g. "tw:prose" typography on the downloader. */
    className?: string;
}

/**
 * Server Component (no 'use client') — sanitization happens during SSR;
 * the browser only ever receives the clean markup.
 */
export default function SafeHtml({ html, className }: SafeHtmlProps) {
    const clean = sanitizeHtml(html, READ_POLICY);
    return (
        <div
            className={className}
            // Safe BY CONSTRUCTION: `clean` just passed the allowlist above.
            dangerouslySetInnerHTML={{ __html: clean }}
        />
    );
}
