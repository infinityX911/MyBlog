'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn, signOut, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wasDenied = searchParams.get('denied') === '1';
  const [checkingSession, setCheckingSession] = useState(true);

  // Already signed in? Don't show the login form — go to the admin panel.
  // (If they lack access, proxy.ts bounces them home with a toast.)
  // getSession() works without a SessionProvider, which this page lacks.
  useEffect(() => {
    let active = true;
    getSession().then((session) => {
      if (!active) return;
      if (session?.user) router.replace('/admin');
      else setCheckingSession(false);
    });
    return () => { active = false; };
  }, [router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    wasDenied ? "Your account doesn't have access to the admin panel." : ''
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setLoading(false);
      setError('Invalid email or password. Please try again.');
      return;
    }

    // Credentials were valid — but is this account actually allowed into
    // the admin panel? A plain blog "Viewer" account (zero permissions by
    // default) can authenticate successfully and still must be rejected
    // here, otherwise they'd just bounce straight back via proxy.ts.
    const session = await getSession();
    const permissions = ((session?.user as any)?.permissions ?? []) as string[];

    if (!permissions.includes('access-admin-panel')) {
      setLoading(false);
      setError("Your account doesn't have access to the admin panel.");
      await signOut({ redirect: false });
      return;
    }

    router.push('/admin');
  };

  // While checking for an existing session, don't flash the login form.
  if (checkingSession) {
    return (
      <div
        className="min-vh-100 d-flex align-items-center justify-content-center"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
      />
    );
  }

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
    >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">

            {/* Card */}
            <div
              className="card border-0 shadow-lg"
              style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div className="card-body p-4 p-md-5">

                {/* Logo / Title */}
                <div className="text-center mb-4">
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                    style={{
                      width: '64px',
                      height: '64px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    }}
                  >
                    <i className="bi bi-shield-lock-fill text-white fs-4"></i>
                  </div>
                  <h4 className="text-white fw-bold mb-1">Admin Panel</h4>
                  <p className="mb-0" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                    Sign in to your account
                  </p>
                </div>

                {/* Error Alert */}
                {error && (
                  <div className="alert border-0 mb-4 d-flex align-items-center gap-2"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      borderRadius: '10px',
                      color: '#fca5a5',
                    }}
                  >
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span style={{ fontSize: '14px' }}>{error}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>

                  {/* Email */}
                  <div className="mb-3">
                    <label className="form-label fw-medium" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                      Email Address
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text border-0"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                      >
                        <i className="bi bi-envelope-fill"></i>
                      </span>
                      <input
                        type="email"
                        className="form-control border-0"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          color: 'white',
                          outline: 'none',
                          boxShadow: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="mb-4">
                    <label className="form-label fw-medium" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                      Password
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text border-0"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                      >
                        <i className="bi bi-lock-fill"></i>
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control border-0"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          color: 'white',
                          outline: 'none',
                          boxShadow: 'none',
                        }}
                      />
                      <button
                        type="button"
                        className="input-group-text border-0"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="btn w-100 fw-semibold py-2"
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: 'white',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '15px',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        Sign In
                      </>
                    )}
                  </button>

                </form>

                {/* Forgot password */}
                <div className="text-center mt-3">
                  <a href="/admin/forgot-password"
                    style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none' }}>
                    Forgot your password?
                  </a>
                </div>

                {/* Footer */}
                <div className="text-center mt-4">
                  <small style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Portfolio Admin © {new Date().getFullYear()}
                  </small>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
