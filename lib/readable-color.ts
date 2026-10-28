// lib/readable-color.ts
// Pick a foreground colour that stays legible on top of an admin-chosen
// background.
//
// `themeColor` in Admin -> Settings is a free colour picker, so it can hold any
// value at all. It was set to #ffffff, and every control that painted
// `background: themeColor` with a hardcoded `color: '#fff'` turned into white
// text on a white pill and vanished. Deriving the ink from the background's
// luminance means no choice in that picker can produce an unreadable control
// again - including the next one nobody thought of.

/** Near-black ink for light backgrounds. Softer than #000, same contrast class. */
const DARK_INK = '#111827'

export type RGB = [number, number, number]

export function parseHexColor(hex?: string | null): RGB | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim())
    if (!m) return null
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** WCAG 2.1 relative luminance. 0 = black, 1 = white. */
export function luminance([r, g, b]: RGB): number {
    const channel = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/* White text beats black text while (1.05 / (L + 0.05)) > ((L + 0.05) / 0.05),
 * which crosses over at L = sqrt(0.0525) - 0.05 = 0.179. That is the switch
 * point that maximises contrast, not a value picked by eye - which matters for
 * the mid-tones where neither colour reaches 4.5:1 and the best available one
 * is all there is. */
const INK_SWITCH = 0.179

/* Above this the background is so close to white that a filled control
 * disappears into the white card behind it even with dark text on it, so it
 * needs an outline to keep its shape. */
const EDGE_NEEDED = 0.72

function rgbOf(bg?: string | null, fallback = '#5b4fcf'): RGB {
    return parseHexColor(bg) ?? parseHexColor(fallback) ?? [91, 79, 207]
}

/** Text colour to use on top of `bg`. */
export function readableOn(bg?: string | null, fallback = '#5b4fcf'): string {
    return luminance(rgbOf(bg, fallback)) > INK_SWITCH ? DARK_INK : '#ffffff'
}

/** Border for a filled control on `bg`: an outline only once it needs one. */
export function edgeOn(bg?: string | null, fallback = '#5b4fcf'): string {
    return luminance(rgbOf(bg, fallback)) > EDGE_NEEDED ? 'rgba(17,24,39,0.18)' : 'transparent'
}
