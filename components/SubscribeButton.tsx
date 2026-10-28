'use client';

/**
 * components/SubscribeButton.tsx
 * Functional "Subscribe" button:
 *  - Not logged in  → sends the user to /login.
 *  - Logged in      → registers the service worker, asks for notification
 *                     permission, subscribes to web push, and saves it via
 *                     /api/subscribe. Also flags email notifications on.
 *  - Already subscribed → shows "Subscribed ✓" and can unsubscribe.
 */
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
}

export default function SubscribeButton({
    label = 'Subscribe',
    className,
    style,
}: { label?: string; className?: string; style?: React.CSSProperties }) {
    const { status } = useSession();
    const router = useRouter();
    const [subscribed, setSubscribed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        if (status === 'authenticated') {
            fetch('/api/subscribe').then(r => r.json()).then(d => setSubscribed(!!d.subscribed)).catch(() => {});
        }
    }, [status]);

    async function subscribe() {
        if (status !== 'authenticated') { router.push('/login'); return; }
        setBusy(true); setMsg('');
        try {
            let subscription: any = null;
            const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            // Try browser push (optional — email still works without it)
            if (vapid && 'serviceWorker' in navigator && 'PushManager' in window) {
                try {
                    const reg = await navigator.serviceWorker.register('/sw.js');
                    const perm = await Notification.requestPermission();
                    if (perm === 'granted') {
                        const existing = await reg.pushManager.getSubscription();
                        subscription = existing ?? await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(vapid),
                        });
                    }
                } catch { /* push optional */ }
            }
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription, wantsEmail: true, wantsPush: !!subscription }),
            });
            if (!res.ok) throw new Error('Failed');
            setSubscribed(true);
            setMsg(subscription ? 'Subscribed! You’ll get email + browser alerts.' : 'Subscribed! You’ll get email alerts.');
        } catch {
            setMsg('Could not subscribe. Try again.');
        } finally { setBusy(false); }
    }

    async function unsubscribe() {
        setBusy(true); setMsg('');
        try {
            await fetch('/api/subscribe', { method: 'DELETE' });
            setSubscribed(false); setMsg('Unsubscribed.');
        } catch { /* ignore */ } finally { setBusy(false); }
    }

    return (
        <div>
            <button
                className={className}
                style={style}
                disabled={busy}
                onClick={subscribed ? unsubscribe : subscribe}
            >
                {busy ? 'Please wait…' : subscribed ? 'Subscribed ✓ (tap to stop)' : `${label} →`}
            </button>
            {msg && <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8, marginBottom: 0 }}>{msg}</p>}
        </div>
    );
}
