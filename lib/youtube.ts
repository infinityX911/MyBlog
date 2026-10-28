/**
 * lib/youtube.ts
 * Reads admin-configured YouTube channels from the DB and enriches each with
 * live data (name, avatar, subscriber count) from the YouTube Data API v3.
 * Requires env YOUTUBE_API_KEY. Falls back gracefully if the key/data is missing.
 */
import { prisma } from '@/lib/prisma';

export type YtChannel = {
    id: number;
    ref: string;
    channelId: string | null;   // resolved UC… id (for the official subscribe button)
    title: string;
    thumbnail: string | null;
    subscribers: string | null;   // formatted, e.g. "1.2M"
    url: string;
    subscribeUrl: string;
};

const API = 'https://www.googleapis.com/youtube/v3/channels';

function fmtSubs(raw?: string): string | null {
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
}

async function fetchOne(ref: string, key: string): Promise<any | null> {
    const isId = /^UC[\w-]{20,}$/.test(ref);
    const param = isId
        ? `id=${encodeURIComponent(ref)}`
        : `forHandle=${encodeURIComponent(ref.startsWith('@') ? ref : '@' + ref)}`;
    const url = `${API}?part=snippet,statistics&${param}&key=${key}`;
    try {
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) {
            // LOG the real reason instead of silently swallowing it. The most
            // common failures: 400 "API key not valid", 403 "referer/IP
            // restriction" or "quota exceeded", or "API not enabled". Reading
            // this line in the server console tells you exactly what to fix in
            // Google Cloud Console.
            const body = await res.text().catch(() => '');
            console.error(`[youtube] API ${res.status} for ${ref}: ${body.slice(0, 300)}`);
            return null;
        }
        const data = await res.json();
        if (!data.items?.length) {
            console.warn(`[youtube] no channel found for "${ref}" (check the handle/ID)`);
        }
        return data.items?.[0] ?? null;
    } catch (err) {
        console.error(`[youtube] fetch failed for ${ref}:`, err);
        return null;
    }
}

/**
 * Keyless avatar fallback via unavatar.io. Lets the real channel picture show
 * even when the YouTube Data API key is missing/restricted/over-quota — so the
 * widget never has to fall back to the plain ▶ placeholder. Handle form works
 * best (strip the leading @).
 */
function avatarFallback(ref: string): string {
    const handle = ref.replace(/^@/, '');
    return `https://unavatar.io/youtube/${encodeURIComponent(handle)}`;
}

export async function getYoutubeChannels(): Promise<YtChannel[]> {
    const rows = await prisma.youtubeChannel.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    if (rows.length === 0) return [];
    const key = process.env.YOUTUBE_API_KEY;

    return Promise.all(rows.map(async (row): Promise<YtChannel> => {
        const fallbackUrl = row.channelRef.startsWith('UC')
            ? `https://www.youtube.com/channel/${row.channelRef}`
            : `https://www.youtube.com/${row.channelRef.startsWith('@') ? row.channelRef : '@' + row.channelRef}`;

        if (!key) {
            // No API key → still show the real avatar via the keyless fallback.
            return {
                id: row.id, ref: row.channelRef, channelId: row.channelRef.startsWith('UC') ? row.channelRef : null,
                title: row.label || row.channelRef, thumbnail: avatarFallback(row.channelRef), subscribers: null,
                url: fallbackUrl, subscribeUrl: `${fallbackUrl}?sub_confirmation=1`,
            };
        }

        const item = await fetchOne(row.channelRef, key);
        const cid = item?.id;
        const url = cid ? `https://www.youtube.com/channel/${cid}` : fallbackUrl;
        return {
            id: row.id,
            ref: row.channelRef,
            channelId: cid ?? (row.channelRef.startsWith('UC') ? row.channelRef : null),
            title: row.label || item?.snippet?.title || row.channelRef,
            // API avatar first; if the API call failed, fall back to the keyless
            // avatar service so the picture still shows.
            thumbnail:
                item?.snippet?.thumbnails?.medium?.url ||
                item?.snippet?.thumbnails?.default?.url ||
                avatarFallback(row.channelRef),
            subscribers: item?.statistics?.hiddenSubscriberCount ? null : fmtSubs(item?.statistics?.subscriberCount),
            url,
            subscribeUrl: `${url}?sub_confirmation=1`,
        };
    }));
}
