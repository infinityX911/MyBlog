'use client';

/**
 * components/BlogSearch.tsx
 *
 * Live search box for the blog navbar: debounced calls to /api/search and a
 * results dropdown linking to posts and to user profiles (/u/<id>). Used in
 * both the desktop header and the mobile search popup.
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface PostHit { id: number; title: string; slug: string }
interface UserHit { id: number; name: string; username: string | null; avatarUrl: string | null }

export default function BlogSearch({
    inputClassName = 'cwh-search',
    placeholder = 'Search...',
    autoFocus = false,
    onNavigate,
}: {
    inputClassName?: string;
    placeholder?: string;
    autoFocus?: boolean;
    onNavigate?: () => void;
}) {
    const [q, setQ] = useState('');
    const [posts, setPosts] = useState<PostHit[]>([]);
    const [users, setUsers] = useState<UserHit[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Debounced fetch.
    useEffect(() => {
        const term = q.trim();
        if (term.length < 2) { setPosts([]); setUsers([]); setLoading(false); return; }
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
                const data = await res.json();
                setPosts(data.posts ?? []);
                setUsers(data.users ?? []);
                setOpen(true);
            } catch { /* ignore */ } finally { setLoading(false); }
        }, 250);
        return () => clearTimeout(t);
    }, [q]);

    // Close on outside click.
    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const go = () => { setOpen(false); setQ(''); onNavigate?.(); };
    const hasResults = posts.length > 0 || users.length > 0;

    return (
        <div ref={wrapRef} className="cwh-search-wrap" style={{ position: 'relative' }}>
            <svg className="cwh-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
                type="text"
                className={inputClassName}
                placeholder={placeholder}
                value={q}
                autoFocus={autoFocus}
                onChange={e => setQ(e.target.value)}
                onFocus={() => { if (hasResults) setOpen(true); }}
            />

            {open && q.trim().length >= 2 && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 1500,
                    background: 'var(--card-bg,#fff)', color: 'inherit',
                    border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)', overflow: 'hidden', maxHeight: 380, overflowY: 'auto',
                    minWidth: 260,
                }}>
                    {loading && <div style={{ padding: 12, fontSize: 13, color: '#888' }}>Searching…</div>}
                    {!loading && !hasResults && <div style={{ padding: 12, fontSize: 13, color: '#888' }}>No results for “{q}”.</div>}

                    {users.length > 0 && (
                        <div>
                            <div style={{ padding: '8px 12px 4px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999' }}>People</div>
                            {users.map(u => (
                                <Link key={`u${u.id}`} href={`/u/${u.username || u.id}`} onClick={go}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', textDecoration: 'none', color: 'inherit' }}>
                                    <img
                                        src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=5b4fcf&color=fff`}
                                        alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                                    <span style={{ fontSize: 14 }}>
                                        {u.name}{u.username && <span style={{ color: '#999' }}> @{u.username}</span>}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}

                    {posts.length > 0 && (
                        <div>
                            <div style={{ padding: '8px 12px 4px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999' }}>Posts</div>
                            {posts.map(p => (
                                <Link key={`p${p.id}`} href={`/${(p as any).category || 'uncategorized'}/${p.slug}`} onClick={go}
                                    style={{ display: 'block', padding: '8px 12px', textDecoration: 'none', color: 'inherit', fontSize: 14 }}>
                                    📄 {p.title}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
