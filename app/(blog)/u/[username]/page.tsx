/**
 * app/(blog)/u/[username]/page.tsx
 *
 * Public, view-only user profile (blog theme). Other users land here from a
 * comment avatar, search, or a shared link, and can hit "Message" to start a
 * direct chat (ProfileMessageButton — client). Only PUBLIC fields are shown
 * (never email/phone).
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import ProfileMessageButton from '@/components/messaging/ProfileMessageButton';

type Params = { params: Promise<{ username: string }> };

const PUBLIC_SELECT = {
    id: true, name: true, username: true, avatarUrl: true, bio: true, location: true,
    facebook: true, twitter: true, linkedin: true, instagram: true, youtube: true, pinterest: true,
    createdAt: true, status: true,
} as const;

async function getProfile(handle: string) {
    if (!handle) return null;
    // The [username] segment accepts either a numeric user id (e.g. linked
    // from a comment avatar, which only knows the id) or a real @username.
    const isId = /^\d+$/.test(handle);
    const user = await prisma.user.findUnique({
        where: isId ? { id: Number(handle) } : { username: handle },
        select: PUBLIC_SELECT,
    });
    // Blocked accounts are not publicly visible.
    if (!user || user.status === 'blocked') return null;
    return user;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { username } = await params;
    const user = await getProfile(username);
    if (!user) return { title: 'Profile not found' };
    const desc = user.bio?.slice(0, 155) || `${user.name}'s profile`;
    return {
        title: `${user.name} (@${user.username})`,
        description: desc,
        openGraph: { title: user.name, description: desc, images: user.avatarUrl ? [user.avatarUrl] : undefined },
    };
}

const SOCIALS: { key: string; label: string }[] = [
    { key: 'facebook', label: 'Facebook' },
    { key: 'twitter', label: 'Twitter / X' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'pinterest', label: 'Pinterest' },
];

export default async function PublicProfilePage({ params }: Params) {
    const { username } = await params;
    const user = await getProfile(username);
    if (!user) notFound();

    const avatar = user.avatarUrl
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=5b4fcf&color=fff&size=200`;
    const joined = user.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        : null;
    const socials = SOCIALS
        .map(s => ({ ...s, url: (user as any)[s.key] as string | null }))
        .filter(s => s.url && s.url.trim());

    return (
        <>
            <Navbar />
            <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px 80px' }}>
                <div className="profile-card" style={{ borderRadius: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    {/* Banner */}
                    <div style={{ height: 120, background: 'linear-gradient(120deg,#5b4fcf,#8b5cf6)' }} />

                    <div style={{ padding: '0 28px 28px', marginTop: -56 }}>
                        <img
                            src={avatar}
                            alt={user.name}
                            style={{ width: 112, height: 112, borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--card-bg,#fff)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                            <div>
                                <h1 className="profile-name" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{user.name}</h1>
                                {user.username && <div className="profile-handle" style={{ fontSize: 15 }}>@{user.username}</div>}
                            </div>
                            <ProfileMessageButton peer={{ id: user.id, name: user.name, username: user.username, avatarUrl: user.avatarUrl }} />
                        </div>

                        {user.bio && <p className="profile-bio" style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6 }}>{user.bio}</p>}

                        <div className="profile-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 16, fontSize: 14 }}>
                            {user.location && <span>📍 {user.location}</span>}
                            {joined && <span>🗓️ Joined {joined}</span>}
                        </div>

                        {socials.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
                                {socials.map(s => (
                                    <a
                                        key={s.key}
                                        href={s.url!.startsWith('http') ? s.url! : `https://${s.url}`}
                                        target="_blank"
                                        rel="nofollow noopener noreferrer"
                                        className="profile-social-pill"
                                        style={{ fontSize: 13, padding: '6px 14px', borderRadius: 999, textDecoration: 'none' }}
                                    >
                                        {s.label}
                                    </a>
                                ))}
                            </div>
                        )}

                        <div style={{ marginTop: 24 }}>
                            <Link href="/" style={{ fontSize: 14, color: '#5b4fcf', textDecoration: 'none' }}>← Back to blog</Link>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
