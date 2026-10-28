'use client';

/**
 * components/admin/ImageCropper.tsx
 *
 * A dependency-free crop step that sits between "user picked a file" and
 * "we POST it". It hands back real `File` objects, so every existing upload
 * call site keeps working unchanged — swap `file` for the cropped one and go.
 *
 * Why hand-rolled instead of react-easy-crop / cropperjs: the whole thing is a
 * selection rect over an <img> plus one drawImage() on export. Pulling a
 * dependency in would mean a new npm install inside the Docker build for ~200
 * lines of geometry.
 *
 * Usage:
 *
 *   const [queue, setQueue] = useState<File[] | null>(null);
 *   ...
 *   <input type="file" onChange={e => setQueue([...e.target.files!])} />
 *   {queue && (
 *     <ImageCropper
 *       files={queue}
 *       aspect={1.91}                 // optional starting ratio
 *       onDone={files => { setQueue(null); upload(files); }}
 *       onCancel={() => setQueue(null)}
 *     />
 *   )}
 *
 * Notes:
 *  - Non-image files (and SVG, which has no meaningful raster crop) pass
 *    straight through untouched.
 *  - "Use original" skips one file; "Skip all" passes the rest through as-is.
 *    Cropping is always optional — nobody should be forced through a modal to
 *    upload a screenshot that is already the right size.
 *  - Export keeps PNG as PNG (screenshots stay crisp) and everything else goes
 *    to JPEG at 0.92. The server re-encodes to WebP afterwards either way.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Rect = { x: number; y: number; w: number; h: number };

type Props = {
    files: File[];
    /** Starting aspect ratio (w / h). null / undefined = free-form. */
    aspect?: number | null;
    /** Hide the ratio buttons and force `aspect` (e.g. avatars must be square). */
    lockAspect?: boolean;
    onDone: (files: File[]) => void;
    onCancel: () => void;
};

const RATIOS: { label: string; value: number | null }[] = [
    { label: 'Free', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: '1.91:1', value: 1.91 },   // Open Graph / social cards
];

/** Longest edge we will ever write out. Guards against 8000px phone photos. */
const MAX_EDGE = 4000;
/** Anything smaller than this in either axis is not worth cropping. */
const MIN_CROP = 16;

const isCroppable = (f: File) =>
    f.type.startsWith('image/') && f.type !== 'image/svg+xml' && f.type !== 'image/gif';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function ImageCropper({ files, aspect = null, lockAspect = false, onDone, onCancel }: Props) {
    const [idx, setIdx] = useState(0);
    const [out, setOut] = useState<File[]>([]);
    const [url, setUrl] = useState<string>('');
    const [nat, setNat] = useState({ w: 0, h: 0 });
    const [disp, setDisp] = useState({ w: 0, h: 0 });
    const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
    const [ratio, setRatio] = useState<number | null>(aspect);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const stageRef = useRef<HTMLDivElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    // Live drag state lives in a ref, not state — pointermove fires far too
    // often to round-trip through React on every pixel.
    const drag = useRef<{ mode: string; sx: number; sy: number; start: Rect } | null>(null);

    const file = files[idx];

    // ── Load the current file ────────────────────────────────────────────
    useEffect(() => {
        if (!file) return;
        setErr('');
        const u = URL.createObjectURL(file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [file]);

    // ── Fit the image into the stage, then seed a centred crop ───────────
    const fit = useCallback(() => {
        const stage = stageRef.current;
        const img = imgRef.current;
        if (!stage || !img || !img.naturalWidth) return;

        const availW = stage.clientWidth;
        const availH = stage.clientHeight;
        const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight, 1);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));

        setNat({ w: img.naturalWidth, h: img.naturalHeight });
        setDisp({ w, h });
        setCrop(seedCrop(w, h, ratio));
    }, [ratio]);

    useLayoutEffect(() => {
        const onResize = () => fit();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [fit]);

    // Changing the ratio re-seeds the box rather than trying to squash the
    // current one — squashing tends to land somewhere the user didn't ask for.
    useEffect(() => {
        if (disp.w) setCrop(seedCrop(disp.w, disp.h, ratio));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ratio]);

    // ── Pointer handling ─────────────────────────────────────────────────
    const onPointerDown = (mode: string) => (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        drag.current = { mode, sx: e.clientX, sy: e.clientY, start: { ...crop } };
    };

    const onStagePointerDown = (e: React.PointerEvent) => {
        // Click-drag on empty canvas draws a brand new selection.
        const box = imgRef.current?.getBoundingClientRect();
        if (!box) return;
        const x = clamp(e.clientX - box.left, 0, disp.w);
        const y = clamp(e.clientY - box.top, 0, disp.h);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        drag.current = { mode: 'new', sx: e.clientX, sy: e.clientY, start: { x, y, w: 0, h: 0 } };
        setCrop({ x, y, w: 0, h: 0 });
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.sx;
        const dy = e.clientY - d.sy;
        setCrop(applyDrag(d.mode, d.start, dx, dy, disp, ratio));
    };

    const endDrag = () => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        // A stray click (rather than a drag) would leave a 0×0 box and a
        // disabled Crop button — put a usable selection back.
        setCrop(c => (c.w < MIN_CROP || c.h < MIN_CROP ? seedCrop(disp.w, disp.h, ratio) : c));
    };

    // ── Export ───────────────────────────────────────────────────────────
    async function exportCrop(): Promise<File> {
        const img = imgRef.current!;
        const s = nat.w / disp.w;                       // display px → natural px

        let sw = Math.round(crop.w * s);
        let sh = Math.round(crop.h * s);
        const sx = clamp(Math.round(crop.x * s), 0, nat.w - 1);
        const sy = clamp(Math.round(crop.y * s), 0, nat.h - 1);
        sw = clamp(sw, 1, nat.w - sx);
        sh = clamp(sh, 1, nat.h - sy);

        // Downscale only if the crop itself is enormous.
        const shrink = Math.min(1, MAX_EDGE / Math.max(sw, sh));
        const dw = Math.max(1, Math.round(sw * shrink));
        const dh = Math.max(1, Math.round(sh * shrink));

        const canvas = document.createElement('canvas');
        canvas.width = dw;
        canvas.height = dh;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingQuality = 'high';
        // JPEG has no alpha; without this, transparent areas export as black.
        const png = file.type === 'image/png';
        if (!png) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, dw, dh);
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

        const type = png ? 'image/png' : 'image/jpeg';
        const blob: Blob = await new Promise((res, rej) => {
            canvas.toBlob(b => (b ? res(b) : rej(new Error('Could not read the cropped image.'))), type, 0.92);
        });

        const base = file.name.replace(/\.[^.]+$/, '');
        return new File([blob], `${base}-crop.${png ? 'png' : 'jpg'}`, { type, lastModified: Date.now() });
    }

    const advance = (produced: File) => {
        const next = [...out, produced];
        if (idx + 1 < files.length) {
            setOut(next);
            setIdx(idx + 1);
        } else {
            onDone(next);
        }
    };

    const handleCrop = async () => {
        setBusy(true);
        setErr('');
        try {
            advance(await exportCrop());
        } catch (e: any) {
            setErr(e?.message ?? 'Cropping failed.');
        } finally {
            setBusy(false);
        }
    };

    const handleSkipOne = () => advance(file);
    const handleSkipAll = () => onDone([...out, ...files.slice(idx)]);

    // Files we cannot crop (SVG, GIF, non-images) shouldn't stall the queue.
    useEffect(() => {
        if (file && !isCroppable(file)) handleSkipOne();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter' && !busy) handleCrop();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    if (!file) return null;

    const outW = Math.round((crop.w * nat.w) / (disp.w || 1));
    const outH = Math.round((crop.h * nat.h) / (disp.h || 1));
    const tooSmall = crop.w < MIN_CROP || crop.h < MIN_CROP;

    return (
        <div className="imgcrop-backdrop" role="dialog" aria-modal="true" aria-label="Crop image">
            <div className="imgcrop-modal">
                <div className="imgcrop-head">
                    <div>
                        <strong>Crop image</strong>
                        <span className="imgcrop-sub">
                            {files.length > 1 ? `${idx + 1} of ${files.length} — ` : ''}{file.name}
                        </span>
                    </div>
                    <button type="button" className="imgcrop-x" onClick={onCancel} aria-label="Cancel">✕</button>
                </div>

                {!lockAspect && (
                    <div className="imgcrop-ratios">
                        {RATIOS.map(r => (
                            <button
                                key={r.label}
                                type="button"
                                className={`imgcrop-chip${ratio === r.value ? ' is-on' : ''}`}
                                onClick={() => setRatio(r.value)}
                            >
                                {r.label}
                            </button>
                        ))}
                        <button type="button" className="imgcrop-chip" onClick={() => setCrop({ x: 0, y: 0, w: disp.w, h: disp.h })}>
                            Whole image
                        </button>
                    </div>
                )}

                <div className="imgcrop-stage" ref={stageRef}>
                    <div
                        className="imgcrop-canvas"
                        style={{ width: disp.w || undefined, height: disp.h || undefined }}
                        onPointerDown={onStagePointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            ref={imgRef}
                            src={url}
                            alt=""
                            draggable={false}
                            onLoad={fit}
                            style={{ width: disp.w || 'auto', height: disp.h || 'auto', display: 'block' }}
                        />
                        {disp.w > 0 && (
                            <>
                                <div className="imgcrop-shade" style={{ clipPath: shadeClip(crop, disp) }} />
                                <div
                                    className="imgcrop-box"
                                    style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                                    onPointerDown={onPointerDown('move')}
                                >
                                    <span className="imgcrop-third v1" /><span className="imgcrop-third v2" />
                                    <span className="imgcrop-third h1" /><span className="imgcrop-third h2" />
                                    {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => (
                                        <span
                                            key={h}
                                            className={`imgcrop-h imgcrop-h-${h}`}
                                            onPointerDown={onPointerDown(h)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="imgcrop-foot">
                    <span className="imgcrop-size">
                        {outW > 0 ? `${outW} × ${outH} px` : 'Drag to select an area'}
                        {nat.w > 0 && <em> · original {nat.w} × {nat.h}</em>}
                    </span>
                    {err && <span className="imgcrop-err">{err}</span>}
                    <span className="imgcrop-spacer" />
                    {files.length > 1 && (
                        <button type="button" className="btn btn-sm btn-link imgcrop-skipall" onClick={handleSkipAll} disabled={busy}>
                            Skip all
                        </button>
                    )}
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleSkipOne} disabled={busy}>
                        Use original
                    </button>
                    <button type="button" className="btn btn-sm btn-primary" onClick={handleCrop} disabled={busy || tooSmall}>
                        {busy ? 'Cropping…' : idx + 1 < files.length ? 'Crop & next' : 'Crop & use'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── geometry helpers (pure, so they're easy to reason about) ───────────── */

/** A centred box covering ~80% of the image, honouring `ratio` if given. */
function seedCrop(w: number, h: number, ratio: number | null): Rect {
    if (!w || !h) return { x: 0, y: 0, w: 0, h: 0 };
    let cw = w * 0.8;
    let ch = h * 0.8;
    if (ratio) {
        if (cw / ch > ratio) cw = ch * ratio;
        else ch = cw / ratio;
    }
    return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
}

/** Everything outside the crop box gets dimmed, via an even-odd clip path. */
function shadeClip(c: Rect, d: { w: number; h: number }) {
    const outer = `0 0, ${d.w}px 0, ${d.w}px ${d.h}px, 0 ${d.h}px`;
    const inner = `${c.x}px ${c.y}px, ${c.x}px ${c.y + c.h}px, ${c.x + c.w}px ${c.y + c.h}px, ${c.x + c.w}px ${c.y}px`;
    return `polygon(evenodd, ${outer}, 0 0, ${inner}, ${c.x}px ${c.y}px)`;
}

/**
 * Resolve a drag into a new rect, clamped to the image and (optionally) held
 * to a fixed aspect ratio.
 */
function applyDrag(
    mode: string,
    start: Rect,
    dx: number,
    dy: number,
    d: { w: number; h: number },
    ratio: number | null,
): Rect {
    if (mode === 'move') {
        return {
            ...start,
            x: clamp(start.x + dx, 0, d.w - start.w),
            y: clamp(start.y + dy, 0, d.h - start.h),
        };
    }

    if (mode === 'new') {
        const x2 = clamp(start.x + dx, 0, d.w);
        const y2 = clamp(start.y + dy, 0, d.h);
        let x = Math.min(start.x, x2);
        let y = Math.min(start.y, y2);
        let w = Math.abs(x2 - start.x);
        let h = Math.abs(y2 - start.y);
        if (ratio) {
            // Keep the corner the drag started from pinned.
            if (w / (h || 1) > ratio) w = h * ratio; else h = w / ratio;
            if (x2 < start.x) x = start.x - w;
            if (y2 < start.y) y = start.y - h;
            x = clamp(x, 0, d.w - w);
            y = clamp(y, 0, d.h - h);
        }
        return { x, y, w, h };
    }

    // Resize from an edge or corner: work in left/top/right/bottom, then
    // normalise back to x/y/w/h.
    let l = start.x;
    let t = start.y;
    let r = start.x + start.w;
    let b = start.y + start.h;

    if (mode.includes('w')) l = clamp(l + dx, 0, r - MIN_CROP);
    if (mode.includes('e')) r = clamp(r + dx, l + MIN_CROP, d.w);
    if (mode.includes('n')) t = clamp(t + dy, 0, b - MIN_CROP);
    if (mode.includes('s')) b = clamp(b + dy, t + MIN_CROP, d.h);

    let w = r - l;
    let h = b - t;

    if (ratio) {
        // Edge handles drive one axis; corners follow whichever moved more.
        const drivenByWidth = mode === 'e' || mode === 'w'
            ? true
            : mode === 'n' || mode === 's'
                ? false
                : Math.abs(dx) > Math.abs(dy);

        if (drivenByWidth) h = w / ratio; else w = h * ratio;

        // Grow away from whichever edge is anchored.
        if (mode.includes('w')) l = r - w; else if (mode.includes('e')) r = l + w;
        else { l = start.x + (start.w - w) / 2; r = l + w; }

        if (mode.includes('n')) t = b - h; else if (mode.includes('s')) b = t + h;
        else { t = start.y + (start.h - h) / 2; b = t + h; }

        // If the ratio pushed us off-canvas, shrink to fit rather than clip.
        if (l < 0 || t < 0 || r > d.w || b > d.h) {
            const scale = Math.min(1, (l < 0 ? w + l : w) / w, (t < 0 ? h + t : h) / h,
                (r > d.w ? w - (r - d.w) : w) / w, (b > d.h ? h - (b - d.h) : h) / h);
            w *= scale; h *= scale;
            l = clamp(l, 0, d.w - w);
            t = clamp(t, 0, d.h - h);
        }
        return { x: l, y: t, w, h };
    }

    return { x: l, y: t, w, h };
}
