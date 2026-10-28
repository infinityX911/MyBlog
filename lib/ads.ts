// lib/ads.ts
// Admin-controlled Google AdSense config (per site). The publisher loads the
// AdSense script once (site-wide) and pastes ad-unit code for named positions.
// All server-only; the public site just renders the codes the admin saved.
import { getSiteSetting } from '@/lib/siteSettings'

export type AdPosition = 'afterHero' | 'midArticle' | 'inline' | 'sidebar' | 'footer' | 'betweenPosts'
export const AD_POSITIONS: AdPosition[] = ['afterHero', 'midArticle', 'inline', 'sidebar', 'footer', 'betweenPosts']

export interface AdsConfig {
    enabled: boolean
    clientId: string          // ca-pub-XXXXXXXXXXXXXXXX
    slots: Record<AdPosition, string>   // each = the ad-unit HTML pasted from AdSense
}

const EMPTY_SLOTS: Record<AdPosition, string> = {
    afterHero: '', midArticle: '', inline: '', sidebar: '', footer: '', betweenPosts: '',
}

export function parseAdSlots(raw: string | null | undefined): Record<AdPosition, string> {
    if (!raw) return { ...EMPTY_SLOTS }
    try {
        const v = JSON.parse(raw)
        return { ...EMPTY_SLOTS, ...(v && typeof v === 'object' ? v : {}) }
    } catch { return { ...EMPTY_SLOTS } }
}

/** Load the site's ads config (defaults to disabled/empty). */
export async function getAdsConfig(siteKey = 'blog'): Promise<AdsConfig> {
    const s = await getSiteSetting(siteKey)
    return {
        enabled: (s as any)?.adsEnabled === true,
        clientId: ((s as any)?.adsClientId ?? '').trim(),
        slots: parseAdSlots((s as any)?.adsSlots),
    }
}
