'use client';

/**
 * app/admin/(protected)/myprojects/blog/create/page.tsx
 * Add new blog post — Professional editor
 *
 * Bug fixes in this version:
 *  1. Scroll-jump on format change: the editor now saves the current
 *     selection Range on every click/keyup/mouseup, and restores it
 *     immediately before running any toolbar command. This removes the
 *     "page jumps to top, you have to scroll back down" behavior that
 *     happens when the browser collapses selection after a toolbar
 *     button steals focus.
 *  2. Paragraph dropdown not working for most options: switched away
 *     from relying purely on `execCommand('formatBlock', ...)`, which
 *     several browsers handle inconsistently for blockquote/pre and
 *     silently no-ops if the selection isn't exactly right. We now
 *     resolve the current block element ourselves and replace its tag,
 *     preserving inner content, which works reliably for all 6 options.
 *  3. Word/character count not calculating: added a live Yoast-style
 *     panel — word count, character count, sentence count, average
 *     sentence length, paragraph count, and a readability flag for
 *     sentences over 20 words (a standard Yoast heuristic).
 *  4. Image upload — see /api/upload-image route fixes + clearer
 *     client-side error surfacing so failures are visible, not silent.
 *  5. Mobile responsiveness — see admin.css responsive block for the
 *     blog editor card, toolbar, and image/alt panels.
 *
 * SEO panel / scoring (lib/seo/scoring.ts, SeoPanel.tsx) untouched —
 * same props, same data flow as before.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import SeoPanel, { emptySeo, SeoData } from '@/components/admin/blog/SeoPanel';
import PostEditor from '@/components/admin/PostEditor';
import FeaturedVisual from '@/components/admin/FeaturedVisual';
import { ScheduleField, defaultScheduleLocal, localInputToIso, type PublishStatus } from '@/components/admin/PublishSchedule';

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

type Category = { id: number; name: string; slug: string };
type VisionProvider = 'openai' | 'google';
type UploadMode = 'url' | 'local' | 'cloud';
type BlockTag = 'p' | 'h1' | 'h2' | 'h3' | 'blockquote' | 'pre';

const BLOCK_OPTIONS: { label: string; value: BlockTag }[] = [
    { label: 'Paragraph', value: 'p' },
    { label: 'Heading 1', value: 'h1' },
    { label: 'Heading 2', value: 'h2' },
    { label: 'Heading 3', value: 'h3' },
    { label: 'Quote', value: 'blockquote' },
    { label: 'Code Block', value: 'pre' },
];

const INLINE_BUTTONS: { label: string; cmd: string; title: string; cls?: string }[] = [
    { label: 'B', cmd: 'bold', title: 'Bold (Ctrl+B)', cls: 'blog-toolbar-btn-bold' },
    { label: 'I', cmd: 'italic', title: 'Italic (Ctrl+I)', cls: 'blog-toolbar-btn-italic' },
    { label: 'U', cmd: 'underline', title: 'Underline (Ctrl+U)', cls: 'blog-toolbar-btn-underline' },
    { label: 'S', cmd: 'strikeThrough', title: 'Strikethrough', cls: 'blog-toolbar-btn-strike' },
];

type ImageIssue = {
    src: string;
    missingAlt: boolean;
    missingKeyword: boolean;
    notNextGen: boolean;
};

type ContentStats = {
    words: number;
    characters: number;
    charactersNoSpaces: number;
    sentences: number;
    paragraphs: number;
    avgSentenceLength: number;
    longSentences: number; // sentences over 20 words — Yoast readability flag
    readMinutes: number;
    readability: number; // 0-100 Flesch score, same formula as lib/seo/scoring.ts
};

function computeStats(html: string): ContentStats {
    if (!html) {
        return { words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0, paragraphs: 0, avgSentenceLength: 0, longSentences: 0, readMinutes: 1, readability: 0 };
    }
    // IMPORTANT: this must match lib/seo/scoring.ts's stripHtml() exactly,
    // otherwise the editor's word count and the SEO panel's word count
    // disagree (this was bug: editor showed 134 words, SEO panel showed 142).
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;

    // Sentence split: break on . ! ? followed by space/end.
    // Technical posts often contain filenames like "page.js", "layout.js",
    // "tailwind.config.js" — the dot in these is part of a filename, not a
    // sentence boundary, but a naive split treats every "." as one. We
    // temporarily replace dots inside common code-file extensions with a
    // placeholder before splitting, then restore them — this alone fixed
    // a post going from a true ~19 sentences to an inflated 26.
    const CODE_EXT_PLACEHOLDER = '\u0000DOT\u0000';
    const maskedText = text.replace(
        /\.(js|jsx|ts|tsx|json|css|scss|html|md|mjs|cjs|env|yml|yaml|config)\b/gi,
        (_, ext) => `${CODE_EXT_PLACEHOLDER}${ext}`
    );
    const sentenceMatches = (maskedText.match(/[^.!?]+[.!?]+/g) || (maskedText ? [maskedText] : []))
        .map(s => s.replace(new RegExp(CODE_EXT_PLACEHOLDER, 'g'), '.'));
    const sentences = sentenceMatches.length;
    const longSentences = sentenceMatches.filter(s => s.trim().split(/\s+/).filter(Boolean).length > 20).length;

    // Paragraph count still needs real DOM parsing (stripHtml alone can't
    // tell block boundaries apart) — only used for the editor's own stats
    // display, not fed into the SEO score, so it doesn't need to match scoring.ts.
    // Paragraph count: count non-empty block segments separated by double
    // whitespace/newlines. This works whether the browser wrapped pasted
    // content in <p> tags, <div> tags, or bare text nodes — all of which
    // produce the same stripped text. The old DOMParser querySelectorAll
    // approach returned 0 whenever content was plain-text pasted because
    // browsers don't always wrap paste content in <p> tags.
    const paragraphs = html
        .replace(/<\/(p|h[1-6]|blockquote|pre|li|div)>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .split(/\n+/)
        .filter(s => s.trim().length > 0).length;

    const avgSentenceLength = sentences > 0 ? Math.round(words / sentences) : 0;
    const readMinutes = Math.max(1, Math.ceil(words / 200));

    // Readability is computed as a fully separate pass that mirrors
    // lib/seo/scoring.ts's readabilityScore() line-for-line — including
    // its own sentence-splitting regex and per-word length sum — rather
    // than reusing the Yoast-style `sentences`/`avgSentenceLength` above
    // (which use a different regex for the "long sentence" warning).
    // Reusing those caused a 1-point drift (96 vs 95) because the two
    // sentence-counting methods don't always agree at boundary cases.
    let readability = 0;
    {
        const scoringSentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
        const scoringWords = text.trim().split(/\s+/).filter(Boolean);
        if (scoringSentences.length > 0 && scoringWords.length > 0) {
            const avgSentLen = scoringWords.length / scoringSentences.length;
            const avgWordLen = scoringWords.reduce((a, w) => a + w.length, 0) / scoringWords.length;
            const score = Math.max(0, Math.min(100, 206.835 - 1.015 * avgSentLen - 84.6 * (avgWordLen / 5)));
            readability = Math.round(score);
        }
    }

    return { words, characters, charactersNoSpaces, sentences, paragraphs, avgSentenceLength, longSentences, readMinutes, readability };
}

function AddPost() {
    const router = useRouter();
    const { data: session } = useSession();
    const editorRef = useRef<HTMLDivElement>(null);
    const linkInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Persisted selection range — the fix for the "scroll jumps / loses
    // your place" bug. Updated continuously, restored before any command.
    const savedRangeRef = useRef<Range | null>(null);

    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [featuredImage, setFeaturedImage] = useState('');
    const [gradient, setGradient] = useState('gradientPurple');
    const [status, setStatus] = useState<PublishStatus>('draft');
    const [scheduledLocal, setScheduledLocal] = useState('');
    const [seo, setSeo] = useState<SeoData>(emptySeo());
    const [saving, setSaving] = useState(false);

    const [content, setContent] = useState('');
    const [stats, setStats] = useState<ContentStats>(computeStats(''));
    const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
    const [currentBlock, setCurrentBlock] = useState<BlockTag>('p');
    const [linkUrl, setLinkUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);

    // ── Image upload state ──────────────────────────────────────────
    const [showImagePanel, setShowImagePanel] = useState(false);
    const [uploadMode, setUploadMode] = useState<UploadMode>('url');
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [visionProvider, setVisionProvider] = useState<VisionProvider>('openai');
    const [generatingAlt, setGeneratingAlt] = useState(false);
    const [lastInsertedImg, setLastInsertedImg] = useState<HTMLImageElement | null>(null);
    const [imgWidthPercent, setImgWidthPercent] = useState(100);
    const [altDraft, setAltDraft] = useState('');
    const [imageIssues, setImageIssues] = useState<ImageIssue[]>([]);

    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [primaryCategoryId, setPrimaryCategoryId] = useState<number | null>(null);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    // Site settings from DB — for SeoPanel schema generator
    // (publisher name + canonical base URL — avoids "Admin Panel" / localhost)
    const [siteName, setSiteName] = useState('');
    const [siteUrl, setSiteUrl] = useState('');

    useEffect(() => {
        // Fetch categories
        fetch('/api/categories')
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => setCategories(Array.isArray(data) ? data : []))
            .catch(err => console.error('Error fetching categories:', err))
            .finally(() => setCategoriesLoading(false));

        // Fetch site settings for SeoPanel (publisher name + canonical base URL)
        fetch('/api/settings')
            .then(r => r.ok ? r.json() : [])
            .then((all: any[]) => {
                const blog = all.find((s: any) => s.siteKey === 'blog');
                if (blog) {
                    setSiteName(blog.siteName ?? '');
                    setSiteUrl(blog.websiteUrl ?? '');
                }
            })
            .catch(() => { /* site settings are optional — schema falls back gracefully */ });
    }, []);

    // ── Selection persistence (fix #1: scroll-jump / lost cursor) ────
    const saveSelection = useCallback(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
            savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        }
    }, []);

    const restoreSelection = useCallback((): Selection | null => {
        const sel = window.getSelection();
        if (sel && savedRangeRef.current) {
            sel.removeAllRanges();
            sel.addRange(savedRangeRef.current);
        }
        return sel;
    }, []);

    // Find the nearest block-level ancestor of the current selection,
    // bounded by the editor root.
    const getCurrentBlockElement = useCallback((): HTMLElement | null => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !editorRef.current) return null;
        let node: Node | null = sel.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'LI', 'DIV']);
        while (node && node !== editorRef.current) {
            if (node instanceof HTMLElement && blockTags.has(node.tagName)) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }, []);

    const updateToolbarState = useCallback(() => {
        const formats = new Set<string>();
        try {
            if (document.queryCommandState('bold')) formats.add('bold');
            if (document.queryCommandState('italic')) formats.add('italic');
            if (document.queryCommandState('underline')) formats.add('underline');
            if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
        } catch { /* outside editable region — ignore */ }
        setActiveFormats(formats);

        const block = getCurrentBlockElement();
        const tag = block?.tagName.toLowerCase();
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'blockquote' || tag === 'pre') {
            setCurrentBlock(tag as BlockTag);
        } else {
            setCurrentBlock('p');
        }
    }, [getCurrentBlockElement]);

    // ── Image SEO check — scans current content for issues ─────────
    const scanImageIssues = useCallback((html: string, focusKeyword: string) => {
        if (typeof window === 'undefined') return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const imgs = Array.from(doc.querySelectorAll('img'));
        const kw = focusKeyword.trim().toLowerCase();

        const issues: ImageIssue[] = imgs.map(img => {
            const alt = (img.getAttribute('alt') ?? '').trim();
            const src = img.getAttribute('src') ?? '';
            const isNextGen = /\.(webp|avif)(\?|$)/i.test(src) || (src.includes('cloudinary') && src.includes('f_webp'));
            return {
                src,
                missingAlt: alt.length === 0,
                missingKeyword: kw.length > 0 && alt.length > 0 && !alt.toLowerCase().includes(kw),
                notNextGen: !isNextGen,
            };
        });
        setImageIssues(issues);
    }, []);

    const handleEditorInput = useCallback(() => {
        const html = editorRef.current?.innerHTML ?? '';
        setContent(html);
        setStats(computeStats(html));
        updateToolbarState();
        scanImageIssues(html, seo.focusKeyword);
        saveSelection();
    }, [updateToolbarState, scanImageIssues, saveSelection, seo.focusKeyword]);

    // Re-scan whenever the focus keyword changes (without needing new input)
    useEffect(() => {
        scanImageIssues(editorRef.current?.innerHTML ?? '', seo.focusKeyword);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seo.focusKeyword]);

    useEffect(() => {
        const handler = () => {
            // Only track selection changes that are actually inside the editor,
            // otherwise clicking a toolbar button would wipe out the saved range.
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
                updateToolbarState();
                saveSelection();
            }
        };
        document.addEventListener('selectionchange', handler);
        return () => document.removeEventListener('selectionchange', handler);
    }, [updateToolbarState, saveSelection]);

    // ── Toolbar command runner (fix #1 + #2) ──────────────────────────
    // Always restores the saved selection BEFORE running a command, so the
    // browser never falls back to "wherever focus happens to be" (which is
    // what causes the jump-to-top / lose-your-place behavior).
    const runInlineCommand = (cmd: string) => {
        editorRef.current?.focus();
        restoreSelection();
        document.execCommand(cmd, false);
        handleEditorInput();
    };

    // Block-level formatting done manually instead of relying on
    // execCommand('formatBlock', ...), which is inconsistent across
    // browsers for blockquote/pre and frequently no-ops. We resolve the
    // current block ourselves and swap its tag, preserving content.
    // Returns every top-level block element that the current selection
    // touches, in document order. Fix for bug #3: the old version only
    // looked at the selection's startContainer, so selecting multiple
    // paragraphs and choosing "Quote"/"Heading"/"Code" only converted the
    // first one — the rest were silently left unchanged.
    const getSelectedBlockElements = useCallback((): HTMLElement[] => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !editorRef.current) return [];
        const range = sel.getRangeAt(0);
        const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'LI']);

        const resolveBlock = (node: Node | null): HTMLElement | null => {
            if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            while (node && node !== editorRef.current) {
                if (node instanceof HTMLElement && blockTags.has(node.tagName)) return node;
                node = node.parentElement;
            }
            return null;
        };

        // Collapsed selection (just a caret) — only one block is relevant.
        if (range.collapsed) {
            const block = resolveBlock(range.startContainer);
            return block ? [block] : [];
        }

        // Walk every direct child block of the editor and keep the ones
        // that intersect the selection range.
        const candidates = Array.from(editorRef.current.querySelectorAll('p, h1, h2, h3, blockquote, pre, li')) as HTMLElement[];
        const touched = candidates.filter(el => range.intersectsNode(el));

        if (touched.length > 0) return touched;

        // Fallback: selection didn't land cleanly on any known block
        // (e.g. editor has loose text nodes with no wrapping tag yet).
        const startBlock = resolveBlock(range.startContainer);
        return startBlock ? [startBlock] : [];
    }, []);

    const applyBlockFormat = (tag: BlockTag) => {
        editorRef.current?.focus();
        restoreSelection();

        const blocks = getSelectedBlockElements();

        // ── Code block: MERGE the whole selection into ONE <pre> ──────────────
        // Previously each selected line became its own <pre> (or execCommand
        // flattened them losing newlines). We build the code text from the
        // SELECTION itself — converting <br> and every block boundary (incl.
        // the <div>s contentEditable wraps pasted lines in) into real newlines —
        // then replace the selection with a single <pre>.
        if (tag === 'pre') {
            const sel = window.getSelection();
            if (sel && sel.rangeCount && !sel.getRangeAt(0).collapsed) {
                const range = sel.getRangeAt(0);
                const holder = document.createElement('div');
                holder.appendChild(range.cloneContents());
                holder.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
                holder.querySelectorAll('p,div,li,h1,h2,h3,h4,blockquote,pre,tr').forEach(el => el.appendChild(document.createTextNode('\n')));
                const code = (holder.textContent || '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
                const pre = document.createElement('pre');
                pre.textContent = code.length ? code : '\n';
                range.deleteContents();
                range.insertNode(pre);

                const r = document.createRange();
                r.selectNodeContents(pre);
                r.collapse(false);
                sel.removeAllRanges();
                sel.addRange(r);
                savedRangeRef.current = r.cloneRange();
                handleEditorInput();
                return;
            }
            // collapsed caret → fall through to single-block conversion below
        }

        if (blocks.length > 0) {
            let lastNewEl: HTMLElement | null = null;
            for (const block of blocks) {
                if (!editorRef.current?.contains(block)) continue;
                const newEl = document.createElement(tag);
                newEl.innerHTML = block.innerHTML || '<br>';
                block.replaceWith(newEl);
                lastNewEl = newEl;
            }

            // Move caret to the end of the last converted block.
            if (lastNewEl) {
                const range = document.createRange();
                range.selectNodeContents(lastNewEl);
                range.collapse(false);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                savedRangeRef.current = range.cloneRange();
            }
        } else {
            // No identifiable block (e.g. caret directly in editor root) —
            // wrap current selection/insert a fresh block as a fallback.
            document.execCommand('formatBlock', false, tag);
        }

        handleEditorInput();
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // ── Code block (PRE) Enter handling ──────────────────────────────
        // Inside a code block: Enter inserts a real newline; pressing Enter on
        // an EMPTY line exits the block into a fresh paragraph below — so you
        // never get "trapped" inside the code block. Shift+Enter always newline.
        if (e.key === 'Enter' && !e.shiftKey) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount && editorRef.current) {
                let n: Node | null = sel.anchorNode;
                let pre: HTMLElement | null = null;
                while (n && n !== editorRef.current) {
                    if (n instanceof HTMLElement && n.tagName === 'PRE') { pre = n; break; }
                    n = n.parentNode;
                }
                if (pre) {
                    e.preventDefault();
                    const range = sel.getRangeAt(0);
                    const pr = range.cloneRange();
                    pr.selectNodeContents(pre);
                    pr.setEnd(range.endContainer, range.endOffset);
                    const before = pr.toString();

                    if (before.endsWith('\n')) {
                        // Empty line → leave the code block.
                        const node = range.endContainer;
                        if (node.nodeType === Node.TEXT_NODE && range.endOffset > 0 &&
                            node.textContent && node.textContent[range.endOffset - 1] === '\n') {
                            node.textContent = node.textContent.slice(0, range.endOffset - 1) +
                                node.textContent.slice(range.endOffset);
                        }
                        const p = document.createElement('p');
                        p.innerHTML = '<br>';
                        pre.after(p);
                        const r = document.createRange();
                        r.setStart(p, 0);
                        r.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(r);
                        savedRangeRef.current = r.cloneRange();
                    } else {
                        // Insert a real newline inside the code block.
                        const nl = document.createTextNode('\n');
                        range.deleteContents();
                        range.insertNode(nl);
                        range.setStartAfter(nl);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        savedRangeRef.current = range.cloneRange();
                    }
                    handleEditorInput();
                    return;
                }
            }
        }

        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b': e.preventDefault(); runInlineCommand('bold'); break;
                case 'i': e.preventDefault(); runInlineCommand('italic'); break;
                case 'u': e.preventDefault(); runInlineCommand('underline'); break;
                case 'k': e.preventDefault(); saveSelection(); setShowLinkInput(v => !v); break;
            }
        }
    }, [saveSelection, handleEditorInput]);

    // ── Text colour ──────────────────────────────────────────────────
    // styleWithCSS makes execCommand emit <span style="color:…"> instead of
    // the deprecated <font> tag (which our sanitizer would strip anyway).
    const applyColor = (color: string) => {
        editorRef.current?.focus();
        restoreSelection();
        try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* ignore */ }
        document.execCommand('foreColor', false, color);
        handleEditorInput();
    };

    // ── Insert a starter table (editable in place) ───────────────────
    const insertTable = (rows = 3, cols = 3) => {
        editorRef.current?.focus();
        restoreSelection();
        let html = '<table><thead><tr>';
        for (let c = 0; c < cols; c++) html += `<th>Heading ${c + 1}</th>`;
        html += '</tr></thead><tbody>';
        for (let r = 0; r < rows - 1; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) html += '<td>Cell</td>';
            html += '</tr>';
        }
        html += '</tbody></table><p><br></p>';
        document.execCommand('insertHTML', false, html);
        handleEditorInput();
    };

    const insertLink = () => {
        editorRef.current?.focus();
        restoreSelection();
        if (linkUrl.trim()) {
            const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
            document.execCommand('createLink', false, url);
        }
        setLinkUrl('');
        setShowLinkInput(false);
        handleEditorInput();
    };

    // ── Insert an <img> into the editor at the saved cursor position ──
    const insertImageIntoEditor = (url: string) => {
        editorRef.current?.focus();
        restoreSelection();

        const img = document.createElement('img');
        img.src = url;
        img.alt = ''; // intentionally empty — filled by generator or manually
        img.loading = 'lazy';
        img.style.width = '100%'; // default to full editor width, adjustable via the scale slider below

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.setStartAfter(img);
            range.setEndAfter(img);
            sel.removeAllRanges();
            sel.addRange(range);
            savedRangeRef.current = range.cloneRange();
        } else {
            editorRef.current?.appendChild(img);
        }

        setLastInsertedImg(img);
        setAltDraft('');
        setImgWidthPercent(100);
        handleEditorInput();
    };

    // ── Upload handlers ─────────────────────────────────────────────
    const handleUrlInsert = () => {
        if (!imageUrlInput.trim()) return;
        insertImageIntoEditor(imageUrlInput.trim());
        setImageUrlInput('');
        setUploadError('');
    };

    const uploadFile = async (file: File, mode: 'local' | 'cloud') => {
        setUploading(true);
        setUploadError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mode', mode); // informational; server picks backend from UPLOAD_PROVIDER env
            const res = await fetch('/api/upload-image', { method: 'POST', body: formData });

            let data: any = null;
            try {
                data = await res.json();
            } catch {
                throw new Error(`Server returned a non-JSON response (HTTP ${res.status}). Check the server terminal for the real error.`);
            }

            if (!res.ok) {
                throw new Error(data?.error ?? `Upload failed (HTTP ${res.status})`);
            }
            if (!data?.url) {
                throw new Error('Upload succeeded but no file URL was returned.');
            }
            insertImageIntoEditor(data.url);
        } catch (err: any) {
            setUploadError(err.message ?? 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        uploadFile(file, uploadMode === 'cloud' ? 'cloud' : 'local');
        e.target.value = ''; // allow re-selecting the same file later
    };

    // ── Alt-text generation ──────────────────────────────────────────
    const generateAltText = async () => {
        if (!lastInsertedImg) return;
        setGeneratingAlt(true);
        setUploadError('');
        try {
            const res = await fetch('/api/generate-alt-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: lastInsertedImg.src,
                    provider: visionProvider,
                    focusKeyword: seo.focusKeyword,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? 'Alt-text generation failed.');
            setAltDraft(data.altText);
            lastInsertedImg.alt = data.altText;
            handleEditorInput();
        } catch (err: any) {
            setUploadError(err.message ?? 'Alt-text generation failed.');
        } finally {
            setGeneratingAlt(false);
        }
    };

    const applyAltDraft = () => {
        if (lastInsertedImg) {
            lastInsertedImg.alt = altDraft;
            handleEditorInput();
        }
    };

    // Fix #4 (part 2): scale control for the inserted image. Sets a
    // percentage width directly on the <img> so the post author can
    // shrink large images instead of having them forced to 100%.
    const handleImgWidthChange = (percent: number) => {
        setImgWidthPercent(percent);
        if (lastInsertedImg) {
            lastInsertedImg.style.width = `${percent}%`;
            handleEditorInput();
        }
    };

    const toggleCategory = (id: number) => {
        setSelectedCategoryIds(prev => {
            const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
            // Keep the primary category valid: default to the first selected.
            setPrimaryCategoryId(p => (p && next.includes(p)) ? p : (next[0] ?? null));
            return next;
        });
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        setSlug(toSlug(newTitle));
    };

    const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (!seo.metaTitle && e.target.value.trim()) {
            setSeo(prev => ({ ...prev, metaTitle: e.target.value.trim() }));
        }
    };

    async function handleSubmit() {
        if (!title.trim()) { alert('Please enter a post title.'); return; }
        setSaving(true);
        const finalContent = editorRef.current?.innerHTML ?? content;
        try {
            const result = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, slug, content: finalContent, excerpt, featuredImage, gradient, status,
                    scheduledAt: localInputToIso(scheduledLocal), seo,
                    categoryIds: selectedCategoryIds,
                    primaryCategoryId: primaryCategoryId ?? selectedCategoryIds[0] ?? null,
                }),
            });
            if (!result.ok) {
                const err = await result.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${result.status}`);
            }
            router.push('/admin/myprojects/blog');
        } catch (error: any) {
            alert(`Failed: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    // Save as draft, open the public page in ?preview=1 mode (admin-only), then
    // switch to the edit page so re-previewing updates the SAME draft instead of
    // creating duplicates.
    async function handlePreview() {
        if (!title.trim()) { alert('Please enter a post title first.'); return; }
        setSaving(true);
        const finalContent = editorRef.current?.innerHTML ?? content;
        try {
            const result = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, slug, content: finalContent, excerpt, featuredImage, gradient, status: 'draft', seo,
                    categoryIds: selectedCategoryIds,
                    primaryCategoryId: primaryCategoryId ?? selectedCategoryIds[0] ?? null,
                }),
            });
            if (!result.ok) {
                const err = await result.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${result.status}`);
            }
            const data = await result.json();
            const catSlug = (data.categories ?? []).find((c: any) => c.id === data.primaryCategoryId)?.slug
                || data.categories?.[0]?.slug || 'uncategorized';
            window.open(`/${catSlug}/${data.slug}?preview=1`, '_blank', 'noopener');
            router.push(`/admin/myprojects/blog/edit/${data.id}`);
        } catch (error: any) {
            alert(`Failed: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    const issueCount = imageIssues.filter(i => i.missingAlt || i.missingKeyword || i.notNextGen).length;

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Add Post"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Add Post', path: '/admin/myprojects/blog/create' },
                ]}
            />

            <Row>
                {/* Main editor column */}
                <Col xs={12} lg={8}>
                    <div className="card shadow border-0 p-3 mt-1 blog-editor-card">

                        {/* ── Title + Slug ───────────────── */}
                        <div className="form-group para mb-3 blog-title-block">
                            <label className="blog-field-label">Post Title</label>
                            <input
                                type="text"
                                className="blog-title-input"
                                value={title}
                                onChange={handleTitleChange}
                                placeholder="Enter post title..."
                                onBlur={handleTitleBlur}
                            />
                            <div className="blog-slug-row">
                                <span className="blog-slug-label">Slug:</span>
                                <span className="blog-slug-prefix">/{categories.find(c => c.id === (primaryCategoryId ?? selectedCategoryIds[0]))?.slug ?? 'uncategorized'}/</span>
                                <input
                                    type="text"
                                    className="blog-slug-input"
                                    value={slug}
                                    onChange={e => setSlug(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Rich text editor */}
                        <div className="form-group para mb-3">
                            <label className="blog-field-label">Content</label>
                            <PostEditor
                                value={content}
                                onChange={setContent}
                                focusKeyword={seo.focusKeyword}
                                placeholder="Start writing your post here..."
                            />
                        </div>

                        <div className="form-group para mb-3">
                            <label className="blog-field-label">Excerpt <small style={{ fontWeight: 400 }}>(short summary — used in listings)</small></label>
                            <textarea
                                className="form-control"
                                rows={3}
                                value={excerpt}
                                onChange={e => setExcerpt(e.target.value)}
                                placeholder="Brief summary of this post..."
                            />
                        </div>

                        {/* SEO Panel */}
                        <SeoPanel
                            seo={seo}
                            onChange={setSeo}
                            postTitle={title}
                            postContent={content}
                            postSlug={slug}
                            postAuthor={session?.user?.name ?? ''}
                            siteName={siteName}
                            siteUrl={siteUrl}
                            postCategory={categories.find(c => selectedCategoryIds.includes(c.id))?.name ?? ''}
                            urlBasePath={categories.find(c => c.id === (primaryCategoryId ?? selectedCategoryIds[0]))?.slug ?? 'uncategorized'}
                        />
                    </div>
                </Col>

                {/* Sidebar column */}
                <Col xs={12} lg={4}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <h5 className="hd mb-3">Publish</h5>

                        <div className="form-group para mb-3">
                            <label className="blog-field-label">Status</label>
                            <div className="blog-status-row">
                                {(['draft', 'scheduled', 'published'] as const).map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => {
                                            setStatus(s);
                                            // Never leave "scheduled" without a time —
                                            // the API would quietly downgrade it to draft.
                                            if (s === 'scheduled' && !scheduledLocal) setScheduledLocal(defaultScheduleLocal());
                                        }}
                                        className={`blog-status-btn ${s} ${status === s ? 'active' : ''}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            {status === 'scheduled' && (
                                <ScheduleField scheduledLocal={scheduledLocal} onScheduledChange={setScheduledLocal} />
                            )}
                        </div>

                        <div className="form-group para mb-3">
                            <label className="blog-field-label">Featured Visual</label>
                            <FeaturedVisual
                                image={featuredImage}
                                gradient={gradient}
                                onChange={({ image, gradient }) => { setFeaturedImage(image); setGradient(gradient); }}
                            />
                        </div>

                        <button
                            className="btn btn-primary w-100"
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : status === 'published' ? 'Publish Post' : 'Save Draft'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-secondary w-100 mt-2"
                            onClick={handlePreview}
                            disabled={saving}
                            title="Save as draft and preview how it will look — without publishing"
                        >
                            👁 Preview
                        </button>
                    </div>

                    {/* Categories card */}
                    <div className="card shadow border-0 p-3 mt-2">
                        <h5 className="hd mb-3">Categories</h5>

                        {categoriesLoading && (
                            <div className="para" style={{ opacity: 0.5, fontSize: '13px' }}>Loading categories...</div>
                        )}

                        {!categoriesLoading && categories.length === 0 && (
                            <div className="para" style={{ opacity: 0.5, fontSize: '13px' }}>
                                No categories yet.{' '}
                                <a href="/admin/myprojects/blog/categories/create">Create one</a>.
                            </div>
                        )}

                        {!categoriesLoading && categories.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
                                {categories.map(cat => (
                                    <label key={cat.id} className="para blog-category-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedCategoryIds.includes(cat.id)}
                                            onChange={() => toggleCategory(cat.id)}
                                            className="blog-category-checkbox"
                                        />
                                        {cat.name}
                                        {selectedCategoryIds.includes(cat.id) && (
                                            <span className="blog-category-badge">Selected</span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}

                        {/* Primary category — drives the post URL /<category>/<slug> */}
                        {selectedCategoryIds.length > 0 && (
                            <div className="mt-3">
                                <label className="para" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    Primary category <small style={{ fontWeight: 400, opacity: 0.7 }}>(used in the URL)</small>
                                </label>
                                <select
                                    className="form-control"
                                    value={primaryCategoryId ?? selectedCategoryIds[0] ?? ''}
                                    onChange={e => setPrimaryCategoryId(Number(e.target.value))}
                                >
                                    {selectedCategoryIds.map(id => {
                                        const c = categories.find(x => x.id === id);
                                        return c ? <option key={id} value={id}>{c.name}</option> : null;
                                    })}
                                </select>
                                <small className="para" style={{ fontSize: 12, opacity: 0.6 }}>
                                    URL: <code>/{categories.find(c => c.id === (primaryCategoryId ?? selectedCategoryIds[0]))?.slug ?? 'uncategorized'}/{slug || 'your-slug'}</code>
                                </small>
                            </div>
                        )}
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default AddPost;
