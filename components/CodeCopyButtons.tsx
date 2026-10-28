'use client';

/**
 * CodeCopyButtons.tsx
 *
 * Renders nothing visible. On mount it scans the rendered content for <pre>
 * code blocks and injects a "Copy" button into each (top-right). Works with
 * content rendered via dangerouslySetInnerHTML, where React can't attach
 * handlers directly.
 *
 * Why the broad default selector: the old one was `#article-body pre`, but that
 * id only exists on a blog post's FIRST body chunk. So code blocks got no copy
 * button on:
 *   • CMS pages / tutorial hubs (SafeHtml + InlineBlocks, no such id),
 *   • download detail pages,
 *   • any post chunk after an inline ad (only chunk 0 carries the id).
 * Scanning the page's main content regions instead covers all of them. The
 * `data-copy-ready` flag keeps overlapping selectors from double-injecting.
 *
 * A MutationObserver re-scans when content arrives after mount (client-side
 * navigation inside the same layout, lazily rendered blocks, etc.).
 */

import { useEffect } from 'react';

const DEFAULT_SELECTOR = '#article-body pre, main pre, article pre';

export default function CodeCopyButtons({ selector = DEFAULT_SELECTOR }: { selector?: string }) {
    useEffect(() => {
        const cleanups: Array<() => void> = [];

        const decorate = (pre: HTMLElement) => {
            if (pre.dataset.copyReady === '1') return;
            pre.dataset.copyReady = '1';

            // Grab the code BEFORE the button is injected — otherwise a <pre>
            // without an inner <code> would copy the word "Copy" along with it.
            const source = (pre.querySelector('code')?.textContent ?? pre.textContent ?? '').replace(/\s+$/, '');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Copy';
            btn.className = 'code-copy-btn';
            btn.setAttribute('aria-label', 'Copy code to clipboard');
            // Solid dark chip so it stays readable on light AND dark code blocks
            // (the old translucent white one vanished on light themes).
            btn.style.cssText = [
                'position:absolute', 'top:8px', 'right:8px',
                'background:rgba(15,23,42,0.82)', 'color:#f8fafc',
                'border:1px solid rgba(148,163,184,0.45)', 'border-radius:6px',
                'padding:4px 10px', 'font-size:12px', 'font-weight:600',
                'font-family:inherit', 'cursor:pointer', 'z-index:2',
                'line-height:1.4', 'backdrop-filter:blur(4px)',
                'transition:background 0.15s,opacity 0.15s', 'opacity:0.85',
            ].join(';');
            btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
            btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.85'; });

            let resetTimer: ReturnType<typeof setTimeout> | undefined;
            const flash = (label: string) => {
                btn.textContent = label;
                if (resetTimer) clearTimeout(resetTimer);
                resetTimer = setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
            };

            const onClick = async () => {
                try {
                    await navigator.clipboard.writeText(source);
                    flash('Copied!');
                } catch {
                    // Fallback for non-secure contexts / older browsers.
                    const ta = document.createElement('textarea');
                    ta.value = source;
                    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
                    document.body.appendChild(ta);
                    ta.select();
                    try { document.execCommand('copy'); flash('Copied!'); } catch { flash('Press Ctrl+C'); }
                    document.body.removeChild(ta);
                }
            };

            btn.addEventListener('click', onClick);

            // The button goes on a WRAPPER, not inside the <pre>. Code blocks are
            // styled `overflow:auto; max-height:520px`, so a button parented to
            // the <pre> scrolls out of sight as soon as the reader scrolls the
            // code. The wrapper doesn't scroll, so the button stays pinned.
            const parent = pre.parentNode;
            let wrapper: HTMLElement | null = null;
            if (parent) {
                wrapper = document.createElement('div');
                wrapper.className = 'code-block-wrap';
                wrapper.style.position = 'relative';
                parent.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);
                wrapper.appendChild(btn);
            } else {
                // No parent to wrap with — fall back to the old in-<pre> button.
                if (getComputedStyle(pre).position === 'static') pre.style.position = 'relative';
                pre.appendChild(btn);
            }

            cleanups.push(() => {
                if (resetTimer) clearTimeout(resetTimer);
                btn.removeEventListener('click', onClick);
                btn.remove();
                // Unwrap so the DOM goes back to how the server rendered it.
                if (wrapper && wrapper.parentNode) {
                    wrapper.parentNode.insertBefore(pre, wrapper);
                    wrapper.remove();
                }
                delete pre.dataset.copyReady;
            });
        };

        const scan = () => {
            document.querySelectorAll<HTMLElement>(selector).forEach(decorate);
        };

        scan();

        // Content that shows up after mount still gets a button. Injecting the
        // button is itself a DOM mutation, but the data-copy-ready flag makes
        // the re-scan a no-op, so this can't loop. Coalesced into one frame so
        // a chatty page (comments loading, etc.) doesn't re-scan per mutation.
        let queued = false;
        const observer = new MutationObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; scan(); });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            cleanups.forEach((fn) => fn());
        };
    }, [selector]);

    return null;
}
