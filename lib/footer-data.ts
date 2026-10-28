/**
 * lib/footer-data.ts — prisma-FREE footer types, constants and defaults.
 *
 * Split out from lib/footer.ts so that CLIENT components (components/Footer.tsx)
 * can import types/labels/defaults WITHOUT pulling in prisma/mariadb (which use
 * Node built-ins like fs/net/tls and break the browser bundle).
 */

export interface FooterLink { label: string; url: string }
export interface FooterColumn { heading: string; links: FooterLink[] }
export interface FooterSocial { platform: string; url: string }
export interface FooterData {
    columns: FooterColumn[];
    socials: FooterSocial[];
    bottomText: string;
}

export const SOCIAL_PLATFORMS = [
    'github', 'twitter', 'youtube', 'facebook', 'instagram', 'linkedin', 'tiktok', 'website',
] as const;

export const SOCIAL_LABELS: Record<string, string> = {
    github: 'GitHub', twitter: 'Twitter (X)', youtube: 'YouTube', facebook: 'Facebook',
    instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', website: 'Website',
};

// Default = the original hardcoded footer, so nothing looks empty before setup.
export const DEFAULT_FOOTER: FooterData = {
    columns: [
        { heading: 'Main', links: [
            { label: 'Home', url: '/' },
            { label: 'Contact', url: '/#about' },
            { label: 'Work With Us', url: '#' },
            { label: 'My Gear', url: '#' },
        ] },
        { heading: 'Learn', links: [
            { label: 'Courses', url: '/tag/tech' },
            { label: 'Tutorials', url: '/#posts' },
            { label: 'Notes', url: '/#topics' },
        ] },
        { heading: 'Legal', links: [
            { label: 'Terms', url: '#' },
            { label: 'Privacy', url: '#' },
            { label: 'Refund', url: '#' },
        ] },
    ],
    socials: [
        { platform: 'github', url: 'https://github.com' },
        { platform: 'twitter', url: 'https://twitter.com' },
        { platform: 'youtube', url: 'https://youtube.com' },
        { platform: 'facebook', url: 'https://facebook.com' },
    ],
    bottomText: 'Made with ❤️ and ☕ for writers everywhere',
};

export function safeParse<T>(json: string | null | undefined, fallback: T): T {
    if (!json) return fallback;
    try {
        const v = JSON.parse(json);
        return (v ?? fallback) as T;
    } catch {
        return fallback;
    }
}
