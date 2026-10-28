'use client'
// app/(blog)/contact/ContactForm.tsx
// The "Send a Message" card — the only interactive part of /contact.
// Split out of page.tsx so the page itself can be a SERVER component that
// loads its sidebar widgets (contact info / social / FAQ) from the CMS.
// All styles stay in Contact.module.css — zero global.css changes.

import { useState } from 'react'
import Link from 'next/link'
import styles from './Contact.module.css'

type Props = {
  title?: string
  subtitle?: string
}

export default function ContactForm({ title, subtitle }: Props) {
  const [form, setForm] = useState({
    name: '', email: '', subject: '', category: '', message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to send. Please try again.')
      setSubmitted(true)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.formCard}>
      {submitted ? (
        /* Success state */
        <div className={styles.successMsg}>
          <div className={styles.successIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3>Message Sent! 🎉</h3>
          <p>
            Thanks for reaching out. We&apos;ll get back to you within 24 hours.
            In the meantime, feel free to browse our latest posts.
          </p>
          <Link href="/" className={styles.submitBtn} style={{ marginTop: '8px', textDecoration: 'none', width: 'auto', padding: '10px 24px' }}>
            ← Back to Posts
          </Link>
        </div>
      ) : (
        /* Form */
        <>
          <h2 className={styles.formTitle}>{title || 'Send a Message'}</h2>
          <p className={styles.formSubtitle}>
            {subtitle || "Fill in the details below and we'll get back to you as soon as possible."}
          </p>

          <form onSubmit={handleSubmit}>
            {/* Name + Email */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="name">
                  Your Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="John Doe"
                  className={styles.formInput}
                  value={form.name}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="email">
                  Email Address *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="john@example.com"
                  className={styles.formInput}
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Category */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="category">
                Category
              </label>
              <select
                id="category"
                name="category"
                className={styles.formSelect}
                value={form.category}
                onChange={handleChange}
              >
                <option value="">Select a topic...</option>
                <option value="general">💬 General Enquiry</option>
                <option value="collaboration">🤝 Collaboration</option>
                <option value="feedback">⭐ Feedback</option>
                <option value="bug">🐛 Report a Bug</option>
                <option value="download">📥 Download Issue</option>
                <option value="other">📌 Other</option>
              </select>
            </div>

            {/* Subject */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="subject">
                Subject *
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                placeholder="What's on your mind?"
                className={styles.formInput}
                value={form.subject}
                onChange={handleChange}
              />
            </div>

            {/* Message */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="message">
                Message *
              </label>
              <textarea
                id="message"
                name="message"
                required
                placeholder="Tell us more..."
                className={styles.formTextarea}
                value={form.message}
                onChange={handleChange}
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Send Message
                </>
              )}
            </button>
          </form>
        </>
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
