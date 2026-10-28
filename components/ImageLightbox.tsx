'use client';

/**
 * ImageLightbox.tsx
 *
 * Renders nothing visible. On mount it makes every CONTENT image clickable:
 * tap/click (or Enter/Space when focused) opens the image full-screen over a
 * dimmed backdrop, scaled to fit any viewport. Close with the ✕, Esc, or by
 * tapping the backdrop.
 *
 * Scope: only `img[data-zoomable="1"]` — the flag that enhanceContentImages()
 * adds to editor-authored article HTML. Avatars, post-card thumbnails and other
 * UI images are never touched, and an image that's already wrapped in a link
 * keeps its link behaviour.
 *
 * Works with dangerouslySetInnerHTML content (where React can't attach
 * handlers) and re-scans via MutationObserver for content that arrives later.
 */

import { useEffect } from 'react';

const SELECTOR = 'img[data-zoomable="1"]';

export default function ImageLightbox() {
    useEffect(() => {
        const cleanups: Array<() => void> = [];
        let overlay: HTMLElement | null = null;
        let lastFocused: HTMLElement | null = null;

        const close = () => {
            if (!overlay) return;
            overlay.remove();
            overlay = null;
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onKeydown);
            lastFocused?.focus?.();
        };

        function onKeydown(e: KeyboardEvent) {
            if (e.key === 'Escape') close();
        }

        const open = (img: HTMLImageElement) => {
            close();
            lastFocused = img;

            overlay = document.createElement('div');
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', img.alt || 'Image preview');
            overlay.style.cssText = [
                'position:fixed', 'inset:0', 'z-index:9999',
                'background:rgba(6,8,15,0.92)', 'backdrop-filter:blur(2px)',
                'display:flex', 'flex-direction:column',
                'align-items:center', 'justify-content:center',
                'gap:12px', 'padding:16px', 'cursor:zoom-out',
                'overscroll-behavior:contain',
            ].join(';');

            const full = document.createElement('img');
            full.src = img.currentSrc || img.src;
            full.alt = img.alt || '';
            // Fits any screen — portrait phones included — without cropping.
            full.style.cssText = [
                'max-width:min(96vw,1400px)', 'max-height:82vh',
                'width:auto', 'height:auto', 'object-fit:contain',
                'border-radius:10px', 'cursor:default',
                'box-shadow:0 18px 60px rgba(0,0,0,0.55)',
            ].join(';');
            full.addEventListener('click', (e) => e.stopPropagation());

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.textContent = '✕';
            closeBtn.setAttribute('aria-label', 'Close image');
            closeBtn.style.cssText = [
                'position:absolute', 'top:14px', 'right:14px',
                'width:40px', 'height:40px', 'border-radius:50%',
                'background:rgba(255,255,255,0.14)', 'color:#fff',
                'border:1px solid rgba(255,255,255,0.3)',
                'font-size:17px', 'line-height:1', 'cursor:pointer',
            ].join(';');
            closeBtn.addEventListener('click', close);

            overlay.appendChild(full);

            // The alt text doubles as a caption — useful, and it nudges authors
            // to keep writing real alt text (which is what Google reads).
            if (img.alt) {
                const cap = document.createElement('p');
                cap.textContent = img.alt;
                cap.style.cssText = [
                    'margin:0', 'max-width:min(96vw,1000px)', 'text-align:center',
                    'color:#cbd5e1', 'font-size:13px', 'line-height:1.5', 'cursor:default',
                ].join(';');
                cap.addEventListener('click', (e) => e.stopPropagation());
                overlay.appendChild(cap);
            }

            overlay.appendChild(closeBtn);
            overlay.addEventListener('click', close);

            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';   // no scrolling behind it
            document.addEventListener('keydown', onKeydown);
            closeBtn.focus();
        };

        const decorate = (img: HTMLImageElement) => {
            if (img.dataset.zoomReady === '1') return;
            // Already a link (e.g. the author linked the image) — leave it alone.
            if (img.closest('a')) return;
            img.dataset.zoomReady = '1';

            img.style.cursor = 'zoom-in';
            img.setAttribute('role', 'button');
            img.setAttribute('tabindex', '0');
            img.setAttribute('aria-label', img.alt ? `View larger: ${img.alt}` : 'View larger image');

            const onClick = () => open(img);
            const onKey = (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
            };
            img.addEventListener('click', onClick);
            img.addEventListener('keydown', onKey);

            cleanups.push(() => {
                img.removeEventListener('click', onClick);
                img.removeEventListener('keydown', onKey);
                img.style.cursor = '';
                img.removeAttribute('role');
                img.removeAttribute('tabindex');
                img.removeAttribute('aria-label');
                delete img.dataset.zoomReady;
            });
        };

        const scan = () => {
            document.querySelectorAll<HTMLImageElement>(SELECTOR).forEach(decorate);
        };

        scan();

        // Content rendered after mount still becomes zoomable. Coalesced into a
        // single frame so a busy page doesn't re-scan on every mutation.
        let queued = false;
        const observer = new MutationObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; scan(); });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            close();
            cleanups.forEach((fn) => fn());
        };
    }, []);

    return null;
}
