'use client'
// app/admin/(protected)/myprojects/blog/comments/page.tsx

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAdmin } from '@/context/AdminContext'

type CommentUser = {
  id: number
  name: string
  email: string
  avatarUrl: string | null
  isTrusted: boolean
}

type CommentPost = {
  id: number
  title: string
  slug: string
}

type CommentItem = {
  id: number
  content: string
  status: string
  createdAt: string
  user: CommentUser
  post: CommentPost
  parent: { id: number; content: string; user: { name: string } } | null
}

const STATUS_TABS = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '',         label: 'All'      },
]

export default function AdminCommentsPage() {
  const { reloadNotifications } = useAdmin()  // ← pull from context

  const [activeStatus, setActiveStatus] = useState('pending')
  const [comments,     setComments]     = useState<CommentItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [actioningId,  setActioningId]  = useState<number | null>(null)
  const [error,        setError]        = useState('')

  const loadComments = useCallback(async (status: string) => {
    setLoading(true)
    setError('')
    try {
      const url = status
        ? `/api/admin/comments?status=${status}`
        : '/api/admin/comments'
      const res  = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not load comments.')
        setComments([])
        return
      }
      setComments(data.comments ?? [])
    } catch {
      setError('Network error loading comments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadComments(activeStatus)
  }, [activeStatus, loadComments])

  async function handleAction(commentId: number, action: 'approve' | 'reject') {
    setActioningId(commentId)
    try {
      const res = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'approve' ? 'approved' : 'rejected',
        }),
      })
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId))
      } else {
        const data = await res.json()
        setError(data.error ?? 'Action failed.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActioningId(null)
    }
  }

  async function handleDelete(commentId: number) {
    const confirmed = window.confirm(
      'Delete this comment permanently? This cannot be undone, and any replies to it will also be deleted.'
    )
    if (!confirmed) return

    setActioningId(commentId)
    try {
      const res = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        // Remove comment from UI immediately
        setComments(prev => prev.filter(c => c.id !== commentId))

        // ── KEY FIX: re-fetch notifications from server so the bell
        // count and dropdown update instantly — no page refresh needed
        await reloadNotifications()
      } else {
        const data = await res.json()
        setError(data.error ?? 'Delete failed.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className="right-content">
      <div className="content-card">
        <div className="page-header">
          <h1>Comments</h1>
          <p className="page-sub">
            Moderate comments left on blog posts. Whose comments auto-approve is
            controlled by the <b>Auto Approve Comments</b> permission (Roles / Users),
            not a per-user trust flag.
          </p>
        </div>

        {/* Tabs */}
        <div className="comment-admin-tabs">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              className={`comment-admin-tab ${activeStatus === tab.key ? 'active' : ''}`}
              onClick={() => setActiveStatus(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && <div className="admin-error-banner">{error}</div>}

        {loading ? (
          <p className="comment-admin-empty">Loading...</p>
        ) : comments.length === 0 ? (
          <p className="comment-admin-empty">No comments in this view.</p>
        ) : (
          <div className="comment-admin-list">
            {comments.map(c => (
              <div key={c.id} className="comment-admin-row">

                {/* Avatar */}
                <div className="comment-admin-avatar">
                  {c.user.avatarUrl ? (
                    <img src={c.user.avatarUrl} alt={c.user.name} />
                  ) : (
                    <span>{c.user.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Body */}
                <div className="comment-admin-main">
                  <div className="comment-admin-meta">
                    <strong>{c.user.name}</strong>
                    <span className="comment-admin-email">{c.user.email}</span>
                    <span className={`comment-admin-badge status-${c.status}`}>
                      {c.status.toUpperCase()}
                    </span>
                  </div>

                  {c.parent && (
                    <div className="comment-admin-replyctx">
                      ↩ Reply to <strong>{c.parent.user?.name ?? 'a user'}</strong>:{' '}
                      <em>
                        &ldquo;
                        {(c.parent.content ?? '').slice(0, 80)}
                        {(c.parent.content ?? '').length > 80 ? '…' : ''}
                        &rdquo;
                      </em>
                    </div>
                  )}

                  <p className="comment-admin-content">{c.content}</p>

                  <div className="comment-admin-footer">
                    <Link
                      href={`/posts/${c.post.slug}`}
                      target="_blank"
                      className="comment-admin-postlink"
                    >
                      on &ldquo;{c.post.title}&rdquo;
                    </Link>
                    <span className="comment-admin-date">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="comment-admin-actions">
                  {c.status === 'pending' && (
                    <>
                      <button
                        className="comment-admin-btn approve"
                        disabled={actioningId === c.id}
                        onClick={() => handleAction(c.id, 'approve')}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="comment-admin-btn reject"
                        disabled={actioningId === c.id}
                        onClick={() => handleAction(c.id, 'reject')}
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}
                  <button
                    className="comment-admin-btn delete"
                    disabled={actioningId === c.id}
                    onClick={() => handleDelete(c.id)}
                  >
                    🗑 Delete
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
