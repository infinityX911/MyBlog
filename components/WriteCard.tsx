'use client'
// src/components/WriteCard.tsx

import { useState, useRef } from 'react'

export default function WriteCard() {
  const [toast, setToast] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const tagRef   = useRef<HTMLInputElement>(null)
  const bodyRef  = useRef<HTMLTextAreaElement>(null)

  function publish() {
    const title = titleRef.current?.value.trim()
    const body  = bodyRef.current?.value.trim()
    if (!title) { alert('Please enter a post title.'); return }
    if (!body)  { alert('Please write something in your post.'); return }

    // In production: POST to /api/posts
    // For now: show success toast
    setToast(true)
    setTimeout(() => setToast(false), 3000)
    if (titleRef.current) titleRef.current.value = ''
    if (tagRef.current)   tagRef.current.value   = ''
    if (bodyRef.current)  bodyRef.current.value  = ''
  }

  return (
    <>
      <div className="hero-right">
        <div className="write-card">
          <div className="write-card-inner">
            <svg className="write-icon" viewBox="0 0 64 64" fill="none">
              <path d="M44 8L56 20L22 54L8 56L10 42L44 8Z" stroke="#4f5fcf" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M38 14L50 26" stroke="#4f5fcf" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M10 42L22 54" stroke="#4f5fcf" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <p className="write-hint">or click below to compose</p>

            <div className="quick-inputs">
              <input
                ref={titleRef}
                type="text"
                className="q-input q-title"
                placeholder="Post title..."
                onKeyDown={e => e.key === 'Enter' && bodyRef.current?.focus()}
              />
              <input
                ref={tagRef}
                type="text"
                className="q-input q-tag"
                placeholder="# tag  (tech, life, travel, opinion, science)"
              />
              <textarea
                ref={bodyRef}
                className="q-input q-body"
                rows={3}
                placeholder="Write your thoughts..."
              />
            </div>

            <button className="compose-btn" onClick={publish}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
              Publish Post
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${toast ? ' show' : ''}`}>🎉 Post published!</div>
    </>
  )
}
