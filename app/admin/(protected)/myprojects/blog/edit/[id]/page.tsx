'use client';

/**
 * app/admin/(protected)/myprojects/blog/edit/[id]/page.tsx
 * Edit existing blog post — same professional editor as create page,
 * but loads existing data on mount and PUTs instead of POSTs on save.
 *
 * Route params: { id: string } — the numeric post ID from the DB.
 * Fetches GET /api/posts/[id] on mount, populates all fields,
 * then on save calls PUT /api/posts/[id] with the updated data.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import SeoPanel, { emptySeo, SeoData } from '@/components/admin/blog/SeoPanel';
import PostEditor from '@/components/admin/PostEditor';
import FeaturedVisual from '@/components/admin/FeaturedVisual';
import { ScheduleField, defaultScheduleLocal, isoToLocalInput, localInputToIso, type PublishStatus } from '@/components/admin/PublishSchedule';

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
    longSentences: number;
    readMinutes: number;
    readability: number;
};

function computeStats(html: string): ContentStats {
    if (!html) {
        return { words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0, paragraphs: 0, avgSentenceLength: 0, longSentences: 0, readMinutes: 1, readability: 0 };
    }
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;

    const CODE_EXT_PLACEHOLDER = '\u0000DOT\u0000';
    const maskedText = text.replace(
        /\.(js|jsx|ts|tsx|json|css|scss|html|md|mjs|cjs|env|yml|yaml|config)\b/gi,
        (_, ext) => `${CODE_EXT_PLACEHOLDER}${ext}`
    );
    const sentenceMatches = (maskedText.match(/[^.!?]+[.!?]+/g) || (maskedText ? [maskedText] : []))
        .map(s => s.replace(new RegExp(CODE_EXT_PLACEHOLDER, 'g'), '.'));
    const sentences = sentenceMatches.length;
    const longSentences = sentenceMatches.filter(s => s.trim().split(/\s+/).filter(Boolean).length > 20).length;

    const paragraphs = html
        .replace(/<\/(p|h[1-6]|blockquote|pre|li|div)>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .split(/\n+/)
        .filter(s => s.trim().length > 0).length;

    const avgSentenceLength = sentences > 0 ? Math.round(words / sentences) : 0;
    const readMinutes = Math.max(1, Math.ceil(words / 200));

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

function EditPost() {
    const router = useRouter();
    const params = useParams();
    const postId = params?.id as string;
    const { data: session } = useSession();

    const editorRef = useRef<HTMLDivElement>(null);
    const linkInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const savedRangeRef = useRef<Range | null>(null);

    // ── Loading state ────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // ── Post fields ──────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [featuredImage, setFeaturedImage] = useState('');
    const [gradient, setGradient] = useState('');
    const [status, setStatus] = useState<PublishStatus>('draft');
    const [scheduledLocal, setScheduledLocal] = useState('');
    const [seo, setSeo] = useState<SeoData>(emptySeo());
    const [saving, setSaving] = useState(false);

    const [publishedAt, setPublishedAt] = useState<string>('');
    const [content, setContent] = useState('');
    // Site settings from DB — used by SeoPanel for correct schema publisher name
    // and canonical URL base (avoids "Admin Panel" / localhost in schema output).
    const [siteName, setSiteName] = useState('');
    const [siteUrl, setSiteUrl] = useState('');
    const [stats, setStats] = useState<ContentStats>(computeStats(''));
    const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
    const [currentBlock, setCurrentBlock] = useState<BlockTag>('p');
    const [linkUrl, setLinkUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);

    // ── Image upload state ───────────────────────────────────────────
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

    // ── Load existing post on mount ──────────────────────────────────
    useEffect(() => {
        if (!postId) return;

        // Fetch site settings for SeoPanel (publisher name + canonical base URL).
        // Runs in parallel with post fetch — does not block the editor from loading.
        fetch('/api/settings')
            .then(r => r.ok ? r.json() : [])
            .then((all: any[]) => {
                const blog = all.find((s: any) => s.siteKey === 'blog');
                if (blog) {
                    setSiteName(blog.siteName ?? '');
                    setSiteUrl(blog.websiteUrl ?? '');
                }
            })
            .catch(() => { /* site settings optional — schema falls back gracefully */ });

        Promise.all([
            fetch(`/api/posts/${postId}`).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)),
            fetch('/api/categories').then(r => r.ok ? r.json() : []),
        ])
            .then(([post, cats]) => {
                // Populate all fields from DB
                setTitle(post.title ?? '');
                setSlug(post.slug ?? '');
                setExcerpt(post.excerpt ?? '');
                setFeaturedImage(post.featuredImage ?? '');
                setGradient(post.gradient ?? '');
                setStatus(['draft', 'scheduled', 'published'].includes(post.status) ? post.status : 'draft');
                setScheduledLocal(isoToLocalInput(post.scheduledAt));
                // Store original publish date so schema auto-generate uses it
                // instead of today's date (which would be wrong for old posts).
                if (post.publishedAt) setPublishedAt(post.publishedAt);

                // Populate SEO — map DB field names to SeoData type.
                // IMPORTANT: DB may store noIndex/noFollow (old naming) or
                // robotsIndex/robotsFollow (current naming) — handle both.
                const s = post.seo ?? {};
                setSeo({
                    focusKeyword:       s.focusKeyword       ?? '',
                    metaTitle:          s.metaTitle          ?? '',
                    metaDescription:    s.metaDescription    ?? '',
                    canonicalUrl:       s.canonicalUrl       ?? '',
                    ogTitle:            s.ogTitle            ?? '',
                    ogDescription:      s.ogDescription      ?? '',
                    ogImage:            s.ogImage            ?? '',
                    twitterTitle:       s.twitterTitle       ?? '',
                    twitterDescription: s.twitterDescription ?? '',
                    // robotsIndex/robotsFollow — support both old (noIndex/noFollow)
                    // and current field names so existing posts load correctly.
                    robotsIndex:  s.robotsIndex  ?? (s.noIndex  !== undefined ? !s.noIndex  : true),
                    robotsFollow: s.robotsFollow ?? (s.noFollow !== undefined ? !s.noFollow : true),
                    // schemaJson — support old customJsonLd field name too
                    schemaJson:   s.schemaJson   ?? s.customJsonLd ?? '',
                    schemaType:   s.schemaType   ?? 'BlogPosting',
                });

                // Set content — wait for editorRef to be ready
                const html = post.content ?? '';
                setContent(html);
                setStats(computeStats(html));

                // Categories
                const allCats = Array.isArray(cats) ? cats : [];
                setCategories(allCats);
                const postCatIds = (post.categories ?? []).map((c: any) => c.id ?? c);
                setSelectedCategoryIds(postCatIds);
                setPrimaryCategoryId(
                    (post.primaryCategoryId && postCatIds.includes(post.primaryCategoryId))
                        ? post.primaryCategoryId
                        : (postCatIds[0] ?? null)
                );
            })
            .catch(err => setLoadError(String(err)))
            .finally(() => {
                setLoading(false);
                setCategoriesLoading(false);
            });
    }, [postId]);

    // ── Inject content into editor once loading is done ──────────────
    // We can't set innerHTML during loading because editorRef isn't
    // mounted yet. This effect runs after loading = false, when the
    // editor div is visible in the DOM.
    useEffect(() => {
        if (!loading && editorRef.current && content) {
            editorRef.current.innerHTML = content;
        }
    }, [loading]); // only run once when loading transitions false

    // ── Selection persistence ────────────────────────────────────────
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
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'blockquote' || tag === 'pre') {
            setCurrentBlock(tag as BlockTag);
        } else {
            setCurrentBlock('p');
        }
    }, [getCurrentBlockElement]);

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

    useEffect(() => {
        scanImageIssues(editorRef.current?.innerHTML ?? '', seo.focusKeyword);
    }, [seo.focusKeyword]);

    useEffect(() => {
        const handler = () => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
                updateToolbarState();
                saveSelection();
            }
        };
        document.addEventListener('selectionchange', handler);
        return () => document.removeEventListener('selectionchange', handler);
    }, [updateToolbarState, saveSelection]);

    const runInlineCommand = (cmd: string) => {
        editorRef.current?.focus();
        restoreSelection();
        document.execCommand(cmd, false);
        handleEditorInput();
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

        if (range.collapsed) {
            const block = resolveBlock(range.startContainer);
            return block ? [block] : [];
        }

        const candidates = Array.from(editorRef.current.querySelectorAll('p, h1, h2, h3, blockquote, pre, li')) as HTMLElement[];
        const touched = candidates.filter(el => range.intersectsNode(el));
        if (touched.length > 0) return touched;

        const startBlock = resolveBlock(range.startContainer);
        return startBlock ? [startBlock] : [];
    }, []);

    const applyBlockFormat = (tag: BlockTag) => {
        editorRef.current?.focus();
        restoreSelection();
        const blocks = getSelectedBlockElements();

        // ── Code block: MERGE the whole selection into ONE <pre> ──────────────
        // Build code text from the SELECTION, converting <br> and every block
        // boundary (incl. the <div>s contentEditable wraps pasted lines in) into
        // real newlines, then replace the selection with a single <pre>.
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
            document.execCommand('formatBlock', false, tag);
        }
        handleEditorInput();
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Code block (PRE) Enter handling — Enter inserts a newline inside the
        // block; Enter on an empty line exits into a fresh paragraph so you
        // never get trapped. Shift+Enter always newline.
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

    const applyColor = (color: string) => {
        editorRef.current?.focus();
        restoreSelection();
        try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* ignore */ }
        document.execCommand('foreColor', false, color);
        handleEditorInput();
    };

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

    const insertImageIntoEditor = (url: string) => {
        editorRef.current?.focus();
        restoreSelection();
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.loading = 'lazy';
        img.style.width = '100%';
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
            formData.append('mode', mode);
            const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
            let data: any = null;
            try { data = await res.json(); } catch {
                throw new Error(`Server returned a non-JSON response (HTTP ${res.status}).`);
            }
            if (!res.ok) throw new Error(data?.error ?? `Upload failed (HTTP ${res.status})`);
            if (!data?.url) throw new Error('Upload succeeded but no file URL was returned.');
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
        e.target.value = '';
    };

    const generateAltText = async () => {
        if (!lastInsertedImg) return;
        setGeneratingAlt(true);
        setUploadError('');
        try {
            const res = await fetch('/api/generate-alt-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: lastInsertedImg.src, provider: visionProvider, focusKeyword: seo.focusKeyword }),
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
        if (lastInsertedImg) { lastInsertedImg.alt = altDraft; handleEditorInput(); }
    };

    const handleImgWidthChange = (percent: number) => {
        setImgWidthPercent(percent);
        if (lastInsertedImg) { lastInsertedImg.style.width = `${percent}%`; handleEditorInput(); }
    };

    const toggleCategory = (id: number) => {
        setSelectedCategoryIds(prev => {
            const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
            setPrimaryCategoryId(p => (p && next.includes(p)) ? p : (next[0] ?? null));
            return next;
        });
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        // Don't auto-regenerate slug on edit — slug change would break existing URLs
    };

    // ── Save (PUT) ───────────────────────────────────────────────────
    async function handleSubmit() {
        if (!title.trim()) { alert('Please enter a post title.'); return; }
        setSaving(true);
        const finalContent = editorRef.current?.innerHTML ?? content;
        try {
            const result = await fetch(`/api/posts/${postId}`, {
                method: 'PATCH',
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
            alert(`Failed to save: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    // Save the current changes, then open the public page in admin-only preview
    // mode (?preview=1) in a new tab — works even while the post is a draft.
    async function handlePreview() {
        if (!title.trim()) { alert('Please enter a post title first.'); return; }
        setSaving(true);
        const finalContent = editorRef.current?.innerHTML ?? content;
        try {
            const result = await fetch(`/api/posts/${postId}`, {
                method: 'PATCH',
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
            const catSlug = (categories.find(c => c.id === (primaryCategoryId ?? selectedCategoryIds[0])) as any)?.slug ?? 'uncategorized';
            window.open(`/${catSlug}/${slug}?preview=1`, '_blank', 'noopener');
        } catch (error: any) {
            alert(`Failed: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    const issueCount = imageIssues.filter(i => i.missingAlt || i.missingKeyword || i.notNextGen).length;

    // ── Loading / error states ────────────────────────────────────────
    if (loading) {
        return (
            <Container fluid className="right-content">
                <HeaderPanel
                    title="Edit Post"
                    breadcrumbs={[
                        { label: 'Home', path: '/' },
                        { label: 'Dashboard', path: '/admin/dashboard' },
                        { label: 'Blog', path: '/admin/myprojects/blog' },
                        { label: 'Edit Post', path: '#' },
                    ]}
                />
                <div className="card shadow border-0 p-4 mt-2 text-center">
                    <div className="para" style={{ opacity: 0.6 }}>Loading post...</div>
                </div>
            </Container>
        );
    }

    if (loadError) {
        return (
            <Container fluid className="right-content">
                <HeaderPanel
                    title="Edit Post"
                    breadcrumbs={[
                        { label: 'Home', path: '/' },
                        { label: 'Dashboard', path: '/admin/dashboard' },
                        { label: 'Blog', path: '/admin/myprojects/blog' },
                        { label: 'Edit Post', path: '#' },
                    ]}
                />
                <div className="card shadow border-0 p-4 mt-2">
                    <p className="text-danger">Failed to load post: {loadError}</p>
                    <button className="btn btn-secondary btn-sm" onClick={() => router.push('/admin/myprojects/blog')}>
                        ← Back to posts
                    </button>
                </div>
            </Container>
        );
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Edit Post"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Edit Post', path: '#' },
                ]}
            />

            <Row>
                {/* Main editor column */}
                <Col xs={12} lg={8}>
                    <div className="card shadow border-0 p-3 mt-1 blog-editor-card">

                        {/* ── Title + Slug ─────────────────────────── */}
                        <div className="form-group para mb-3 blog-title-block">
                            <label className="blog-field-label">Post Title</label>
                            <input
                                type="text"
                                className="blog-title-input"
                                value={title}
                                onChange={handleTitleChange}
                                placeholder="Enter post title..."
                            />
                            <div className="blog-slug-row">
                                <span className="blog-slug-label">Slug:</span>
                                <span className="blog-slug-prefix">/{(categories.find(c => c.id === (primaryCategoryId ?? selectedCategoryIds[0])) as any)?.slug ?? 'uncategorized'}/</span>
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

                        <SeoPanel
                            seo={seo}
                            onChange={setSeo}
                            postTitle={title}
                            postContent={content}
                            postSlug={slug}
                            postAuthor={session?.user?.name ?? ''}
                            postPublishedAt={publishedAt}
                            siteName={siteName}
                            siteUrl={siteUrl}
                            postCategory={categories.find(c => selectedCategoryIds.includes(c.id))?.name ?? ''}
                            urlBasePath={(categories.find(c => c.id === (primaryCategoryId ?? selectedCategoryIds[0])) as any)?.slug ?? 'uncategorized'}
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
                                    <button key={s} type="button"
                                        onClick={() => {
                                            setStatus(s);
                                            // Never leave "scheduled" without a time —
                                            // the API would quietly downgrade it to draft.
                                            if (s === 'scheduled' && !scheduledLocal) setScheduledLocal(defaultScheduleLocal());
                                        }}
                                        className={`blog-status-btn ${s} ${status === s ? 'active' : ''}`}>
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

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary flex-fill" onClick={handleSubmit} disabled={saving}>
                                {saving ? 'Saving...' : 'Update Post'}
                            </button>
                            <button className="btn btn-outline-secondary"
                                onClick={() => router.push('/admin/myprojects/blog')}
                                disabled={saving}>
                                Cancel
                            </button>
                        </div>
                        <button type="button" className="btn btn-outline-secondary w-100 mt-2"
                            onClick={handlePreview} disabled={saving}
                            title="Save changes and preview how it will look — without publishing">
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
                                    URL: <code>/{(categories.find(c => c.id === (primaryCategoryId ?? selectedCategoryIds[0])) as any)?.slug ?? 'uncategorized'}/{slug || 'your-slug'}</code>
                                </small>
                            </div>
                        )}
                    </div>

                    {/* Quick preview link */}
                    {slug && (
                        <div className="card shadow border-0 p-3 mt-2">
                            <h5 className="hd mb-2">Preview</h5>
                            <a
                                href={`/posts/${slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline-primary btn-sm w-100"
                            >
                                🔗 View live post ↗
                            </a>
                        </div>
                    )}
                </Col>
            </Row>
        </Container>
    );
}

export default EditPost;
