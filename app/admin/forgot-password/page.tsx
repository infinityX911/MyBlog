'use client';

/**
 * app/admin/forgot-password/page.tsx
 * Public page — request a password reset (email link + OTP code).
 */

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState('');
    const [error, setError] = useState('');

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true); setError(''); setDone('');
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
            setDone(data.message ?? 'If an account matches, a reset link and code have been sent.');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={wrap}>
            <div style={card}>
                <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#1f2440' }}>Forgot password</h2>
                <p style={{ margin: '0 0 22px', color: '#7a7f93', fontSize: 14 }}>
                    Enter your email or phone. We&apos;ll send a reset link and a 6-digit code.
                </p>

                {done ? (
                    <>
                        <p style={alertOk}>{done}</p>
                        <Link href="/admin/reset-password" style={btnLink}>I have a code →</Link>
                    </>
                ) : (
                    <form onSubmit={submit}>
                        {error && <p style={alertErr}>{error}</p>}
                        <label style={label}>Email or phone</label>
                        <input
                            type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                            placeholder="you@example.com or +92 300 0000000"
                            style={input} autoFocus
                        />
                        <button type="submit" disabled={loading || !identifier.trim()} style={btn}>
                            {loading ? 'Sending…' : 'Send reset link & code'}
                        </button>
                    </form>
                )}

                <div style={{ marginTop: 18, textAlign: 'center' }}>
                    <Link href="/admin/login" style={{ color: '#0858f7', fontSize: 13, textDecoration: 'none' }}>
                        ← Back to login
                    </Link>
                </div>
            </div>
        </div>
    );
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef1f8', padding: 20 };
const card: React.CSSProperties = { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: '34px 30px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e5ef', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 16, outline: 'none' };
const btn: React.CSSProperties = { width: '100%', background: '#0858f7', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer' };
const btnLink: React.CSSProperties = { ...btn, display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' };
const alertOk: React.CSSProperties = { background: 'rgba(34,197,94,0.12)', color: '#16a34a', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 16 };
const alertErr: React.CSSProperties = { background: 'rgba(239,68,68,0.12)', color: '#dc2626', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 16 };
