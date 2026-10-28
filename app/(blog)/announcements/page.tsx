'use client';

// app/(blog)/announcements/page.tsx
// Public announcements feed — admin posts "status" updates, members like + comment.
// Gated by the 'announcements enabled' toggle (API 404s when off).
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CommentSection from '@/components/CommentSection';

interface Announcement {
    id: number;
    title: string | null;
    body: string;
    image: string | null;
    pinned: boolean;
    createdAt: string | null;
    author: { id: number; name: string; username: string | null; avatarUrl: string | null };
    likeCount: number;
    commentCount: number;
    likedByMe: boolean;
}

function timeAgo(d: string | null) {
    if (!d) return '';
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const dd = Math.floor(h / 24); if (dd < 7) return `${dd}d ago`;
    return new Date(d).toLocaleDateString();
}

export default function AnnouncementsPage() {
    const { status: authStatus } = useSession();
    const router = useRouter();
    const [items, setItems] = useState<Announcement[]>([]);
    const [state, setState] = useState<'loading' | 'ok' | 'disabled' | 'error'>('loading');
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});

    const load = () => {
        fetch('/api/announcements')
            .then(async (r) => {
                if (r.status === 404) return setState('disabled');
                if (!r.ok) return setState('error');
                const d = await r.json();
                setItems(d.items ?? []);
                setState('ok');
            })
            .catch(() => setState('error'));
    };
    useEffect(load, []);

    const toggleLike = async (a: Announcement) => {
        if (authStatus !== 'authenticated') { router.push('/login'); return; }
        // optimistic
        setItems((prev) => prev.map((x) => x.id === a.id
            ? { ...x, likedByMe: !x.likedByMe, likeCount: x.likeCount + (x.likedByMe ? -1 : 1) } : x));
        const res = await fetch(`/api/announcements/${a.id}/like`, { method: 'POST' }).catch(() => null);
        if (!res || !res.ok) load(); // revert to server truth on failure
    };

    return (
        <>
            <Navbar />
            <main id="main-content" className="ann-page">
                <div className="ann-inner">
                    <header className="ann-head">
                        <h1>📢 Announcements</h1>
                        <p>Latest updates from the team — like and join the conversation.</p>
                    </header>

                    {state === 'loading' && <p className="members-msg">Loading…</p>}
                    {state === 'disabled' && <p className="members-msg">Announcements aren’t available right now.</p>}
                    {state === 'error' && <p className="members-msg">Couldn’t load announcements.</p>}
                    {state === 'ok' && items.length === 0 && <p className="members-msg">No announcements yet.</p>}

                    {state === 'ok' && items.map((a) => (
                        <article className="ann-card" id={`a${a.id}`} key={a.id}>
                            <div className="ann-top">
                                <Link href={`/u/${a.author.username || a.author.id}`} className="ann-avatar-link">
                                    {a.author.avatarUrl
                                        ? <img src={a.author.avatarUrl} alt={a.author.name} className="ann-avatar" referrerPolicy="no-referrer" />
                                        : <span className="ann-avatar ann-avatar-fallback">{(a.author.name || '?').charAt(0).toUpperCase()}</span>}
                                </Link>
                                <div>
                                    <div className="ann-author">{a.author.name}{a.pinned && <span className="ann-pin">📌 Pinned</span>}</div>
                                    <div className="ann-time">{timeAgo(a.createdAt)}</div>
                                </div>
                            </div>
                            {a.title && <h2 className="ann-title">{a.title}</h2>}
                            <p className="ann-body">{a.body}</p>
                            {a.image && <img src={a.image} alt="" className="ann-image" />}
                            <div className="ann-actions">
                                <button className={`ann-like ${a.likedByMe ? 'liked' : ''}`} onClick={() => toggleLike(a)}>
                                    {a.likedByMe ? '❤️' : '🤍'} {a.likeCount}
                                </button>
                                <button className="ann-comment-toggle" onClick={() => setOpenComments((s) => ({ ...s, [a.id]: !s[a.id] }))}>
                                    💬 {a.commentCount} Comments
                                </button>
                            </div>
                            {openComments[a.id] && (
                                <div className="ann-comments">
                                    <CommentSection announcementId={a.id} />
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            </main>
            <Footer />
        </>
    );
}
