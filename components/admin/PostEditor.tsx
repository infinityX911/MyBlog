'use client';

/**
 * components/admin/PostEditor.tsx
 *
 * The rich content editor extracted from the Blog "Add Post" page so the SAME
 * editor (toolbar, image upload + AI alt-text, tables, stats, selection-
 * persistence bug-fixes) can be reused by the YT-downloader "Add Page" — and
 * any future editor — with a single source of truth.
 *
 * Controlled by HTML string: `value` seeds it once; every edit reports back via
 * `onChange(html)`. `focusKeyword` powers the image alt-text SEO checks.
 *
 * Fixes added here (requested):
 *   #1 Tables: a contextual toolbar (add/delete row & column) appears when the
 *      caret is inside a table, so rows/columns are fully editable.
 *   #2 Lists + #3 line spacing are handled in admin.css (shared with Add Post).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ImageCropper from '@/components/admin/ImageCropper';

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

const LINE_SPACING = [
    { label: 'Line spacing', value: '' },
    { label: 'Tight (1.15)', value: '1.15' },
    { label: '1.0', value: '1.0' },
    { label: 'Single (1.4)', value: '1.4' },
    { label: 'Normal (1.7)', value: '1.7' },
    { label: 'Relaxed (2.0)', value: '2.0' },
    { label: 'Double (2.4)', value: '2.4' },
];

// List styles the author can pick from (value = "tag:list-style-type").
const LIST_STYLES = {
    bullets: [
        { label: '• Disc', value: 'ul:disc' },
        { label: '○ Circle', value: 'ul:circle' },
        { label: '▪ Square', value: 'ul:square' },
    ],
    numbers: [
        { label: '1. Decimal', value: 'ol:decimal' },
        { label: 'a. Lower alpha', value: 'ol:lower-alpha' },
        { label: 'A. Upper alpha', value: 'ol:upper-alpha' },
        { label: 'i. Lower roman', value: 'ol:lower-roman' },
        { label: 'I. Upper roman', value: 'ol:upper-roman' },
    ],
};

type ImageIssue = { src: string; missingAlt: boolean; missingKeyword: boolean; notNextGen: boolean };

type ContentStats = {
    words: number; characters: number; sentences: number; paragraphs: number;
    avgSentenceLength: number; longSentences: number; readMinutes: number; readability: number;
};

function computeStats(html: string): ContentStats {
    const empty = { words: 0, characters: 0, sentences: 0, paragraphs: 0, avgSentenceLength: 0, longSentences: 0, readMinutes: 1, readability: 0 };
    if (!html) return empty;
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const characters = text.length;
    const P = '\u0000DOT\u0000';
    const masked = text.replace(/\.(js|jsx|ts|tsx|json|css|scss|html|md|mjs|cjs|env|yml|yaml|config)\b/gi, (_, e) => `${P}${e}`);
    const sm = (masked.match(/[^.!?]+[.!?]+/g) || (masked ? [masked] : [])).map(x => x.replace(new RegExp(P, 'g'), '.'));
    const sentences = sm.length;
    const longSentences = sm.filter(x => x.trim().split(/\s+/).filter(Boolean).length > 20).length;
    const paragraphs = html.replace(/<\/(p|h[1-6]|blockquote|pre|li|div)>/gi, '\n').replace(/<[^>]*>/g, '').split(/\n+/).filter(x => x.trim().length > 0).length;
    const avgSentenceLength = sentences > 0 ? Math.round(words / sentences) : 0;
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    let readability = 0;
    const ss = text.split(/[.!?]+/).filter(x => x.trim().length > 5);
    const sw = text.trim().split(/\s+/).filter(Boolean);
    if (ss.length > 0 && sw.length > 0) {
        const asl = sw.length / ss.length;
        const awl = sw.reduce((a, w) => a + w.length, 0) / sw.length;
        readability = Math.round(Math.max(0, Math.min(100, 206.835 - 1.015 * asl - 84.6 * (awl / 5))));
    }
    return { words, characters, sentences, paragraphs, avgSentenceLength, longSentences, readMinutes, readability };
}

interface Props {
    value: string;
    onChange: (html: string) => void;
    focusKeyword?: string;
    placeholder?: string;
    /**
     * Total words across the WHOLE page, when this editor is only one text
     * block among several (the CMS page builder). The 300-word rule is a
     * page-level SEO rule, but this panel only ever saw its own block — so a
     * page split across two text blocks warned "Only 238 words" on each one
     * while the SEO panel correctly reported 320. Passing the page total keeps
     * the two counters telling the same story. Omit it for a single-editor
     * screen (the post editor), where block = page.
     */
    pageWords?: number;
}

export default function PostEditor({ value, onChange, focusKeyword = '', placeholder = 'Start writing here...', pageWords }: Props) {
    const editorRef = useRef<HTMLDivElement>(null);
    const linkInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const savedRangeRef = useRef<Range | null>(null);

    const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
    const [currentBlock, setCurrentBlock] = useState<BlockTag>('p');
    const [stats, setStats] = useState<ContentStats>(computeStats(''));
    const [linkUrl, setLinkUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [inTable, setInTable] = useState(false);

    const [showImagePanel, setShowImagePanel] = useState(false);
    const [uploadMode, setUploadMode] = useState<UploadMode>('url');
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    // Non-null while the crop modal is open for a freshly picked file.
    const [cropFile, setCropFile] = useState<File | null>(null);
    // Opt-in, and deliberately not remembered between sessions — cropping is a
    // per-image decision, not a mode you want to leave switched on by accident.
    const [cropEnabled, setCropEnabled] = useState(false);
    const [visionProvider, setVisionProvider] = useState<VisionProvider>('openai');
    const [generatingAlt, setGeneratingAlt] = useState(false);
    const [lastInsertedImg, setLastInsertedImg] = useState<HTMLImageElement | null>(null);
    const [imgWidthPercent, setImgWidthPercent] = useState(100);
    const [altDraft, setAltDraft] = useState('');
    const [imageIssues, setImageIssues] = useState<ImageIssue[]>([]);

    // Seed once (and when an external value arrives while the editor is empty).
    useEffect(() => {
        const el = editorRef.current;
        if (el && value && el.innerHTML.trim() === '') { el.innerHTML = value; setStats(computeStats(value)); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const saveSelection = useCallback(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
            savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        }
    }, []);
    const restoreSelection = useCallback(() => {
        const sel = window.getSelection();
        if (sel && savedRangeRef.current) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current); }
        return sel;
    }, []);

    const currentCell = useCallback((): HTMLTableCellElement | null => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !editorRef.current) return null;
        let n: Node | null = sel.getRangeAt(0).startContainer;
        while (n && n !== editorRef.current) {
            if (n instanceof HTMLElement && (n.tagName === 'TD' || n.tagName === 'TH')) return n as HTMLTableCellElement;
            n = n.parentElement;
        }
        return null;
    }, []);

    const getCurrentBlockElement = useCallback((): HTMLElement | null => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !editorRef.current) return null;
        let node: Node | null = sel.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'LI', 'DIV']);
        while (node && node !== editorRef.current) {
            if (node instanceof HTMLElement && blockTags.has(node.tagName)) return node;
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
        } catch { /* ignore */ }
        setActiveFormats(formats);
        const block = getCurrentBlockElement();
        const tag = block?.tagName.toLowerCase();
        setCurrentBlock((tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'blockquote' || tag === 'pre') ? tag as BlockTag : 'p');
        setInTable(!!currentCell());
    }, [getCurrentBlockElement, currentCell]);

    const scanImageIssues = useCallback((html: string, kw0: string) => {
        if (typeof window === 'undefined') return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const kw = kw0.trim().toLowerCase();
        setImageIssues(Array.from(doc.querySelectorAll('img')).map(img => {
            const alt = (img.getAttribute('alt') ?? '').trim();
            const src = img.getAttribute('src') ?? '';
            const isNextGen = /\.(webp|avif)(\?|$)/i.test(src) || (src.includes('cloudinary') && src.includes('f_webp'));
            return { src, missingAlt: alt.length === 0, missingKeyword: kw.length > 0 && alt.length > 0 && !alt.toLowerCase().includes(kw), notNextGen: !isNextGen };
        }));
    }, []);

    const emit = useCallback(() => {
        const html = editorRef.current?.innerHTML ?? '';
        onChange(html);
        setStats(computeStats(html));
        updateToolbarState();
        scanImageIssues(html, focusKeyword);
        saveSelection();
    }, [onChange, updateToolbarState, scanImageIssues, saveSelection, focusKeyword]);

    useEffect(() => {
        scanImageIssues(editorRef.current?.innerHTML ?? '', focusKeyword);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusKeyword]);

    useEffect(() => {
        const handler = () => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) { updateToolbarState(); saveSelection(); }
        };
        document.addEventListener('selectionchange', handler);
        return () => document.removeEventListener('selectionchange', handler);
    }, [updateToolbarState, saveSelection]);

    const runInlineCommand = (cmd: string) => {
        editorRef.current?.focus(); restoreSelection();
        document.execCommand(cmd, false); emit();
    };

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
        if (range.collapsed) { const b = resolveBlock(range.startContainer); return b ? [b] : []; }
        const candidates = Array.from(editorRef.current.querySelectorAll('p, h1, h2, h3, blockquote, pre, li')) as HTMLElement[];
        const touched = candidates.filter(el => range.intersectsNode(el));
        if (touched.length > 0) return touched;
        const sb = resolveBlock(range.startContainer);
        return sb ? [sb] : [];
    }, []);

    const applyBlockFormat = (tag: BlockTag) => {
        editorRef.current?.focus(); restoreSelection();
        const blocks = getSelectedBlockElements();
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
                range.deleteContents(); range.insertNode(pre);
                const r = document.createRange(); r.selectNodeContents(pre); r.collapse(false);
                sel.removeAllRanges(); sel.addRange(r); savedRangeRef.current = r.cloneRange();
                emit(); return;
            }
        }
        if (blocks.length > 0) {
            let last: HTMLElement | null = null;
            for (const block of blocks) {
                if (!editorRef.current?.contains(block)) continue;
                const el = document.createElement(tag);
                el.innerHTML = block.innerHTML || '<br>';
                block.replaceWith(el); last = el;
            }
            if (last) {
                const range = document.createRange(); range.selectNodeContents(last); range.collapse(false);
                const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range); savedRangeRef.current = range.cloneRange();
            }
        } else {
            document.execCommand('formatBlock', false, tag);
        }
        emit();
    };

    const applyLineSpacing = (lh: string) => {
        // Guard: line-height below 1 collapses/overlaps lines, which breaks text
        // selection (clicks land on the overlapping heading). Never allow it.
        const n = parseFloat(lh);
        if (!lh || !isFinite(n) || n < 1) return;
        editorRef.current?.focus(); restoreSelection();
        const blocks = getSelectedBlockElements();
        const targets = blocks.length ? blocks : (editorRef.current ? [editorRef.current] : []);
        targets.forEach(el => { (el as HTMLElement).style.lineHeight = lh; });
        emit();
    };

    const applyColor = (color: string) => {
        editorRef.current?.focus(); restoreSelection();
        try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* ignore */ }
        document.execCommand('foreColor', false, color); emit();
    };

    // ── Tables (#1): insert + contextual row/column editing ──────────────
    const insertTable = (rows = 3, cols = 3) => {
        editorRef.current?.focus(); restoreSelection();
        let html = '<table><thead><tr>';
        for (let c = 0; c < cols; c++) html += `<th>Heading ${c + 1}</th>`;
        html += '</tr></thead><tbody>';
        for (let r = 0; r < rows - 1; r++) { html += '<tr>'; for (let c = 0; c < cols; c++) html += '<td>Cell</td>'; html += '</tr>'; }
        html += '</tbody></table><p><br></p>';
        document.execCommand('insertHTML', false, html); emit();
    };
    const cellIndex = (cell: HTMLTableCellElement) => Array.from(cell.parentElement!.children).indexOf(cell);
    const addRow = (below: boolean) => {
        const cell = currentCell(); if (!cell) return;
        const row = cell.parentElement as HTMLTableRowElement;
        const nr = row.cloneNode(true) as HTMLTableRowElement;
        Array.from(nr.children).forEach(c => { (c as HTMLElement).innerHTML = 'Cell'; });
        row.parentElement!.insertBefore(nr, below ? row.nextSibling : row); emit();
    };
    const addCol = (right: boolean) => {
        const cell = currentCell(); if (!cell) return;
        const idx = cellIndex(cell);
        const table = cell.closest('table'); if (!table) return;
        table.querySelectorAll('tr').forEach(tr => {
            const ref = tr.children[idx] as HTMLElement | undefined;
            const isHead = tr.parentElement?.tagName === 'THEAD';
            const nc = document.createElement(isHead ? 'th' : 'td');
            nc.textContent = isHead ? 'Heading' : 'Cell';
            if (ref) tr.insertBefore(nc, right ? ref.nextSibling : ref); else tr.appendChild(nc);
        });
        emit();
    };
    const delRow = () => { const cell = currentCell(); if (!cell) return; const row = cell.parentElement as HTMLTableRowElement; if (row.closest('table')!.querySelectorAll('tr').length > 1) row.remove(); emit(); };
    const delCol = () => {
        const cell = currentCell(); if (!cell) return;
        const idx = cellIndex(cell); const table = cell.closest('table'); if (!table) return;
        table.querySelectorAll('tr').forEach(tr => { const c = tr.children[idx]; if (c) c.remove(); });
        emit();
    };
    const delTable = () => { const cell = currentCell(); const table = cell?.closest('table'); if (table) { table.remove(); emit(); } };

    const nearestList = (): HTMLElement | null => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !editorRef.current) return null;
        let n: Node | null = sel.getRangeAt(0).startContainer;
        while (n && n !== editorRef.current) {
            if (n instanceof HTMLElement && (n.tagName === 'UL' || n.tagName === 'OL')) return n;
            n = n.parentElement;
        }
        return null;
    };
    const applyList = (ordered: boolean, styleType: string) => {
        editorRef.current?.focus(); restoreSelection();
        const existing = nearestList();
        const sameKind = existing && ((ordered && existing.tagName === 'OL') || (!ordered && existing.tagName === 'UL'));
        if (!sameKind) document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList', false);
        const list = nearestList();
        if (list) list.style.listStyleType = styleType;
        emit();
    };

    const insertLink = () => {
        const raw = linkUrl.trim();
        setLinkUrl(''); setShowLinkInput(false);
        if (!raw) return;
        const url = /^(https?:|mailto:|tel:|\/|#)/i.test(raw) ? raw : `https://${raw}`;
        editorRef.current?.focus();
        const sel = restoreSelection();
        const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;

        // Text is selected → wrap it in an anchor. Otherwise insert the URL as a
        // clickable link (createLink does nothing on a collapsed cursor).
        if (range && !range.collapsed && editorRef.current?.contains(range.commonAncestorContainer)) {
            document.execCommand('createLink', false, url);
            // execCommand can't set target/rel — patch the anchor(s) we just made.
            editorRef.current?.querySelectorAll(`a[href="${CSS.escape(url)}"]`).forEach(a => {
                if (!(a as HTMLElement).getAttribute('target')) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
            });
        } else {
            const a = document.createElement('a');
            a.href = url; a.textContent = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
            if (range && editorRef.current?.contains(range.startContainer)) {
                range.insertNode(a);
                range.setStartAfter(a); range.setEndAfter(a); sel!.removeAllRanges(); sel!.addRange(range);
            } else {
                editorRef.current?.appendChild(a);
            }
        }
        emit();
    };

    // Drop an inline ad marker at the cursor. On the live post this <div> is
    // replaced by the "Inline" ad configured in Blog → Ads. The label text is
    // stripped on render, so it never leaks to visitors.
    const insertInlineAd = () => {
        editorRef.current?.focus(); restoreSelection();
        const html = '<div class="post-inline-ad">💰 Ad slot — the "Inline" ad shows here on the live post</div><p><br></p>';
        document.execCommand('insertHTML', false, html);
        emit();
    };

    // Embed a YouTube video. Accepts a full URL (watch, youtu.be, shorts, embed)
    // or a bare 11-char ID. Inserts a privacy-friendly (nocookie), lazy-loaded,
    // responsive 16:9 iframe. The host allowlist in the sanitizer keeps it safe.
    const insertYouTube = () => {
        editorRef.current?.focus(); restoreSelection();
        const input = window.prompt('YouTube video URL or ID:');
        if (!input) return;
        const s = input.trim();
        const id = /^[\w-]{11}$/.test(s)
            ? s
            : (s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/|live\/))([\w-]{11})/)?.[1] ?? null);
        if (!id) { alert('Could not read a YouTube video ID from that link.'); return; }
        const html = `<div class="yt-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div><p><br></p>`;
        document.execCommand('insertHTML', false, html);
        emit();
    };

    const insertImageIntoEditor = (url: string) => {
        editorRef.current?.focus(); restoreSelection();
        const img = document.createElement('img');
        img.src = url; img.alt = ''; img.loading = 'lazy'; img.style.width = '100%';
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0); range.deleteContents(); range.insertNode(img);
            range.setStartAfter(img); range.setEndAfter(img); sel.removeAllRanges(); sel.addRange(range); savedRangeRef.current = range.cloneRange();
        } else { editorRef.current?.appendChild(img); }
        setLastInsertedImg(img); setAltDraft(''); setImgWidthPercent(100); emit();
    };

    const handleUrlInsert = () => { if (!imageUrlInput.trim()) return; insertImageIntoEditor(imageUrlInput.trim()); setImageUrlInput(''); setUploadError(''); };
    const uploadFile = async (file: File, mode: 'local' | 'cloud') => {
        setUploading(true); setUploadError('');
        try {
            const fd = new FormData(); fd.append('file', file); fd.append('mode', mode);
            const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
            let data: any = null;
            try { data = await res.json(); } catch { throw new Error(`Server returned non-JSON (HTTP ${res.status}).`); }
            if (!res.ok) throw new Error(data?.error ?? `Upload failed (HTTP ${res.status})`);
            if (!data?.url) throw new Error('Upload succeeded but no file URL was returned.');
            insertImageIntoEditor(data.url);
        } catch (err: any) { setUploadError(err.message ?? 'Upload failed.'); } finally { setUploading(false); }
    };
    // With "Crop before uploading" ticked the file goes to the cropper and only
    // the trimmed result is ever sent; unticked, it uploads exactly as before.
    // Cropping BEFORE upload rather than after means the server only ever holds
    // one copy — there is no original left behind to find and delete later.
    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        e.target.value = '';
        if (cropEnabled) setCropFile(file);
        else uploadFile(file, uploadMode === 'cloud' ? 'cloud' : 'local');
    };
    const generateAltText = async () => {
        if (!lastInsertedImg) return;
        setGeneratingAlt(true); setUploadError('');
        try {
            const res = await fetch('/api/generate-alt-text', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: lastInsertedImg.src, provider: visionProvider, focusKeyword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? 'Alt-text generation failed.');
            setAltDraft(data.altText); lastInsertedImg.alt = data.altText; emit();
        } catch (err: any) { setUploadError(err.message ?? 'Alt-text generation failed.'); } finally { setGeneratingAlt(false); }
    };
    const applyAltDraft = () => { if (lastInsertedImg) { lastInsertedImg.alt = altDraft; emit(); } };
    const handleImgWidthChange = (p: number) => { setImgWidthPercent(p); if (lastInsertedImg) { lastInsertedImg.style.width = `${p}%`; emit(); } };

    const issueCount = imageIssues.filter(i => i.missingAlt || i.missingKeyword || i.notNextGen).length;

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount && editorRef.current) {
                let n: Node | null = sel.anchorNode; let pre: HTMLElement | null = null;
                while (n && n !== editorRef.current) { if (n instanceof HTMLElement && n.tagName === 'PRE') { pre = n; break; } n = n.parentNode; }
                if (pre) {
                    e.preventDefault();
                    const range = sel.getRangeAt(0); const pr = range.cloneRange(); pr.selectNodeContents(pre); pr.setEnd(range.endContainer, range.endOffset);
                    const before = pr.toString();
                    if (before.endsWith('\n')) {
                        const node = range.endContainer;
                        if (node.nodeType === Node.TEXT_NODE && range.endOffset > 0 && node.textContent && node.textContent[range.endOffset - 1] === '\n')
                            node.textContent = node.textContent.slice(0, range.endOffset - 1) + node.textContent.slice(range.endOffset);
                        const p = document.createElement('p'); p.innerHTML = '<br>'; pre.after(p);
                        const r = document.createRange(); r.setStart(p, 0); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); savedRangeRef.current = r.cloneRange();
                    } else {
                        const nl = document.createTextNode('\n'); range.deleteContents(); range.insertNode(nl);
                        range.setStartAfter(nl); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); savedRangeRef.current = range.cloneRange();
                    }
                    emit(); return;
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveSelection, emit]);

    return (
        <div>
            {/* Toolbar */}
            <div className="blog-editor-toolbar-v2">
                <select title="Paragraph style" value={currentBlock} onChange={e => applyBlockFormat(e.target.value as BlockTag)} className="blog-toolbar-select">
                    {BLOCK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select title="Line spacing" defaultValue="" onChange={e => { applyLineSpacing(e.target.value); e.currentTarget.selectedIndex = 0; }} className="blog-toolbar-select">
                    {LINE_SPACING.map(o => <option key={o.value} value={o.value} disabled={o.value === ''}>{o.label}</option>)}
                </select>
                <div className="blog-toolbar-separator" />
                {INLINE_BUTTONS.map(item => (
                    <button key={item.cmd} type="button" title={item.title}
                        onMouseDown={e => { e.preventDefault(); runInlineCommand(item.cmd); }}
                        className={`blog-toolbar-btn-v2 ${item.cls ?? ''} ${activeFormats.has(item.cmd) ? 'active' : ''}`}>
                        {item.label}
                    </button>
                ))}
                <div className="blog-toolbar-separator" />
                <select title="List style" defaultValue="" className="blog-toolbar-select"
                    onMouseDown={() => saveSelection()}
                    onChange={e => { const v = e.target.value; if (v) { const [tag, st] = v.split(':'); applyList(tag === 'ol', st); } e.currentTarget.selectedIndex = 0; }}>
                    <option value="" disabled>List ▾</option>
                    <optgroup label="Bullets">
                        {LIST_STYLES.bullets.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                    <optgroup label="Numbered">
                        {LIST_STYLES.numbers.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                </select>
                <div className="blog-toolbar-separator" />
                <button type="button" title="Horizontal Rule" onMouseDown={e => { e.preventDefault(); runInlineCommand('insertHorizontalRule'); }} className="blog-toolbar-btn-v2">—</button>
                <button type="button" title="Clear Formatting" onMouseDown={e => { e.preventDefault(); runInlineCommand('removeFormat'); }} className="blog-toolbar-btn-v2">Clear</button>
                <button type="button" title="Insert Link (Ctrl+K)"
                    onMouseDown={e => { e.preventDefault(); saveSelection(); setShowLinkInput(v => !v); setShowImagePanel(false); setTimeout(() => linkInputRef.current?.focus(), 50); }}
                    className={`blog-toolbar-btn-v2 ${showLinkInput ? 'active' : ''}`}>🔗 Link</button>
                <button type="button" title="Remove Link" onMouseDown={e => { e.preventDefault(); runInlineCommand('unlink'); }} className="blog-toolbar-btn-v2">Unlink</button>
                <button type="button" title="Insert Image"
                    onMouseDown={e => { e.preventDefault(); saveSelection(); setShowImagePanel(v => !v); setShowLinkInput(false); }}
                    className={`blog-toolbar-btn-v2 ${showImagePanel ? 'active' : ''}`}>🖼️ Image</button>
                <button type="button" title="Insert Table (choose size)" onMouseDown={e => {
                    e.preventDefault();
                    const r = parseInt(window.prompt('How many rows? (including the header row)', '3') || '', 10);
                    if (!r || r < 1) return;
                    const c = parseInt(window.prompt('How many columns?', '3') || '', 10);
                    if (!c || c < 1) return;
                    insertTable(Math.min(r, 30), Math.min(c, 12));
                }} className="blog-toolbar-btn-v2">▦ Table</button>
                <button type="button" title="Insert an ad slot (shows an in-content ad on the live post)" onMouseDown={e => { e.preventDefault(); insertInlineAd(); }} className="blog-toolbar-btn-v2">💰 Ad</button>
                <button type="button" title="Embed a YouTube video" onMouseDown={e => { e.preventDefault(); insertYouTube(); }} className="blog-toolbar-btn-v2">▶ YouTube</button>
                <label title="Text color" className="blog-toolbar-btn-v2" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onMouseDown={() => saveSelection()}>
                    <span style={{ borderBottom: '2px solid currentColor', lineHeight: 1 }}>A</span>
                    <input type="color" defaultValue="#5b4fcf" onChange={e => applyColor(e.target.value)} style={{ width: 20, height: 20, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                </label>
                <span className="blog-toolbar-wordcount">{stats.words} words · {stats.readMinutes} min read</span>
            </div>

            {/* Contextual table toolbar (#1) */}
            {inTable && (
                <div className="blog-table-toolbar">
                    <button type="button" onMouseDown={e => { e.preventDefault(); addRow(false); }}>+ Row above</button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); addRow(true); }}>+ Row below</button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); addCol(false); }}>+ Col left</button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); addCol(true); }}>+ Col right</button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); delRow(); }}>Delete row</button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); delCol(); }}>Delete col</button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); delTable(); }}>Delete table</button>
                </div>
            )}

            {/* Link popup */}
            {showLinkInput && (
                <div className="blog-link-popup">
                    <input ref={linkInputRef} type="text" placeholder="https://..." value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') insertLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
                        className="form-control form-control-sm blog-link-input" />
                    <button type="button" onClick={insertLink} className="btn btn-primary btn-sm">Apply</button>
                    <button type="button" onClick={() => setShowLinkInput(false)} className="btn btn-light btn-sm">Cancel</button>
                </div>
            )}

            {/* Image insert panel */}
            {showImagePanel && (
                <div className="blog-image-panel">
                    <div className="blog-image-tabs">
                        {(['url', 'local', 'cloud'] as UploadMode[]).map(mode => (
                            <button key={mode} type="button" className={`blog-image-tab ${uploadMode === mode ? 'active' : ''}`} onClick={() => setUploadMode(mode)}>
                                {mode === 'url' ? '🔗 URL' : mode === 'local' ? '💻 Upload (Local)' : '☁️ Upload (Cloud)'}
                            </button>
                        ))}
                    </div>
                    {uploadMode === 'url' && (
                        <div className="blog-image-tab-body">
                            <input type="url" placeholder="https://example.com/image.jpg" value={imageUrlInput}
                                onChange={e => setImageUrlInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleUrlInsert(); }}
                                className="form-control form-control-sm" />
                            <button type="button" className="btn btn-primary btn-sm" onClick={handleUrlInsert}>Insert</button>
                        </div>
                    )}
                    {(uploadMode === 'local' || uploadMode === 'cloud') && (
                        <>
                            <div className="blog-image-tab-body">
                                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleFileSelected} className="form-control form-control-sm" disabled={uploading} />
                                {uploading && <span className="blog-image-uploading">Uploading…</span>}
                            </div>
                            {/* Off by default: most uploads are already the right
                                shape, and forcing a modal in front of every one
                                of them turns a one-click action into two. Tick it
                                when the image needs trimming — typically a
                                screenshot with a lot of empty browser around the
                                part that matters. */}
                            <label className="blog-crop-toggle">
                                <input
                                    type="checkbox"
                                    checked={cropEnabled}
                                    disabled={uploading}
                                    onChange={e => setCropEnabled(e.target.checked)}
                                />
                                <span>Crop before uploading</span>
                                <small>Drag to select on a computer, or drag with a finger on a phone.</small>
                            </label>
                        </>
                    )}
                    {uploadError && <p className="blog-image-error">{uploadError}</p>}
                </div>
            )}

            {/* Alt-text panel */}
            {lastInsertedImg && (
                <div className="blog-alt-panel">
                    <div className="blog-alt-preview"><img src={lastInsertedImg.src} alt="" /></div>
                    <div className="blog-alt-controls">
                        <label className="blog-field-label">Alt Text (SEO)</label>
                        <div className="blog-alt-row">
                            <input type="text" className="form-control form-control-sm" placeholder="Describe this image for search engines & accessibility"
                                value={altDraft} onChange={e => setAltDraft(e.target.value)} onBlur={applyAltDraft} maxLength={160} />
                            <select className="blog-toolbar-select" value={visionProvider} onChange={e => setVisionProvider(e.target.value as VisionProvider)} title="Vision AI provider">
                                <option value="openai">OpenAI Vision</option>
                                <option value="google">Google Cloud Vision</option>
                            </select>
                            <button type="button" className="btn btn-primary btn-sm" onClick={generateAltText} disabled={generatingAlt}>
                                {generatingAlt ? '✨ Generating…' : '✨ Auto-generate'}
                            </button>
                        </div>
                        <div className="blog-img-scale-row">
                            <label className="blog-field-label" style={{ marginBottom: 0 }}>Image size</label>
                            <input type="range" min={20} max={100} step={5} value={imgWidthPercent} onChange={e => handleImgWidthChange(Number(e.target.value))} className="blog-img-scale-slider" />
                            <span className="blog-img-scale-value">{imgWidthPercent}%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Editor area */}
            <div ref={editorRef} contentEditable suppressContentEditableWarning data-placeholder={placeholder}
                onInput={emit} onKeyDown={handleKeyDown} onKeyUp={saveSelection}
                onMouseUp={() => { updateToolbarState(); saveSelection(); }}
                onClick={() => { updateToolbarState(); saveSelection(); }}
                className="blog-editor-content-v2" />

            {/* Live content stats */}
            <div className="blog-stats-panel">
                <div className="blog-stats-grid">
                    <div className="blog-stat-item"><span className="blog-stat-value">{stats.words}</span><span className="blog-stat-label">{pageWords != null ? 'Words (this block)' : 'Words'}</span></div>
                    {pageWords != null && (
                        <div className="blog-stat-item"><span className="blog-stat-value">{pageWords}</span><span className="blog-stat-label">Words (whole page)</span></div>
                    )}
                    <div className="blog-stat-item"><span className="blog-stat-value">{stats.characters}</span><span className="blog-stat-label">Characters</span></div>
                    <div className="blog-stat-item"><span className="blog-stat-value">{stats.sentences}</span><span className="blog-stat-label">Sentences</span></div>
                    <div className="blog-stat-item"><span className="blog-stat-value">{stats.paragraphs}</span><span className="blog-stat-label">Paragraphs</span></div>
                    <div className="blog-stat-item"><span className="blog-stat-value">{stats.avgSentenceLength}</span><span className="blog-stat-label">Avg words/sentence</span></div>
                    <div className="blog-stat-item"><span className="blog-stat-value">{stats.readMinutes} min</span><span className="blog-stat-label">Read time</span></div>
                    <div className="blog-stat-item"><span className="blog-stat-value">{stats.readability}</span><span className="blog-stat-label">Readability</span></div>
                </div>
                {stats.longSentences > 0 && (
                    <p className="blog-stats-warning">⚠ {stats.longSentences} sentence{stats.longSentences !== 1 ? 's are' : ' is'} over 20 words — consider shortening.</p>
                )}
                {/* The 300-word rule is measured against the PAGE, not this
                    block — see the `pageWords` prop. */}
                {(pageWords ?? stats.words) > 0 && (pageWords ?? stats.words) < 300 && (
                    <p className="blog-stats-warning">
                        {pageWords != null
                            ? `⚠ This page has ${pageWords} words across all blocks. Aim for 300+ for better SEO.`
                            : `⚠ Only ${stats.words} words. Aim for 300+ for better SEO.`}
                    </p>
                )}
            </div>

            {/* Image SEO checklist */}
            {imageIssues.length > 0 && (
                <div className={`blog-image-seo-check ${issueCount > 0 ? 'has-issues' : 'all-good'}`}>
                    <p className="blog-image-seo-title">
                        🖼️ Image SEO ({imageIssues.length} image{imageIssues.length !== 1 ? 's' : ''})
                        {issueCount === 0 ? <span className="blog-image-seo-ok"> · all good</span> : <span className="blog-image-seo-bad"> · {issueCount} issue{issueCount !== 1 ? 's' : ''}</span>}
                    </p>
                    {issueCount > 0 && (
                        <ul className="blog-image-seo-list">
                            {imageIssues.map((img, idx) => {
                                const problems: string[] = [];
                                if (img.missingAlt) problems.push('missing alt text');
                                if (img.missingKeyword) problems.push('alt text missing focus keyword');
                                if (img.notNextGen) problems.push('not a next-gen format (use WebP/AVIF)');
                                if (problems.length === 0) return null;
                                return <li key={idx}><code>{img.src.split('/').pop()?.slice(0, 28) ?? `image ${idx + 1}`}</code>{' — '}{problems.join(', ')}</li>;
                            })}
                        </ul>
                    )}
                </div>
            )}

            {/* Crop step for a freshly picked file, before it ever hits the
                server. "Use original" hands the untouched File straight back. */}
            {cropFile && (
                <ImageCropper
                    files={[cropFile]}
                    onDone={(files) => {
                        setCropFile(null);
                        if (files[0]) uploadFile(files[0], uploadMode === 'cloud' ? 'cloud' : 'local');
                    }}
                    onCancel={() => setCropFile(null)}
                />
            )}
        </div>
    );
}
