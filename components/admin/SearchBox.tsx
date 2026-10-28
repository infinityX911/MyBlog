'use client';
// components/admin/SearchBox.tsx
// Live admin search: debounced calls to /api/search returning posts, pages,
// downloads and people. Results open the public page in a new tab (like the
// blog front-end search), so the admin can jump to any content or profile.

import { useEffect, useRef, useState } from 'react';
import { IoSearch } from 'react-icons/io5';

type Item = { id: number; title?: string; slug?: string; name?: string; username?: string | null; avatarUrl?: string | null; category?: string };
type Results = { posts: Item[]; pages: Item[]; downloads: Item[]; users: Item[] };
const EMPTY: Results = { posts: [], pages: [], downloads: [], users: [] };

export default function SearchBox({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void } = {}) {
    const [q, setQ] = useState('');
    const [res, setRes] = useState<Results>(EMPTY);
    const [open, setOpen] = useState(mobile);
    const [loading, setLoading] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const term = q.trim();
        if (term.length < 2) { setRes(EMPTY); setLoading(false); return; }
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
                const d = await r.json();
                setRes({ posts: d.posts ?? [], pages: d.pages ?? [], downloads: d.downloads ?? [], users: d.users ?? [] });
            } catch { /* ignore */ } finally { setLoading(false); }
        }, 200);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const total = res.posts.length + res.pages.length + res.downloads.length + res.users.length;

    const Group = ({ title, items, hrefOf, subOf, avatar }: {
        title: string; items: Item[]; hrefOf: (it: Item) => string; subOf?: (it: Item) => string; avatar?: boolean;
    }) => items.length === 0 ? null : (
        <div className="adminSearchGroup">
            <div className="adminSearchGroupTitle">{title}</div>
            {items.map((it) => (
                <a key={`${title}-${it.id}`} href={hrefOf(it)} target="_blank" rel="noopener noreferrer" className="adminSearchItem" onClick={() => setOpen(false)}>
                    <span className="adminSearchItemLeft">
                        {avatar && (
                            it.avatarUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={it.avatarUrl} alt="" className="adminSearchAvatar" referrerPolicy="no-referrer" />
                                : <span className="adminSearchAvatar adminSearchAvatarFallback">{(it.name || '?').charAt(0).toUpperCase()}</span>
                        )}
                        <span className="adminSearchItemTitle">{it.title || it.name}</span>
                    </span>
                    {subOf && <span className="adminSearchItemSub">{subOf(it)}</span>}
                </a>
            ))}
        </div>
    );

    return (
        <div className={`searchBox position-relative d-flex align-items-center ${mobile ? 'searchBox-mobile' : ''}`} ref={boxRef}>
            <IoSearch className="me-3" />
            <input
                type="text"
                placeholder={mobile ? 'quick finding…' : 'Search posts, pages, people...'}
                className={mobile ? 'form-control' : 'd-none d-lg-inline form-control'}
                value={q}
                autoFocus={mobile}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Escape') { onClose?.(); } }}
            />
            {open && q.trim().length >= 2 && (
                <div className="adminSearchDropdown">
                    {loading && total === 0 ? (
                        <div className="adminSearchEmpty">Searching…</div>
                    ) : total === 0 ? (
                        <div className="adminSearchEmpty">No results for “{q.trim()}”.</div>
                    ) : (
                        <>
                            <Group title="Posts" items={res.posts} hrefOf={(p) => `/${p.category || 'uncategorized'}/${p.slug}`} />
                            <Group title="Pages" items={res.pages} hrefOf={(p) => `/${p.slug}`} />
                            <Group title="Downloads" items={res.downloads} hrefOf={(p) => `/downloads/${p.slug}`} />
                            <Group title="People" items={res.users} avatar hrefOf={(u) => `/u/${u.username || u.id}`} subOf={(u) => (u.username ? `@${u.username}` : '')} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
