// app/(blog)/contact/page.tsx
// SERVER component. The layout (hero + form column + sidebar column) is fixed,
// but every widget is now CMS-driven: create a page with the slug `contact` in
// Admin → Blog → Pages and add the Contact info / Social / FAQ (or any other
// sidebar) blocks — they render in the right column here, in your order.
// A `hero` block (badge + heading + subtext) overrides the hero copy, and any
// main block (text, posts, cards, newsletter…) renders above the form.
// If no such page exists yet, sensible defaults keep the page working as before.
// All styles in Contact.module.css — zero global.css changes.

import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import DraftPreviewBanner from '@/components/DraftPreviewBanner'
import { InlineBlocks, SidebarBlocks, SIDEBAR_TYPES } from '@/components/blocks/BlockRenderer'
import { parseBlocks, type Block } from '@/lib/page-blocks'
import { prisma } from '@/lib/prisma'
import { getSiteSetting, getPageSeo, normalizeUrl } from '@/lib/siteSettings'
import { cleanTitle } from '@/lib/seo/title'
import { robotsMeta } from '@/lib/seo/robots'
import { authOptions } from '@/lib/auth'
import styles from './Contact.module.css'
import ContactForm from './ContactForm'

export const revalidate = 300
const SITE_KEY = 'blog'
const SLUG = 'contact'

type Props = { searchParams?: Promise<{ preview?: string }> }

/** The CMS page that drives this route (may not exist — defaults are used then). */
async function getContactPage() {
    try {
        return await prisma.cmsPage.findUnique({
            where: { siteKey_slug: { siteKey: SITE_KEY, slug: SLUG } },
            include: { seo: true },
        })
    } catch (err) {
        console.error('[contact] page lookup failed', err)
        return null
    }
}

/** ?preview=1 by an admin → drafts render (same rule as the CMS catch-all). */
async function canPreviewDrafts(searchParams?: Props['searchParams']): Promise<boolean> {
    const sp = searchParams ? await searchParams : undefined
    if (sp?.preview !== '1') return false
    const session = await getServerSession(authOptions)
    const perms = ((session?.user as any)?.permissions ?? []) as string[]
    return perms.includes('access-admin-panel')
}

/** Fallback widgets — what the page shipped with before it became editable. */
function defaultBlocks(siteName: string, email: string): Block[] {
    return [
        {
            id: 'def-contact', type: 'contact', heading: 'Contact Information',
            methods: [
                { color: 'purple', icon: 'email', label: 'Email', value: email, href: `mailto:${email}`, note: 'Reply within 24 hours' },
                { color: 'green', icon: 'clock', label: 'Response Time', value: 'Within 24 hours', note: 'Mon–Fri, 9am–6pm PKT' },
                { color: 'blue', icon: 'location', label: 'Based In', value: 'Pakistan 🇵🇰', note: 'Available worldwide' },
                { color: 'orange', icon: 'tag', label: 'For Collaboration', value: email, href: `mailto:${email}`, note: 'Partnerships & write-for-us' },
            ],
        },
        {
            id: 'def-social', type: 'social', heading: `Follow ${siteName}`,
            subtext: 'Stay updated with our latest posts and resources.',
            links: [
                { icon: '𝕏', label: 'Twitter (X)', url: 'https://twitter.com' },
                { icon: '🐙', label: 'GitHub', url: 'https://github.com' },
                { icon: '▶️', label: 'YouTube', url: 'https://youtube.com' },
            ],
        },
        {
            id: 'def-faq', type: 'faq', heading: 'Quick Answers',
            items: [
                { q: `Can I write for ${siteName}?`, a: `Yes! Email us at ${email} with your topic idea and a writing sample.` },
                { q: 'Are all downloads really free?', a: '100%. No email required, no paywall. Just click and download.' },
                { q: 'How do I report a broken link?', a: 'Use the contact form above and select "Report a Bug" — we fix it within 48 hours.' },
            ],
        },
    ]
}

export async function generateMetadata(): Promise<Metadata> {
    // Three sources, in order of specificity:
    //   1. the CMS page's own SEO panel (once a `contact` page is created),
    //   2. Settings → Per-Page SEO for '/contact' — this row exists in the admin
    //      UI, and was being silently ignored here before,
    //   3. the hardcoded fallbacks below.
    const [page, settings, pageSeo] = await Promise.all([
        getContactPage(),
        getSiteSetting(SITE_KEY),
        getPageSeo(SITE_KEY, '/contact'),
    ])
    const base = normalizeUrl(settings?.websiteUrl || process.env.NEXT_PUBLIC_SITE_URL)
    const seo = page?.seo
    const siteName = settings?.siteName
    // The layout appends " | <siteName>" — drop an editor-typed duplicate.
    const title = cleanTitle(seo?.metaTitle || pageSeo?.metaTitle || page?.title || 'Contact Us', siteName)
    const description = seo?.metaDescription
        || pageSeo?.metaDescription
        || 'Have a question, idea, or just want to say hello? Send us a message — we usually reply within 24 hours.'
    const image = seo?.ogImage || pageSeo?.ogImage || undefined
    return {
        title,
        description,
        robots: robotsMeta(
            seo?.robotsIndex ?? pageSeo?.robotsIndex ?? true,
            seo?.robotsFollow ?? pageSeo?.robotsFollow ?? true,
        ),
        alternates: { canonical: seo?.canonicalUrl || pageSeo?.canonicalUrl || `${base}/contact` },
        openGraph: {
            title: cleanTitle(seo?.ogTitle || title, siteName),
            description: seo?.ogDescription || description,
            url: `${base}/contact`,
            type: 'website',
            ...(siteName ? { siteName } : {}),
            ...(image ? { images: [{ url: image }] } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: cleanTitle(seo?.twitterTitle || seo?.ogTitle || title, siteName),
            description: seo?.twitterDescription || seo?.ogDescription || description,
            ...(image ? { images: [image] } : {}),
        },
    }
}

export default async function ContactPage({ searchParams }: Props) {
    const [page, settings, preview] = await Promise.all([
        getContactPage(),
        getSiteSetting(SITE_KEY),
        canPreviewDrafts(searchParams),
    ])
    const siteName = settings?.siteName || 'us'
    const email = settings?.emailAddress || 'hello@example.com'

    // Draft pages only render for an admin with ?preview=1; otherwise defaults.
    const usePage = !!page && (page.status === 'published' || preview)
    const blocks = usePage ? parseBlocks(page!.blocks) : []
    const effective = blocks.length ? blocks : defaultBlocks(siteName, email)

    const heroBlock = effective.find(b => b.type === 'hero') as Extract<Block, { type: 'hero' }> | undefined
    const sideBlocks = effective.filter(b => SIDEBAR_TYPES.includes(b.type))
    const mainBlocks = effective.filter(b => !SIDEBAR_TYPES.includes(b.type) && b.type !== 'hero')
    const hasSidebar = sideBlocks.length > 0

    const eyebrow = heroBlock?.badge || '✉️ Get In Touch'
    const heading = heroBlock?.heading || page?.title || 'Contact Us'
    const subtext = heroBlock?.subtext
        || "Have a question, idea, or just want to say hello? We'd love to hear from you. Usually reply within 24 hours."

    return (
        <>
            <Navbar />

            <div className={styles.contactPage}>

                {/* ── Hero ── */}
                <div className={styles.hero}>
                    <div className="container-fluid">
                        <div className="row">
                            <div className="col-12 col-md-10 col-lg-7">
                                <div className={styles.heroInner} data-hero-animate>
                                    <div className={styles.heroEyebrow}>{eyebrow}</div>
                                    <h1 className={styles.heroTitle}>{heading}</h1>
                                    <p className={styles.heroSub}>{subtext}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Main layout ── */}
                <div className={styles.mainContent}>
                    <div className="container-fluid">
                        <div className="row g-4">

                            {/* ── Form column (+ any main blocks above it) ── */}
                            <div className={hasSidebar ? 'col-12 col-lg-8' : 'col-12'}>
                                {mainBlocks.length > 0 && <InlineBlocks blocks={mainBlocks} />}
                                <ContactForm />
                            </div>

                            {/* ── Sidebar column — CMS widgets, in the admin's order ── */}
                            {hasSidebar && (
                                <div className="col-12 col-lg-4">
                                    <SidebarBlocks blocks={sideBlocks} className={styles.sidebar} />
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>

            <Footer />

            {usePage && page!.status !== 'published' && <DraftPreviewBanner status={page!.status} />}
        </>
    )
}
