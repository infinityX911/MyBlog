'use client'
// components/ReadingProgressBar.tsx
// A thin fixed bar at the very top that fills as the reader scrolls down and
// shrinks as they scroll up. Standalone (no view-tracking side effects), so it
// can be dropped on ANY page — listings, tag pages, CMS pages, etc.

import { useEffect, useState } from 'react'
import styles from './PostDetail.module.css'

export default function ReadingProgressBar() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const body = document.body
      const html = document.documentElement
      const total = Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight,
      ) - window.innerHeight
      setProgress(total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  return <div className={styles.progressBar} style={{ width: `${progress}%` }} aria-hidden="true" />
}
