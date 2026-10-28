'use client'
// components/ads/AdUnit.tsx
// Renders one ad — works with AdSense AND any other ad network.
//
//  • AdSense (code contains an <ins class="adsbygoogle">): render the <ins>,
//    strip its inline push script (React won't run it), and call the push
//    ourselves — which activates the unit.
//  • Any other network (Media.net, Ezoic, a raw <script> tag, etc.): inject the
//    HTML AND actually EXECUTE its <script> tags by re-creating them as real DOM
//    nodes (React's dangerouslySetInnerHTML does not run injected scripts).
//
// Ad codes are admin-only (set in Blog → Ads or the Ad block), so this trusted
// input is intentionally allowed to run its scripts.
import { useEffect, useRef } from 'react'

export default function AdUnit({ code }: { code: string }) {
    const ref = useRef<HTMLDivElement>(null)
    const raw = (code || '').trim()
    const isAdSense = /class=["'][^"']*\badsbygoogle\b/.test(raw)

    useEffect(() => {
        if (isAdSense) {
            try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}) } catch { /* not loaded yet */ }
            return
        }
        // Other networks: set the HTML, then re-create <script> tags so they run.
        const el = ref.current
        if (!el || !raw) return
        el.innerHTML = raw
        el.querySelectorAll('script').forEach((old) => {
            const s = document.createElement('script')
            for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value)
            s.text = old.textContent || ''
            old.parentNode?.replaceChild(s, old)
        })
    }, [raw, isAdSense])

    if (!raw) return null

    // AdSense: render the <ins> (script stripped) via React. Other networks are
    // injected+executed in the effect above, so start with an empty container.
    if (isAdSense) {
        const clean = raw.replace(/<script[\s\S]*?<\/script>/gi, '').trim()
        return <div className="ad-slot" dangerouslySetInnerHTML={{ __html: clean }} />
    }
    return <div className="ad-slot" ref={ref} />
}
