// components/AuthorCard.tsx
// The site's author/brand card, driven by Admin → Settings (name, photo, bio,
// link). One source of truth used by the post sidebar, download sidebar, tag
// page, and the "Author" page block — so there's no hardcoded "F" anywhere.
import { getSiteSetting } from '@/lib/siteSettings'
import { readableOn, edgeOn } from '@/lib/readable-color'

const FALLBACK_NAME = 'Flow'
const FALLBACK_BIO = 'Turning curiosity into tutorials and stories about code & tech.'

export default async function AuthorCard() {
    const s = await getSiteSetting('blog')
    if ((s?.authorEnabled ?? true) === false) return null
    const name = s?.authorName?.trim() || FALLBACK_NAME
    const img = s?.authorImage?.trim() || ''
    const bio = s?.authorBio?.trim() || FALLBACK_BIO
    const theme = s?.themeColor?.trim() || '#5b4fcf'
    // themeColor is a free colour picker, so it can be any value - it was
    // #ffffff, which painted this card's 'Visit' pill as white on white and
    // made it disappear. Derive the ink rather than assume a dark pick.
    const onTheme = readableOn(theme)
    const themeEdge = edgeOn(theme)
    const link = s?.authorLink?.trim() || ''
    const ext = /^https?:\/\//i.test(link) && !/localhost/i.test(link)

    const inner = (
        <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
                {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={name} referrerPolicy="no-referrer" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', boxShadow: `0 0 0 4px ${theme}22, 0 6px 16px rgba(0,0,0,0.12)` }} />
                ) : (
                    <div style={{ width: 84, height: 84, borderRadius: '50%', boxShadow: `0 0 0 4px ${theme}22, 0 6px 16px rgba(0,0,0,0.12)`, background: theme, color: onTheme, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 32 }}>{name.charAt(0).toUpperCase()}</div>
                )}
            </div>
            <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{name}</p>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.7 }}>{bio}</p>
            {link && (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '8px 18px', borderRadius: 999, background: theme, color: onTheme, border: `1px solid ${themeEdge}`, fontSize: 12.5, fontWeight: 700 }}>{ext ? 'Visit' : 'View profile'}<span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>→</span></span>)}
        </div>
    )

    return link
        ? <a href={link} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="sidebar-box author-card-link" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>{inner}</a>
        : <div className="sidebar-box">{inner}</div>
}
