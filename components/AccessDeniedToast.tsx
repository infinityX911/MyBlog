'use client';

/**
 * AccessDeniedToast.tsx
 *
 * Shows a top-right toast when a logged-in user without admin access is
 * redirected home (proxy.ts → /?denied=admin). Auto-dismisses and cleans the
 * query param so it doesn't reappear on refresh.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

const MESSAGES: Record<string, string> = {
    admin: "You don't have access to the admin panel.",
};

export default function AccessDeniedToast() {
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [show, setShow] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const denied = params.get('denied');
        if (denied && MESSAGES[denied]) {
            setMessage(MESSAGES[denied]);
            setShow(true);
            // Clean the URL so a refresh won't show it again.
            router.replace(pathname, { scroll: false });
            const t = setTimeout(() => setShow(false), 5000);
            return () => clearTimeout(t);
        }
    }, [params, router, pathname]);

    if (!show) return null;

    return (
        <div
            role="alert"
            style={{
                position: 'fixed',
                top: 20,
                right: 20,
                zIndex: 9999,
                maxWidth: 360,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                background: '#fff',
                color: '#7f1d1d',
                border: '1px solid #fecaca',
                borderLeft: '4px solid #ef4444',
                borderRadius: 12,
                padding: '14px 16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                animation: 'adtSlideIn 0.25s ease-out',
            }}
        >
            <span style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                background: '#ef4444', color: '#fff', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
            }}>!</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Access denied</div>
                <div style={{ fontSize: 13.5, color: '#991b1b' }}>{message}</div>
            </div>
            <button
                onClick={() => setShow(false)}
                aria-label="Dismiss"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: 0 }}
            >
                ×
            </button>
            <style>{`@keyframes adtSlideIn { from { transform: translateX(20px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
        </div>
    );
}
