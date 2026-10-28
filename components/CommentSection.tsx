'use client'
// components/CommentSection.tsx
//
// Comment box for a single post. Login required to comment (per spec —
// no guest comments). First comment from a new user goes to "pending"
// until an admin approves it once; after that the user is "trusted"
// and future comments auto-approve. Supports one level of replies.

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { io } from 'socket.io-client'
import Link from 'next/link'
import MentionInput from '@/components/MentionInput'
import { tokenizeMentions, type PickedMention } from '@/lib/mentions'

// Render comment text: turn @[Name](id) mention tokens into profile links.
function renderCommentContent(text: string): React.ReactNode {
  const re = /@\[([^\]]+)\]\((\d+)\)/g
  const out: React.ReactNode[] = []
  let last = 0, key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <Link key={key++} href={`/u/${m[2]}`} className="comment-mention">@{m[1]}</Link>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

type CommentUser = {
  id: number
  name: string
  avatarUrl: string | null
}

type Reaction = { userId: number; type: string }

type CommentItem = {
  id: number
  content: string
  createdAt: string
  status: string
  user: CommentUser
  reactions?: Reaction[]
  replies: CommentItem[]
}

function ReactionBar({
  commentId,
  reactions,
  currentUserId,
}: {
  commentId: number
  reactions: Reaction[]
  currentUserId: number | null
}) {
  const compute = (rs: Reaction[]) => {
    const counts: Record<string, number> = { like: 0, heart: 0 }
    const mine: Record<string, boolean> = { like: false, heart: false }
    rs.forEach((r) => {
      counts[r.type] = (counts[r.type] ?? 0) + 1
      if (currentUserId && r.userId === currentUserId) mine[r.type] = true
    })
    return { counts, mine }
  }
  const initial = compute(reactions ?? [])
  const [counts, setCounts] = useState(initial.counts)
  const [mine, setMine] = useState(initial.mine)
  const [busy, setBusy] = useState(false)

  async function react(type: 'like' | 'heart') {
    if (!currentUserId || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/comments/${commentId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (res.ok) { setCounts(data.counts); setMine(data.mine) }
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const btn = (active: boolean, activeColor: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: 'transparent', border: 'none', cursor: currentUserId ? 'pointer' : 'default',
    fontSize: 13, padding: '4px 6px', borderRadius: 6,
    color: active ? activeColor : '#8a8f9c', fontWeight: active ? 700 : 500,
  })

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
      <button type="button" style={btn(mine.like, '#0858f7')} onClick={() => react('like')}
        disabled={!currentUserId} title={currentUserId ? 'Like' : 'Log in to react'}>
        <span style={{ fontSize: 15 }}>👍</span> {counts.like || 0}
      </button>
      <button type="button" style={btn(mine.heart, '#e0245e')} onClick={() => react('heart')}
        disabled={!currentUserId} title={currentUserId ? 'Heart' : 'Log in to react'}>
        <span style={{ fontSize: 15 }}>❤️</span> {counts.heart || 0}
      </button>
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Avatar({ user }: { user: CommentUser }) {
  const initial = user.name.charAt(0).toUpperCase() || '?'
  const inner = user.avatarUrl
    ? <img src={user.avatarUrl} alt={user.name} className="comment-avatar" />
    : <span className="comment-avatar-fallback">{initial}</span>
  // Click the avatar to visit the commenter's public profile (by id).
  return (
    <Link href={`/u/${user.id}`} title={`View ${user.name}'s profile`} style={{ display: 'inline-flex' }}>
      {inner}
    </Link>
  )
}

function CommentRow({
  comment,
  target,
  onReplySubmitted,
}: {
  comment: CommentItem
  target: { postId?: number; downloadId?: number }
  onReplySubmitted: () => void
}) {
  const { data: session, status } = useSession()
  const currentUserId = (session?.user as any)?.id ? Number((session!.user as any).id) : null
  const perms = ((session?.user as any)?.permissions ?? []) as string[]
  const canModerate = perms.includes('delete-comments') || perms.includes('access-admin-panel')
  async function deleteComment(id: number) {
    if (!window.confirm('Delete this comment?')) return
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      if (res.ok) { onReplySubmitted() }
      else { const d = await res.json().catch(() => ({})); alert(d.error || 'Could not delete.') }
    } catch { alert('Network error.') }
  }
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyMentions, setReplyMentions] = useState<PickedMention[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [justSubmitted, setJustSubmitted] = useState(false)

  async function submitReply() {
    setError('')
    const trimmed = replyText.trim()
    if (trimmed.length < 2) {
      setError('Reply is too short.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, parentId: comment.id, content: tokenizeMentions(trimmed, replyMentions) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not post your reply.')
        setSubmitting(false)
        return
      }
      setReplyText('')
      setReplyMentions([])
      setReplying(false)
      // Only show the "awaiting approval" note if it's actually pending.
      // Trusted users auto-approve, so their reply appears immediately.
      setJustSubmitted(data.comment?.status !== 'approved')
      onReplySubmitted()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="comment-row">
      <Avatar user={comment.user} />
      <div className="comment-body">
        <div className="comment-meta">
          <span className="comment-author">{comment.user.name}</span>
          <span className="comment-time">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="comment-text">{renderCommentContent(comment.content)}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ReactionBar commentId={comment.id} reactions={comment.reactions ?? []} currentUserId={currentUserId} />
          {status === 'authenticated' && (
            <button className="comment-reply-btn" onClick={() => {
              const opening = !replying
              setReplying(opening)
              // Prefill @author like YouTube/Facebook when opening a fresh reply.
              if (opening && !replyText.trim()) {
                setReplyText(`@${comment.user.name} `)
                setReplyMentions([{ id: comment.user.id, name: comment.user.name }])
              }
            }}>
              {replying ? 'Cancel' : 'Reply'}
            </button>
          )}
          {(comment.user.id === currentUserId || canModerate) && (
            <button className="comment-reply-btn" onClick={() => deleteComment(comment.id)} style={{ color: '#dc2626' }}>
              Delete
            </button>
          )}
        </div>

        {justSubmitted && (
          <p className="comment-pending-note">Your reply is awaiting approval and will appear once reviewed.</p>
        )}

        {replying && (
          <div className="comment-reply-form">
            <MentionInput
              value={replyText}
              onChange={setReplyText}
              onPickMention={(m) => setReplyMentions((prev) => [...prev, m])}
              placeholder={`Reply to ${comment.user.name}...`}
              maxLength={2000}
              rows={2}
            />
            {error && <p className="comment-error">{error}</p>}
            <button className="comment-submit-btn" onClick={submitReply} disabled={submitting}>
              {submitting ? 'Posting...' : 'Post reply'}
            </button>
          </div>
        )}

        {comment.replies.length > 0 && (
          <div className="comment-replies">
            {comment.replies.map((r) => (
              <div key={r.id} className="comment-row comment-row-reply">
                <Avatar user={r.user} />
                <div className="comment-body">
                  <div className="comment-meta">
                    <span className="comment-author">{r.user.name}</span>
                    <span className="comment-time">{timeAgo(r.createdAt)}</span>
                  </div>
                  <p className="comment-text">{renderCommentContent(r.content)}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <ReactionBar commentId={r.id} reactions={r.reactions ?? []} currentUserId={currentUserId} />
                    {(r.user.id === currentUserId || canModerate) && (
                      <button className="comment-reply-btn" onClick={() => deleteComment(r.id)} style={{ color: '#dc2626' }}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CommentSection({ postId, downloadId, cmsPageId, announcementId }: { postId?: number; downloadId?: number; cmsPageId?: number; announcementId?: number }) {
  const target = cmsPageId ? { cmsPageId } : downloadId ? { downloadId } : announcementId ? { announcementId } : { postId }
  const query = cmsPageId ? `cmsPageId=${cmsPageId}` : downloadId ? `downloadId=${downloadId}` : announcementId ? `announcementId=${announcementId}` : `postId=${postId}`
  const { data: session, status } = useSession()
  const [comments, setComments] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [mentions, setMentions] = useState<PickedMention[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [justSubmitted, setJustSubmitted] = useState(false)

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?${query}`)
      const data = await res.json()
      setComments(data.comments ?? [])
    } catch {
      // Silently fail — comments are non-critical to page function.
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  // Real-time: subscribe to this target's public comment feed. When anyone
  // posts (or an admin approves) a comment here, the server pushes 'comment:new'
  // and we refresh — so new comments appear live without a reload.
  useEffect(() => {
    const room = cmsPageId ? `comments:cmsPage:${cmsPageId}`
      : downloadId ? `comments:download:${downloadId}`
      : postId ? `comments:post:${postId}` : null
    if (!room) return
    const socket = io({ path: '/api/socket' })
    socket.on('connect', () => socket.emit('join-comments', room))
    socket.on('comment:new', () => loadComments())
    return () => { socket.disconnect() }
  }, [cmsPageId, downloadId, postId, loadComments])

  async function submitComment() {
    setError('')
    setJustSubmitted(false)
    const trimmed = newComment.trim()
    if (trimmed.length < 2) {
      setError('Comment is too short.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, content: tokenizeMentions(trimmed, mentions) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not post your comment.')
        setSubmitting(false)
        return
      }
      setNewComment('')
      setMentions([])
      // Trusted users auto-approve → no pending note; it appears right away.
      setJustSubmitted(data.comment?.status !== 'approved')
      loadComments()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0)

  return (
    <section className="comment-section">
      <h2 className="comment-section-title">
        Comments {totalCount > 0 && <span className="comment-count">({totalCount})</span>}
      </h2>

      {status === 'authenticated' ? (
        <div className="comment-form">
          <MentionInput
            value={newComment}
            onChange={setNewComment}
            onPickMention={(m) => setMentions((prev) => [...prev, m])}
            placeholder="Share your thoughts...  (type @ to mention someone)"
            maxLength={2000}
            rows={3}
          />
          {error && <p className="comment-error">{error}</p>}
          {justSubmitted && (
            <p className="comment-pending-note">Your comment is awaiting approval and will appear once reviewed.</p>
          )}
          <button className="comment-submit-btn" onClick={submitComment} disabled={submitting}>
            {submitting ? 'Posting...' : 'Post comment'}
          </button>
        </div>
      ) : status === 'unauthenticated' ? (
        <div className="comment-login-prompt">
          <p>
            <Link href="/login">Log in</Link> or <Link href="/signup">sign up</Link> to join the conversation.
          </p>
        </div>
      ) : null}

      <div className="comment-list">
        {loading ? (
          <p className="comment-loading">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="comment-empty">Be the first to comment on this post.</p>
        ) : (
          comments.map((c) => (
            <CommentRow key={c.id} comment={c} target={target} onReplySubmitted={loadComments} />
          ))
        )}
      </div>
    </section>
  )
}
