'use client';

// app/(blog)/members/page.tsx
// Public members directory. Gated server-side by the 'view-members' permission
// and the admin "Members page" toggle (the API 404s / 403s accordingly).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProfileMessageButton from '@/components/messaging/ProfileMessageButton';

interface Member {
    id: number;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    role: string | null;
}

export default function MembersPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [state, setState] = useState<'loading' | 'ok' | 'disabled' | 'forbidden' | 'error'>('loading');

    useEffect(() => {
        fetch('/api/members')
            .then(async (r) => {
                if (r.status === 404) return setState('disabled');
                if (r.status === 401 || r.status === 403) return setState('forbidden');
                if (!r.ok) return setState('error');
                const d = await r.json();
                setMembers(d.members ?? []);
                setState('ok');
            })
            .catch(() => setState('error'));
    }, []);

    const profileHref = (m: Member) => `/u/${m.username || m.id}`;

    return (
        <>
            <Navbar />
            <main id="main-content" className="members-page">
                <div className="members-inner">
                    <header className="members-head">
                        <h1>Members {state === 'ok' && <span className="members-count">{members.length}</span>}</h1>
                        <p>Meet the people in the community — view a profile or start a conversation.</p>
                    </header>

                    {state === 'loading' && <p className="members-msg">Loading members…</p>}
                    {state === 'disabled' && <p className="members-msg">The members directory isn’t available right now.</p>}
                    {state === 'forbidden' && <p className="members-msg">You don’t have access to the members directory.</p>}
                    {state === 'error' && <p className="members-msg">Couldn’t load members. Please try again.</p>}

                    {state === 'ok' && (
                        <div className="members-grid">
                            {members.map((m) => (
                                <div className="member-card" key={m.id}>
                                    <Link href={profileHref(m)} className="member-avatar-link" aria-label={`View ${m.name}'s profile`}>
                                        {m.avatarUrl
                                            ? <img src={m.avatarUrl} alt={m.name} className="member-avatar" referrerPolicy="no-referrer" />
                                            : <span className="member-avatar member-avatar-fallback">{(m.name || '?').charAt(0).toUpperCase()}</span>}
                                    </Link>
                                    <div className="member-name">{m.name}</div>
                                    <div className="member-role">{m.role}</div>
                                    {m.bio && <div className="member-bio">{m.bio}</div>}
                                    <div className="member-actions">
                                        <Link href={profileHref(m)} className="member-btn member-btn-ghost">👁 Profile</Link>
                                        <ProfileMessageButton peer={{ id: m.id, name: m.name, username: m.username, avatarUrl: m.avatarUrl, role: m.role }} />
                                    </div>
                                </div>
                            ))}
                            {members.length === 0 && <p className="members-msg">No members yet.</p>}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
