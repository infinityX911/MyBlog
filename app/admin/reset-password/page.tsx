'use client';

/**
 * app/admin/reset-password/page.tsx
 * Public page — set a new password using either the email-link token
 * (?token=...) or a 6-digit OTP code (identifier + code).
 */

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

function ResetInner() {
    const params = useSearchParams();
    const router = useRouter();
    const tokenFromUrl = params.get('token') ?? '';

    const [mode, setMode] = useState<'token' | 'code'>(tokenFromUrl ? 'token' : 'code');
    const [identifier, setIdentifier] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState('');

    useEffect(() => { if (tokenFromUrl) setMode('token'); }, [tokenFromUrl]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
        if (password !== confirm) { setError('Passwords do not match.'); return; }

        setLoading(true);
        try {
            const payload = mode === 'token'
                ? { token: tokenFromUrl, password }
                : { identifier, code, password };
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
            setDone(data.message ?? 'Password updated.');
            setTimeout(() => router.push('/admin/login'), 1800);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={wrap}>
            <div style={card}>
                <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#1f2440' }}>Reset password</h2>
                <p style={{ margin: '0 0 22px', color: '#7a7f93', fontSize: 14 }}>
                    {mode === 'token' ? 'Set a new password for your account.' : 'Enter the 6-digit code we sent you.'}
                </p>

                {done ? (
                    <p style={alertOk}>{done} Redirecting to login…</p>
                ) : (
                    <form onSubmit={submit}>
                        {error && <p style={alertErr}>{error}</p>}

                        {mode === 'code' && (
                            <>
                                <label style={label}>Email or phone</label>
                                <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                                    placeholder="you@example.com or +92 300 0000000" style={input} />
                                <label style={label}>6-digit code</label>
                                <input type="text" inputMode="numeric" maxLength={6} value={code}
                                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="123456" style={input} />
                            </>
                        )}

                        <label style={label}>New password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="Min 8 characters" style={input} autoComplete="new-password" />
                        <label style={label}>Confirm password</label>
                        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                            placeholder="Re-enter password" style={input} autoComplete="new-password" />

                        <button type="submit" disabled={loading} style={btn}>
                            {loading ? 'Updating…' : 'Update password'}
                        </button>

                        <div style={{ marginTop: 14, textAlign: 'center' }}>
                            <button type="button" onClick={() => setMode(mode === 'token' ? 'code' : 'token')}
                                style={{ background: 'none', border: 'none', color: '#0858f7', fontSize: 13, cursor: 'pointer' }}>
                                {mode === 'token' ? 'Use a code instead' : 'I have a reset link'}
                            </button>
                        </div>
                    </form>
                )}

                <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <Link href="/admin/login" style={{ color: '#0858f7', fontSize: 13, textDecoration: 'none' }}>← Back to login</Link>
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div style={wrap}><div style={card}>Loading…</div></div>}>
            <ResetInner />
        </Suspense>
    );
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef1f8', padding: 20 };
const card: React.CSSProperties = { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: '34px 30px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e5ef', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 16, outline: 'none' };
const btn: React.CSSProperties = { width: '100%', background: '#0858f7', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer' };
const alertOk: React.CSSProperties = { background: 'rgba(34,197,94,0.12)', color: '#16a34a', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 16 };
const alertErr: React.CSSProperties = { background: 'rgba(239,68,68,0.12)', color: '#dc2626', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 16 };
