'use client';

/**
 * app/(blog)/verify-email/page.tsx
 * Public page hit from the signup verification email (?token=...).
 * Calls the verify API on mount and shows the result.
 */

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function VerifyInner() {
    const params = useSearchParams();
    const token = params.get('token') ?? '';
    const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your email…');

    useEffect(() => {
        if (!token) { setState('error'); setMessage('No verification token provided.'); return; }
        (async () => {
            try {
                const res = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
                const data = await res.json();
                if (res.ok) { setState('ok'); setMessage(data.message ?? 'Email verified! You can now log in.'); }
                else { setState('error'); setMessage(data.error ?? 'Verification failed.'); }
            } catch {
                setState('error'); setMessage('Network error. Please try again.');
            }
        })();
    }, [token]);

    const color = state === 'ok' ? '#16a34a' : state === 'error' ? '#dc2626' : '#0858f7';
    const icon = state === 'ok' ? '✓' : state === 'error' ? '!' : '…';

    return (
        <div style={wrap}>
            <div style={card}>
                <div style={{
                    width: 64, height: 64, borderRadius: '50%', margin: '0 auto 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: color, color: '#fff', fontSize: 30, fontWeight: 700,
                }}>{icon}</div>
                <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#1f2440' }}>Email verification</h2>
                <p style={{ margin: '0 0 22px', color: '#5a6072', fontSize: 15 }}>{message}</p>
                {state !== 'loading' && (
                    <Link href="/login" style={{
                        display: 'inline-block', background: '#0858f7', color: '#fff',
                        padding: '12px 26px', borderRadius: 10, textDecoration: 'none', fontWeight: 700,
                    }}>Go to login</Link>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div style={wrap}><div style={card}>Loading…</div></div>}>
            <VerifyInner />
        </Suspense>
    );
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef1f8', padding: 20 };
const card: React.CSSProperties = { width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, padding: '40px 32px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' };
