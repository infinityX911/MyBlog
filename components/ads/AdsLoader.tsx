// components/ads/AdsLoader.tsx
// Loads the AdSense library once, site-wide, only when ads are enabled and a
// publisher id is set. Rendered in the blog layout.
import Script from 'next/script'
import { getAdsConfig } from '@/lib/ads'

export default async function AdsLoader({ siteKey = 'blog' }: { siteKey?: string }) {
    const ads = await getAdsConfig(siteKey)
    if (!ads.enabled || !ads.clientId) return null
    return (
        <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.clientId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
        />
    )
}
