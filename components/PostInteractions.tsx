'use client'

// components/PostInteractions.tsx

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from '@/components/PostDetail.module.css'

interface Props {
  tags: string
  title: string
  slug: string
  renderOnly: 'progressBar' | 'footer' | 'backToTop'
  /**
   * Slugs that actually have an archive page at /tag/<slug> (i.e. real
   * categories). Every tag used to be rendered as a link to /tag/<tag>, but
   * that route only serves CATEGORY slugs — any other tag was a link straight
   * to a 404. Tags not in this list now render as plain chips.
   * Omitted → nothing is linked, which is the safe default.
   */
  linkableTags?: string[]
}

/** "PHP Tutorial" → "php-tutorial" (matches the category slug format). */
function slugifyTag(s: string): string {
  return s.trim().toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function PostInteractions({ tags, title, slug, renderOnly, linkableTags }: Props) {
  const [progress,  setProgress]  = useState(0)
  const [showBack,  setShowBack]  = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [toast,     setToast]     = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)
  const viewPinged = useRef(false)

  // Split on COMMAS only. The old regex also split on whitespace, so a tag
  // like "web development" was shredded into "web" and "development" — two
  // meaningless chips, each linking to a page that doesn't exist.
  const linkable = new Set((linkableTags ?? []).map(t => t.toLowerCase()))
  const tagList = (tags ? tags.split(',') : [])
    .map(t => t.trim())
    .filter(Boolean)
    .map(label => ({ label, slug: slugifyTag(label) }))
    .filter(t => t.slug.length > 0)

  // Share/copy always happens client-side, so window.location.href is the real
  // canonical URL. The SSR fallback just avoids a hardcoded domain/path.
  const getUrl = () =>
    typeof window !== 'undefined'
      ? window.location.href
      : (process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/${slug}` : `/${slug}`)

  /* ── Scroll listener ── */
  useEffect(() => {
    if (renderOnly !== 'progressBar') return
    const onScroll = () => {
      const body  = document.body
      const html  = document.documentElement
      const total = Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight,
      ) - window.innerHeight
      setProgress(total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0)
      setShowBack(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [renderOnly])

  /* ── Count a view once per page load ── */
  // Only the single progress-bar instance fires this (the component renders
  // 3× per post), and a ref guard prevents a double-count in React StrictMode.
  useEffect(() => {
    if (renderOnly !== 'progressBar') return
    if (viewPinged.current) return
    viewPinged.current = true
    fetch(`/api/post-view/${encodeURIComponent(slug)}`, { method: 'POST' }).catch(() => {})
  }, [renderOnly, slug])

  /* ── Close share on outside click ── */
  useEffect(() => {
    if (renderOnly !== 'footer') return
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node))
        setShareOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [renderOnly])

  const copyLink = () => {
    navigator.clipboard.writeText(getUrl())
    setShareOpen(false)
    setToast(true)
    setTimeout(() => setToast(false), 2200)
  }

  /* ══════════ Progress bar ══════════ */
  if (renderOnly === 'progressBar') {
    return (
      <div
        className={styles.progressBar}
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />
    )
  }

  /* ══════════ Back to top + toast ══════════ */
  if (renderOnly === 'backToTop') {
    return (
      <>
        <button
          className={`${styles.backToTop} ${showBack ? styles.backToTopVisible : ''}`}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <div
          className={`${styles.toast} ${toast ? styles.toastVisible : ''}`}
          role="status"
          aria-live="polite"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2.5" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Link copied to clipboard
        </div>
      </>
    )
  }

  /* ══════════ Footer: tags + share ══════════ */
  return (
    <div className={styles.footerRow}>
      {/* Tags */}
      <div>
        <p className={styles.tagsLabel}>Tags</p>
        <div className={styles.tagsList}>
          {tagList.length > 0
            ? tagList.map((t) => (
                linkable.has(t.slug)
                  ? <Link key={t.slug} href={`/tag/${t.slug}`} className={styles.tag}>{t.label}</Link>
                  : <span key={t.slug} className={styles.tag}>{t.label}</span>
              ))
            : <span className={styles.tag} style={{ opacity: 0.5 }}>No tags</span>
          }
        </div>
      </div>

      {/* Share */}
      <div className={styles.shareWrapper} ref={shareRef}>
        <button
          className={styles.shareBtn}
          onClick={() => setShareOpen(v => !v)}
          aria-expanded={shareOpen}
          aria-label="Share this post"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>

        {shareOpen && (
          <div className={styles.shareDropdown} role="menu">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(getUrl())}`}
              target="_blank" rel="noopener noreferrer"
              className={styles.shareOption} role="menuitem"
              onClick={() => setShareOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Share on X
            </a>

            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getUrl())}`}
              target="_blank" rel="noopener noreferrer"
              className={styles.shareOption} role="menuitem"
              onClick={() => setShareOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Share on LinkedIn
            </a>

            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getUrl())}`}
              target="_blank" rel="noopener noreferrer"
              className={styles.shareOption} role="menuitem"
              onClick={() => setShareOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Share on Facebook
            </a>

            <button className={styles.shareOption} onClick={copyLink} role="menuitem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
              Copy link
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
