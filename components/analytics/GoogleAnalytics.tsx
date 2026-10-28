'use client'
// components/analytics/GoogleAnalytics.tsx
// Loads the GA4 gtag.js tracking tag on the PUBLIC site so Google Analytics
// actually collects pageviews/visitors. Without this, the GA Data API (admin
// dashboard) has no data to read. Renders nothing unless NEXT_PUBLIC_GA_ID is set.
import Script from 'next/script'

export default function GoogleAnalytics({ gaId }: { gaId?: string }) {
    if (!gaId) return null
    return (
        <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="lazyOnload" />
            <Script id="ga4-init" strategy="lazyOnload">
                {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
        </>
    )
}
