'use client'
// app/(blog)/account/page.tsx
//
// Blog-themed "My Account" for normal users. Reuses the same secure
// /api/user/profile + /api/user/avatar endpoints as the admin account page
// (userId always from the session — no IDOR). Avatar upload is gated by the
// 'upload-avatar' permission, which an admin can revoke per user.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

interface Profile {
  name: string; username: string | null; email: string; avatarUrl: string | null
  bio: string | null; phone: string | null; location: string | null
  facebook: string | null; twitter: string | null; linkedin: string | null
  instagram: string | null; youtube: string | null; pinterest: string | null
}

export default function BlogAccountPage() {
  const router = useRouter()
  const { status, update: updateSession } = useSession()
  // Derived from the DB (profile API), NOT the stale session, so an admin
  // revoking the permission is reflected as soon as the page (re)loads.
  const [canUploadAvatar, setCanUploadAvatar] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')

  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [f, setF] = useState({
    name: '', username: '', bio: '', phone: '', location: '',
    facebook: '', twitter: '', linkedin: '', instagram: '', youtube: '', pinterest: '',
  })
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))

  // password
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [cf, setCf] = useState('')

  useEffect(() => { if (status === 'unauthenticated') router.replace('/login') }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/user/profile').then(r => r.json()).then(d => {
      const u: Profile = d.user
      setCanUploadAvatar(((d.permissions ?? []) as { slug: string }[]).some(p => p.slug === 'upload-avatar'))
      if (u) {
        setEmail(u.email ?? ''); setAvatarUrl(u.avatarUrl ?? null)
        setF({
          name: u.name ?? '', username: u.username ?? '', bio: u.bio ?? '', phone: u.phone ?? '',
          location: u.location ?? '', facebook: u.facebook ?? '', twitter: u.twitter ?? '',
          linkedin: u.linkedin ?? '', instagram: u.instagram ?? '', youtube: u.youtube ?? '', pinterest: u.pinterest ?? '',
        })
      }
    }).catch(() => setErr('Could not load your profile.')).finally(() => setLoading(false))
  }, [status])

  const avatarSrc = preview || avatarUrl
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.name || 'User')}&background=5b4fcf&color=fff&size=140&bold=true`

  // Photo updates IMMEDIATELY on selection — independent of the text form, so a
  // bad username (or any other field) can never block changing your photo.
  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    setOk(''); setErr('')
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setSaving(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const up = await fetch('/api/user/avatar', { method: 'POST', body: fd })
      const upData = await up.json()
      if (!up.ok) { setErr(upData.error ?? 'Photo upload failed.'); URL.revokeObjectURL(localPreview); setPreview(null); return }
      // Save just the avatar URL (no other fields, so nothing else can fail it).
      const res = await fetch('/api/user/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatarUrl: upData.url }),
      })
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Could not save photo.'); return }
      setAvatarUrl(upData.url)
      URL.revokeObjectURL(localPreview); setPreview(null)
      setOk('Photo updated!')
      try { await updateSession() } catch { /* non-critical */ }
    } catch { setErr('Network error. Please try again.') } finally { setSaving(false) }
  }

  async function saveProfile() {
    setSaving(true); setOk(''); setErr('')
    try {
      const body: Record<string, unknown> = {
        name: f.name.trim(), username: f.username.trim(), bio: f.bio.trim(), phone: f.phone.trim(),
        location: f.location.trim(), facebook: f.facebook.trim(), twitter: f.twitter.trim(),
        linkedin: f.linkedin.trim(), instagram: f.instagram.trim(), youtube: f.youtube.trim(), pinterest: f.pinterest.trim(),
      }
      const res = await fetch('/api/user/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Update failed.'); return }
      setOk('Profile saved!')
      try { await updateSession() } catch { /* non-critical */ }
    } catch { setErr('Network error. Please try again.') } finally { setSaving(false) }
  }

  async function savePassword() {
    setOk(''); setErr('')
    if (!cur) { setErr('Enter your current password.'); return }
    if (nw.length < 8) { setErr('New password must be at least 8 characters.'); return }
    if (nw !== cf) { setErr('New passwords do not match.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: cur, password: nw }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Could not change password.'); return }
      setCur(''); setNw(''); setCf(''); setOk('Password changed!')
    } catch { setErr('Network error.') } finally { setSaving(false) }
  }

  if (status === 'loading' || loading) {
    return (<><Navbar /><div className="acctb-wrap"><p style={{ textAlign: 'center', color: '#888', padding: 60 }}>Loading…</p></div><Footer /></>)
  }

  const socials: [keyof typeof f, string][] = [
    ['facebook', 'Facebook'], ['twitter', 'Twitter / X'], ['linkedin', 'LinkedIn'],
    ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['pinterest', 'Pinterest'],
  ]

  return (
    <>
      <Navbar />
      <div className="acctb-wrap">
        <div className="acctb-card">
          <h1 className="acctb-title">My Account</h1>
          <p className="acctb-sub">Manage your profile, photo and password.</p>

          {ok && <div className="acctb-alert ok">{ok}</div>}
          {err && <div className="acctb-alert err">{err}</div>}

          {/* Avatar */}
          <div className="acctb-avatar-row">
            <img src={avatarSrc} alt={f.name} className="acctb-avatar" />
            <div>
              {canUploadAvatar ? (
                <>
                  <button className="acctb-btn-ghost" onClick={() => fileRef.current?.click()}>Change photo</button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
                  <p className="acctb-hint">JPEG/PNG/WebP, under 2 MB.</p>
                </>
              ) : (
                <p className="acctb-hint">Photo upload has been disabled for your account by an admin.</p>
              )}
            </div>
          </div>

          {/* Basic */}
          <div className="acctb-grid">
            <div className="acctb-field"><label>Full name</label>
              <input value={f.name} onChange={e => set('name', e.target.value)} maxLength={80} /></div>
            <div className="acctb-field"><label>Username</label>
              <input value={f.username} onChange={e => set('username', e.target.value)} placeholder="username" maxLength={50} /></div>
            <div className="acctb-field"><label>Email <span className="acctb-ro">(can’t change)</span></label>
              <input value={email} disabled /></div>
            <div className="acctb-field"><label>Phone</label>
              <input value={f.phone} onChange={e => set('phone', e.target.value)} maxLength={20} /></div>
            <div className="acctb-field full"><label>Address</label>
              <input value={f.location} onChange={e => set('location', e.target.value)} maxLength={160} /></div>
            <div className="acctb-field full"><label>Bio</label>
              <textarea value={f.bio} onChange={e => set('bio', e.target.value)} maxLength={500} rows={3} /></div>
          </div>

          <h3 className="acctb-h3">Social links</h3>
          <div className="acctb-grid">
            {socials.map(([k, label]) => (
              <div className="acctb-field" key={k}><label>{label}</label>
                <input type="url" value={f[k]} onChange={e => set(k, e.target.value)} placeholder="https://…" maxLength={255} /></div>
            ))}
          </div>

          <div className="acctb-actions">
            <button className="acctb-btn" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>

          <hr className="acctb-divider" />

          <h3 className="acctb-h3">Change password</h3>
          <div className="acctb-grid">
            <div className="acctb-field full"><label>Current password</label>
              <input type="password" value={cur} onChange={e => setCur(e.target.value)} autoComplete="current-password" /></div>
            <div className="acctb-field"><label>New password</label>
              <input type="password" value={nw} onChange={e => setNw(e.target.value)} autoComplete="new-password" /></div>
            <div className="acctb-field"><label>Confirm password</label>
              <input type="password" value={cf} onChange={e => setCf(e.target.value)} autoComplete="new-password" /></div>
          </div>
          <div className="acctb-actions">
            <button className="acctb-btn" onClick={savePassword} disabled={saving}>Update password</button>
          </div>
        </div>
      </div>
      <Footer />

      <style>{`
        .acctb-wrap { max-width: 820px; margin: 0 auto; padding: 40px 18px 70px; }
        .acctb-card { background: var(--card-bg, #fff); border: 1px solid rgba(0,0,0,0.07); border-radius: 16px; padding: 30px 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.06); }
        .dark .acctb-card { background: #14161c; border-color: rgba(255,255,255,0.08); }
        .acctb-title { font-size: 26px; font-weight: 800; margin: 0 0 4px; }
        .acctb-sub { color: #8a8f9c; margin: 0 0 22px; }
        .acctb-avatar-row { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; }
        .acctb-avatar { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 3px solid #5b4fcf; }
        .acctb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .acctb-grid { grid-template-columns: 1fr; } }
        .acctb-field { display: flex; flex-direction: column; gap: 6px; }
        .acctb-field.full { grid-column: 1 / -1; }
        .acctb-field label { font-size: 13px; font-weight: 600; color: #6b7180; }
        .dark .acctb-field label { color: #9aa3b2; }
        .acctb-ro { font-weight: 400; color: #aab; font-size: 11px; }
        .acctb-field input, .acctb-field textarea { border: 1.5px solid #e3e6ef; border-radius: 10px; padding: 11px 13px; font-size: 14px; font-family: inherit; background: #fafbff; color: #222; outline: none; }
        .dark .acctb-field input, .dark .acctb-field textarea { background: #1c1f27; border-color: rgba(255,255,255,0.1); color: #e8eaf0; }
        .acctb-field input:focus, .acctb-field textarea:focus { border-color: #5b4fcf; }
        .acctb-field input:disabled { background: #eef0f5; color: #999; }
        .acctb-h3 { font-size: 16px; font-weight: 700; margin: 26px 0 14px; }
        .acctb-actions { margin-top: 20px; }
        .acctb-btn { background: #5b4fcf; color: #fff; border: none; border-radius: 10px; padding: 12px 26px; font-size: 14.5px; font-weight: 700; cursor: pointer; }
        .acctb-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .acctb-btn-ghost { background: transparent; border: 1.5px solid #5b4fcf; color: #5b4fcf; border-radius: 9px; padding: 8px 18px; font-weight: 700; font-size: 13px; cursor: pointer; }
        .acctb-hint { font-size: 12px; color: #9aa0b3; margin: 8px 0 0; }
        .acctb-divider { border: none; border-top: 1px solid #eee; margin: 30px 0 0; }
        .dark .acctb-divider { border-color: rgba(255,255,255,0.08); }
        .acctb-alert { border-radius: 10px; padding: 11px 15px; font-size: 14px; margin-bottom: 18px; font-weight: 500; }
        .acctb-alert.ok { background: rgba(34,197,94,0.12); color: #16a34a; }
        .acctb-alert.err { background: rgba(239,68,68,0.12); color: #dc2626; }
      `}</style>
    </>
  )
}
