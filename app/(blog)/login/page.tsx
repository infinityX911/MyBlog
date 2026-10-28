'use client'
// app/(blog)/login/page.tsx

import { useState, useEffect, Suspense } from 'react'
import { signIn, useSession, getProviders } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useSiteBrand } from '@/context/SiteBrandContext'

function LoginForm() {
  const { siteName } = useSiteBrand()
  const router = useRouter()
  const { status } = useSession()
  const searchParams = useSearchParams()
  const justRegistered = searchParams.get('registered') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Ask NextAuth which providers actually exist rather than assuming.
  //
  // The Google provider is only registered when GOOGLE_CLIENT_ID and
  // GOOGLE_CLIENT_SECRET are set. Rendering the button regardless meant that
  // with those blank, clicking it asked NextAuth for a provider it did not
  // have, and it fell back to its sign-in page — dumping readers on the admin
  // login form. Reading the real provider list means the button simply is not
  // there until it works, and no separate flag can fall out of sync with it.
  const [hasGoogle, setHasGoogle] = useState(false)
  useEffect(() => {
    let alive = true
    getProviders()
      .then((p) => { if (alive) setHasGoogle(!!p?.google) })
      .catch(() => { /* leave the button hidden */ })
    return () => { alive = false }
  }, [])

  // Every way the Google flow can refuse, spelled out. NextAuth only puts a
  // code in the URL, and "there was a problem signing in" leaves someone with
  // no idea whether to retry, use a password, or email an admin.
  const GOOGLE_ERRORS: Record<string, string> = {
    // Only reachable if two sign-ins race for the same brand-new address; the
    // loser is told to try again, and the second attempt links normally.
    'account-exists':
      'That account was just created. Please click "Continue with Google" once more.',
    'google-unverified':
      'Google has not verified the email address on that account, so it cannot be used to sign in. Verify it with Google first, or log in with a password.',
    'google-mismatch':
      'That email address is already linked to a different Google account. Please sign in with the original one, or contact an administrator.',
    blocked: 'Your account has been blocked. Please contact an administrator.',
    'registration-closed':
      'New registrations are closed at the moment, so a new account could not be created. If you already have one, log in with your password.',
    'server-not-ready': 'Sign-up is temporarily unavailable. Please try again shortly.',
    google: 'Google sign-in could not be completed. Please try again.',
  }
  const urlError = searchParams.get('error')
  const googleError = urlError ? (GOOGLE_ERRORS[urlError] ?? '') : ''

  // Already logged in? Don't show the login form — bounce to home.
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/')
    }
  }, [status, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  // Avoid flashing the form while we check session / redirect.
  if (status === 'loading' || status === 'authenticated') {
    return <div className="auth-page" />
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-eyebrow">👋 Welcome back</div>
          <h1 className="auth-title">Log in to {siteName}</h1>
          <p className="auth-sub">Pick up the conversation where you left off.</p>
        </div>

        {justRegistered && (
          <div className="auth-success">Account created! You can log in now.</div>
        )}
        {error && <div className="auth-error">{error}</div>}
        {googleError && <div className="auth-error">{googleError}</div>}

        {/* Google first: it is one click, and someone who has an account this
            way should not have to read past a password form to find it.
            Hidden entirely until the provider is actually configured. */}
        {hasGoogle && (<>
        <button
          type="button"
          className="auth-google"
          onClick={() => { setGoogleLoading(true); signIn('google', { callbackUrl: '/' }) }}
          disabled={googleLoading || loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          {googleLoading ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <div className="auth-divider"><span>or</span></div>
        </>)}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="auth-footer-link">
          Don&apos;t have an account? <Link href="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="auth-page" />}>
        <LoginForm />
      </Suspense>
      <Footer />
    </>
  )
}
