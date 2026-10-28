'use client'
// app/(blog)/signup/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn, getProviders } from 'next-auth/react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useSiteBrand } from '@/context/SiteBrandContext'

export default function SignupPage() {
  const { siteName } = useSiteBrand()
  const router = useRouter()
  const { status } = useSession()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Only show the Google button once the provider really exists — see the same
  // note on the login page. Otherwise clicking it asks NextAuth for a provider
  // it does not have and the person ends up on the admin login form.
  const [hasGoogle, setHasGoogle] = useState(false)
  useEffect(() => {
    let alive = true
    getProviders()
      .then((p) => { if (alive) setHasGoogle(!!p?.google) })
      .catch(() => { /* leave the button hidden */ })
    return () => { alive = false }
  }, [])

  // Already logged in? Bounce to home.
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/')
    }
  }, [status, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, gender }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      // Account created but UNVERIFIED — tell them to check their email.
      setDone(true)
      setLoading(false)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  // Avoid flashing form while checking session / redirecting.
  if (status === 'loading' || status === 'authenticated') {
    return (
      <>
        <Navbar />
        <div className="auth-page" />
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />

      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-eyebrow">✨ Join {siteName}</div>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-sub">Comment on posts and join the conversation.</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          {done ? (
            <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#16a34a', color: '#fff', fontSize: 28, fontWeight: 700,
              }}>✓</div>
              <h3 style={{ margin: '0 0 8px', fontWeight: 800 }}>Check your email</h3>
              <p style={{ color: '#5a6072', fontSize: 15, margin: '0 0 18px' }}>
                We&apos;ve sent a verification link to <b>{email}</b>. Click it to activate your
                account, then you can log in. (The link is valid for 24 hours.)
              </p>
              <Link href="/login" className="auth-submit" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Go to login
              </Link>
            </div>
          ) : (
          <>
          {/* Google skips the form and the verification email — Google has
              already proven the address. Same starter permissions either way,
              so nothing is gained or lost by choosing one. */}
          {hasGoogle && (<>
          <button
            type="button"
            className="auth-google"
            onClick={() => signIn('google', { callbackUrl: '/' })}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>

          <div className="auth-divider"><span>or</span></div>
          </>)}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                maxLength={190}
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label>Gender</label>
              <div className="auth-gender-pills">
                <button
                  type="button"
                  className={`auth-gender-pill ${gender === 'MALE' ? 'active' : ''}`}
                  onClick={() => setGender('MALE')}
                >
                  Male
                </button>
                <button
                  type="button"
                  className={`auth-gender-pill ${gender === 'FEMALE' ? 'active' : ''}`}
                  onClick={() => setGender('FEMALE')}
                >
                  Female
                </button>
              </div>
              <p className="auth-hint">A default avatar will be assigned automatically.</p>
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                maxLength={200}
                autoComplete="new-password"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={8}
                maxLength={200}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>
          </>
          )}

          {!done && (
            <p className="auth-footer-link">
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}
