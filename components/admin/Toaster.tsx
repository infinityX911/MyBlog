'use client';

/**
 * components/admin/Toaster.tsx
 *
 * Renders top-right toast alerts dispatched via lib/toast showToast(). Each
 * toast auto-dismisses after a few seconds and can be closed with ✕.
 */

import React, { useEffect, useState } from 'react';

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

const COLORS: Record<string, { bg: string; bar: string; text: string }> = {
    success: { bg: '#e8f8ee', bar: '#1a7f37', text: '#0f5132' },
    error:   { bg: '#fdecea', bar: '#c0392b', text: '#842029' },
    info:    { bg: '#e7f1ff', bar: '#0858f7', text: '#084298' },
};

export default function Toaster() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { message: string; type: Toast['type'] };
            const id = Date.now() + Math.random();
            setToasts(prev => [...prev, { id, message: detail.message, type: detail.type || 'success' }]);
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
        };
        window.addEventListener('app-toast', handler);
        return () => window.removeEventListener('app-toast', handler);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 4000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
            {toasts.map(t => {
                const c = COLORS[t.type] || COLORS.success;
                return (
                    <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, background: c.bg, color: c.text,
                        borderRadius: 12, padding: '12px 14px', boxShadow: '0 8px 26px rgba(0,0,0,0.16)',
                        borderLeft: `5px solid ${c.bar}`,
                    }}>
                        <span style={{ fontSize: 18 }}>{t.type === 'error' ? '⚠️' : t.type === 'info' ? 'ℹ️' : '✅'}</span>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t.message}</span>
                        <button
                            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                            aria-label="Dismiss"
                            style={{ background: 'transparent', border: 'none', color: c.text, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                        >✕</button>
                    </div>
                );
            })}
        </div>
    );
}
