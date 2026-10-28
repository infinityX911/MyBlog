/**
 * components/SafeHtml.tsx — XSS-safe render sink for CMS HTML.
 * Sanitizes again at read time (defense in depth) before dangerouslySetInnerHTML.
 * Server Component → sanitizer runs during SSR, browser never sees raw markup.
 */
import sanitizeHtml from 'sanitize-html';
import { enhanceContentImages } from '@/lib/contentHtml';

const READ_POLICY: sanitizeHtml.IOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
        'ul', 'ol', 'li', 'strong', 'em', 'u', 's', 'a', 'img', 'iframe', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
    ],
    allowedAttributes: {
        a: ['href', 'title', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'style'],
        iframe: ['src', 'title', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'loading'],
        '*': ['class', 'style'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { iframe: ['https'] },
    // Video embeds only — iframe host is locked to YouTube/Vimeo.
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com', 'player.vimeo.com'],
};

export default function SafeHtml({ html, className }: { html: string; className?: string }) {
    // Sanitize first, THEN add loading/decoding/data-zoomable — doing it in this
    // order means the enhancement can't be stripped by the sanitizer's allowlist.
    const clean = enhanceContentImages(sanitizeHtml(html, READ_POLICY));
    return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
