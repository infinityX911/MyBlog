// components/ads/AdSlot.tsx
// Server component: renders the ad-unit configured for a named position, but
// only when ads are enabled and that slot has code. Drop <AdSlot position="…" />
// anywhere in a server component (post hero, sidebar, footer, between sections).
import { getAdsConfig, type AdPosition } from '@/lib/ads'
import AdUnit from './AdUnit'

export default async function AdSlot({ position, siteKey = 'blog' }: { position: AdPosition; siteKey?: string }) {
    const ads = await getAdsConfig(siteKey)
    if (!ads.enabled) return null
    const code = ads.slots[position]
    if (!code || !code.trim()) return null
    return <div className="ad-slot-wrap"><AdUnit code={code} /></div>
}
