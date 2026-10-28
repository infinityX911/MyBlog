'use client'
// components/Navbar.tsx

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import FrontUserBells from '@/components/FrontUserBells'
import BlogSearch from '@/components/BlogSearch'
import { useSiteBrand } from '@/context/SiteBrandContext'

function slugifyLabel(s: string): string {
  return (s || '').trim().toLowerCase()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Resolve a dropdown child's link. A child URL written as a bare segment
 * (e.g. "lol", no leading slash) is NESTED under its parent: the parent's own
 * path ("/tuto" → "/tuto/lol"), or — when the parent is a plain "#" dropdown —
 * a slug of the parent's label ("tuto" → "/tuto/lol"). A child URL that's
 * already absolute ("/tag/tech"), external ("https://…") or an anchor ("#…")
 * is used exactly as written, so existing dropdowns are unaffected.
 */
function navChildHref(parent: { url?: string; label?: string }, childUrl: string): string {
  const c = (childUrl || '').trim()
  if (!c) return parent?.url && parent.url !== '#' ? parent.url : '#'
  if (/^https?:\/\//i.test(c) || c.startsWith('#') || c.startsWith('/')) return c
  const purl = (parent?.url || '').trim()
  const base = (purl && purl !== '#' && purl.startsWith('/'))
    ? purl
    : `/${slugifyLabel(parent?.label || '')}`
  return `${base.replace(/\/+$/, '')}/${c.replace(/^\/+/, '')}`
}

/**
 * One collapsible group in the mobile drawer.
 *
 * The drawer used to print a dead label and then every child under it, always.
 * With two categories that merely looked odd; the moment a third or fourth is
 * added it becomes a wall of links you have to scroll past to reach Downloads
 * or Contact. So each group is closed by default.
 *
 * The single exception is the group you are already inside: opening the menu on
 * /web-development/some-lesson should show you where you are rather than making
 * you find it again. Computed once on mount, so a later tap always wins.
 */
function MobileNavGroup({
  item, pathname, onNavigate,
}: { item: any; pathname: string; onNavigate: () => void }) {
  const kids: any[] = (item.children || []).filter((c: any) => c.visible !== false)
  const [open, setOpen] = useState<boolean>(() =>
    kids.some((c: any) => {
      const href = navChildHref(item, c.url)
      return href !== '#' && (pathname === href || pathname.startsWith(`${href}/`))
    }),
  )

  return (
    <div className="cwh-mobile-group-wrap">
      <button
        type="button"
        className="cwh-mobile-link cwh-mobile-group"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{item.icon ? `${item.icon} ` : ''}{item.label}</span>
        <svg className="cwh-mobile-chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="cwh-mobile-sublist">
          {kids.map((c: any) => (
            <Link key={c.id} href={navChildHref(item, c.url)} className="cwh-mobile-link cwh-mobile-sublink" onClick={onNavigate}>
              {c.icon ? `${c.icon} ` : ''}{c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { siteName, navItems: serverNavItems } = useSiteBrand()
  const pathname = usePathname() || '/'
  const { data: session, status } = useSession()
  const [dark, setDark] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  // Seeded from the SERVER (layout → SiteBrandProvider), so the real menu is
  // present in the SSR HTML — crawlers and no-JS users see the actual links
  // instead of the hardcoded fallback further down (which points at /tag/*
  // pages that don't exist on every install).
  const initialNavItems = Array.isArray(serverNavItems)
    ? serverNavItems.filter((i: any) => i.visible !== false)
    : []
  const [navItems, setNavItems] = useState<any[]>(initialNavItems)

  // Only fetch when the server gave us nothing (older layouts / other sites
  // that don't pass navItems through the provider yet).
  useEffect(() => {
    if (initialNavItems.length > 0) return
    fetch('/api/nav-items?siteKey=blog')
      .then(r => r.ok ? r.json() : [])
      .then(d => setNavItems(Array.isArray(d) ? d.filter((i: any) => i.visible !== false) : []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNavItems.length])

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [searchOpen])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Only one slide-in panel at a time. The tutorial pages have their own left
  // rail, and on a phone the two overlap — with both open you can't tell which
  // panel a tap belongs to. They announce themselves on window and each closes
  // when the other opens. (TutorialShell holds the matching half.)
  useEffect(() => {
    const closeMe = () => setMobileOpen(false)
    window.addEventListener('ui:tutorial-rail-open', closeMe)
    return () => window.removeEventListener('ui:tutorial-rail-open', closeMe)
  }, [])

  useEffect(() => {
    if (mobileOpen) window.dispatchEvent(new CustomEvent('ui:navbar-menu-open'))
  }, [mobileOpen])

  // Close account dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const isLoggedIn = status === 'authenticated' && session?.user
  const userName = (session?.user as any)?.name ?? ''
  const userAvatar = (session?.user as any)?.avatarUrl ?? null
  const userInitial = userName.charAt(0).toUpperCase() || '?'
  const permissions = ((session?.user as any)?.permissions ?? []) as string[]
  const roles = ((session?.user as any)?.roles ?? []) as string[]
  const canAdmin = roles.includes('administrator') || permissions.includes('access-admin-panel')

  return (
    <>
      <nav className="cwh-nav">
        <div className="cwh-nav-inner">

          {/* ── LOGO (left) ── */}
          <Link href="/" className="cwh-logo">
            <span className="cwh-logo-bracket">&lt;/&gt;</span>{siteName}
          </Link>

          {/* ── DESKTOP LINKS (centre) ── admin-managed, else hardcoded ── */}
          <ul className="cwh-links">
            {navItems.length > 0 ? navItems.map((it: any) => (
              (it.children && it.children.length > 0) ? (
                <li key={it.id} className="cwh-nav-dropdown-wrap">
                  <button className="cwh-link cwh-link-dd">
                    {it.icon ? `${it.icon} ` : ''}{it.label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div className="cwh-nav-dropdown">
                    {it.children.filter((c: any) => c.visible !== false).map((c: any) => (
                      <Link key={c.id} href={navChildHref(it, c.url)} className="cwh-dropdown-item">{c.icon ? `${c.icon} ` : ''}{c.label}</Link>
                    ))}
                  </div>
                </li>
              ) : (
                <li key={it.id}><Link href={it.url} className="cwh-link">{it.icon ? `${it.icon} ` : ''}{it.label}</Link></li>
              )
            )) : (<>
            {/* Fallback — only shown when the admin navbar is empty or the DB
                read failed. Kept to routes that ALWAYS exist: the old demo
                links (/tag/tech, /tag/life, …) 404 on a site that doesn't use
                those categories, and shipping 404s in the nav of every page is
                the one thing this fallback must never do. */}
            <li><Link href="/" className="cwh-link">Home</Link></li>
            <li><Link href="/downloads" className="cwh-link">Downloads</Link></li>
            <li><Link href="/contact" className="cwh-link">Contact</Link></li>
            </>)}
          </ul>

          {/* ── DESKTOP RIGHT ── */}
          <div className="cwh-right cwh-desktop-right">
            <BlogSearch inputClassName="cwh-search" placeholder="Search posts & people..." />

            {status === 'loading' ? (
              // Loading skeleton — prevents Login/Signup flash on back navigation
              <div className="cwh-account-skeleton" />
            ) : isLoggedIn ? (
              <>
              {/* Notification + message dropdowns (logged-in only) */}
              <FrontUserBells />
              <div className="cwh-account-wrap" ref={accountRef}>
                <button className="cwh-account-btn" onClick={() => setAccountOpen(!accountOpen)}>
                  <span className="gradient-avatar-ring gradient-avatar-ring-sm">
                    {userAvatar ? (
                      <img src={userAvatar} alt={userName} className="cwh-account-avatar" onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }} />
                    ) : (
                      <span className="cwh-account-avatar-fallback">{userInitial}</span>
                    )}
                  </span>
                  <span className="cwh-account-name">{userName}</span>
                </button>
                {accountOpen && (
                  <div className="cwh-account-dropdown">
                    <div className="cwh-account-dropdown-name">{userName}</div>
                    {canAdmin && (
                      <Link href="/admin/dashboard" className="cwh-dropdown-item" onClick={() => setAccountOpen(false)}>
                        🛠️ Admin Panel
                      </Link>
                    )}
                    <Link href="/account" className="cwh-dropdown-item" onClick={() => setAccountOpen(false)}>
                      👤 My Account
                    </Link>
                    <button className="cwh-dropdown-item cwh-logout-item" onClick={() => signOut({ callbackUrl: '/' })}>
                      🚪 Log out
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : (
              <>
                <Link href="/login" className="cwh-btn-login">Login</Link>
                <Link href="/signup" className="cwh-btn-signup">Signup</Link>
              </>
            )}

            <button className="cwh-theme-btn" title="Support chat" aria-label="Support chat"
              onClick={() => window.dispatchEvent(new Event('open-support-chat'))}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </button>

            <button className="cwh-theme-btn" onClick={toggleDark} title="Toggle dark mode">
              {dark
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              }
            </button>
          </div>

          {/* ── MOBILE RIGHT: messages + notifications + search + theme + hamburger ── */}
          <div className="cwh-mobile-right">
            {/* Messages + notifications (logged-in only) — tap navigates to a
                full page on mobile instead of opening a cramped dropdown. */}
            {isLoggedIn && <FrontUserBells mobile />}

            {/* Search icon */}
            <button className="cwh-icon-btn" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>

            {/* Theme toggle */}
            <button className="cwh-icon-btn" onClick={toggleDark} aria-label="Toggle theme">
              {dark
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              }
            </button>

            {/* Hamburger */}
            <button className="cwh-icon-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>

        </div>

        {/* ── MOBILE SEARCH POPUP ── */}
        {searchOpen && (
          <div className="cwh-search-popup">
            <div className="cwh-search-popup-inner">
              <BlogSearch
                inputClassName="cwh-search-popup-input"
                placeholder="Search posts & people..."
                autoFocus
                onNavigate={() => setSearchOpen(false)}
              />
              <button className="cwh-icon-btn" onClick={() => setSearchOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── MOBILE SLIDE-IN PANEL (left side, glass effect) ── */}
      <div
        className={`cwh-mobile-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <div className={`cwh-mobile-panel ${mobileOpen ? 'open' : ''}`}>
        <div className="cwh-mobile-panel-header">
          <Link href="/" className="cwh-logo" onClick={() => setMobileOpen(false)}>
            <span className="cwh-logo-bracket">&lt;/&gt;</span>{siteName}
          </Link>
          <button className="cwh-icon-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {isLoggedIn && (
          <Link href="/account" className="cwh-mobile-panel-profile" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="cwh-mobile-avatar-ring">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="cwh-mobile-panel-avatar" />
              ) : (
                <span className="cwh-mobile-panel-avatar-fallback">{userInitial}</span>
              )}
            </div>
            <div className="cwh-mobile-panel-username">{userName}</div>
          </Link>
        )}

        {isLoggedIn && canAdmin && (
          <Link href="/admin/dashboard" className="cwh-mobile-link" onClick={() => setMobileOpen(false)} style={{ fontWeight: 700 }}>
            🛠️ Admin Panel
          </Link>
        )}

        <div className="cwh-mobile-panel-links">
          {navItems.length > 0 ? navItems.filter((it: any) => it.visible !== false).map((it: any) => (
            (it.children && it.children.length > 0) ? (
              <MobileNavGroup
                key={it.id}
                item={it}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            ) : (
              <Link key={it.id} href={it.url} className="cwh-mobile-link" onClick={() => setMobileOpen(false)}>{it.icon ? `${it.icon} ` : ''}{it.label}</Link>
            )
          )) : (
            <>
              {/* Same "never ship a 404" rule as the desktop fallback above. */}
              <Link href="/"           className="cwh-mobile-link" onClick={() => setMobileOpen(false)}>Home</Link>
              <Link href="/downloads"  className="cwh-mobile-link" onClick={() => setMobileOpen(false)}>Downloads</Link>
              <Link href="/contact"    className="cwh-mobile-link" onClick={() => setMobileOpen(false)}>Contact</Link>
            </>
          )}
        </div>

        <div className="cwh-mobile-panel-auth">
          {status === 'loading' ? (
            <div className="cwh-account-skeleton" style={{ width: '100%', height: '36px' }} />
          ) : isLoggedIn ? (
            <button
              className="cwh-btn-signup"
              style={{ width: '100%' }}
              onClick={() => { setMobileOpen(false); signOut({ callbackUrl: '/' }) }}
            >
              Log out
            </button>
          ) : (
            <>
              <Link href="/login" className="cwh-btn-login" onClick={() => setMobileOpen(false)}>Login</Link>
              <Link href="/signup" className="cwh-btn-signup" onClick={() => setMobileOpen(false)}>Signup</Link>
            </>
          )}
        </div>
      </div>
    </>
  )
}
