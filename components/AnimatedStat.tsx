'use client';

/**
 * components/AnimatedStat.tsx
 *
 * The counting number in the homepage hero ("133 Total Views").
 *
 * Two things this deliberately gets right:
 *
 * 1. SSR RENDERS THE FINAL VALUE. The first paint — and everything a crawler or
 *    a reader with JavaScript disabled ever sees — is the real number, not a
 *    zero that only becomes correct once JS runs. The count-up starts after
 *    hydration, on the next animation frame, so the swap is invisible.
 *
 * 2. IT RESPECTS prefers-reduced-motion. Counting digits are exactly the kind of
 *    movement that bothers people with vestibular disorders, and the number is
 *    the content here — the animation is decoration. When motion is reduced the
 *    value simply sits there, already correct.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
    /** The real, final number. */
    value: number;
    /** Rendered right after the number, e.g. "+". */
    suffix?: string;
    /** Show 1000+ as "1.2k", matching the previous hero formatting. */
    compact?: boolean;
    /**
     * Count-up length in ms. Paced to finish a beat after the stat has finished
     * sliding into place, so the two movements read as one gesture rather than
     * racing each other.
     */
    duration?: number;
    className?: string;
}

const format = (n: number, compact: boolean) =>
    compact && n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

// Ease-out cubic: fast at first, settling gently — reads as "counting up and
// landing" rather than a mechanical linear tick.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export default function AnimatedStat({
    value,
    suffix = '',
    compact = false,
    duration = 1900,
    className,
}: Props) {
    const [display, setDisplay] = useState(value);   // SSR + no-JS: the real number
    const frame = useRef<number | null>(null);

    useEffect(() => {
        if (!Number.isFinite(value) || value <= 0) { setDisplay(value); return; }

        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (reduced) { setDisplay(value); return; }

        let start: number | null = null;
        const step = (ts: number) => {
            if (start === null) start = ts;
            const t = Math.min(1, (ts - start) / duration);
            setDisplay(Math.round(easeOut(t) * value));
            if (t < 1) frame.current = requestAnimationFrame(step);
        };
        frame.current = requestAnimationFrame(step);

        return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
    }, [value, duration]);

    return (
        <span className={className}>
            {format(display, compact)}{suffix}
        </span>
    );
}
