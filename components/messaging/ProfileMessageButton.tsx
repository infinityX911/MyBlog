'use client';

/**
 * components/messaging/ProfileMessageButton.tsx
 *
 * The "Message" button shown on a public user profile. Clicking it:
 *   - if logged out  → sends the visitor to /login
 *   - if logged in   → opens a floating chat with this user (openChatWith).
 *     If the caller lacks the 'use-messages' permission the API returns 403
 *     and we surface a short inline notice.
 *
 * Hidden entirely when you are viewing your own profile.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMessaging, type Peer } from '@/context/MessagingContext';

export default function ProfileMessageButton({ peer }: { peer: Peer }) {
    const { data: session } = useSession();
    const router = useRouter();
    const { openChatWith } = useMessaging();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const myId = Number((session?.user as any)?.id) || 0;
    if (myId && myId === peer.id) return null; // no "message yourself"

    const onClick = async () => {
        if (!session?.user) {
            router.push('/login');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: peer.id }),
            });
            if (res.status === 403) {
                setError('You do not have permission to send messages.');
            } else if (!res.ok) {
                setError('Could not start the chat. Please try again.');
            } else {
                const data = await res.json();
                if (data.conversationId) await openChatWith(peer.id, peer);
            }
        } catch {
            setError('Could not start the chat. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
            <button
                onClick={onClick}
                disabled={busy}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: '#5b4fcf', color: '#fff', border: 'none',
                    borderRadius: 999, padding: '10px 22px', fontSize: 15, fontWeight: 600,
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
                }}
            >
                💬 {busy ? 'Opening…' : 'Message'}
            </button>
            {error && <span style={{ color: '#e74c3c', fontSize: 12 }}>{error}</span>}
        </div>
    );
}
