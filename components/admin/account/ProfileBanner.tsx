'use client';
/**
 * components/admin/account/ProfileBanner.tsx
 *
 * Top card: cover gradient, overlapping avatar, name, action buttons, stats.
 * Reusable — pass any profile data via props.
 */

import { useRef } from 'react';

interface StatItem {
    label: string;
    value: number | string;
}

interface ProfileBannerProps {
    name: string;
    email: string;
    avatarSrc: string;
    stats?: StatItem[];
    onFileChange: (file: File) => void;
    onEditClick?: () => void;
}

const DEFAULT_STATS: StatItem[] = [
    { label: 'Posts',     value: 0 },
    { label: 'Followers', value: 0 },
    { label: 'Following', value: 0 },
];

export default function ProfileBanner({
    name,
    email,
    avatarSrc,
    stats = DEFAULT_STATS,
    onFileChange,
    onEditClick,
}: ProfileBannerProps) {
    const fileRef = useRef<HTMLInputElement>(null);

    function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (f) onFileChange(f);
        // Reset so same file can be re-selected
        e.target.value = '';
    }

    return (
        <div className="profile-banner-card">

            {/* Cover gradient */}
            <div className="profile-cover" role="img" aria-label="Profile cover" />

            {/* Avatar + name + buttons */}
            <div className="profile-info-block">

                {/* Avatar */}
                <div className="profile-avatar-wrap">
                    <div className="profile-avatar-ring">
                        <img src={avatarSrc} alt={`${name}'s profile picture`} />
                        <button
                            type="button"
                            className="avatar-cam-btn"
                            onClick={() => fileRef.current?.click()}
                            aria-label="Change profile photo"
                            title="Change photo"
                        >
                            <i className="bi bi-camera-fill" aria-hidden="true" />
                        </button>
                    </div>
                    {/* Hidden file input */}
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                        style={{ display: 'none' }}
                        onChange={handleFileInput}
                        aria-label="Upload profile photo"
                    />
                </div>

                {/* Name + email + buttons */}
                <div className="profile-name-block">
                    <h4>{name || 'Admin User'}</h4>
                    <p>
                        <i className="bi bi-envelope-fill me-1" style={{ color: '#0858f7' }} aria-hidden="true" />
                        {email}
                    </p>
                    <div className="profile-action-btns">
                        <button
                            type="button"
                            className="profile-btn-primary"
                            onClick={onEditClick}
                            aria-label="Scroll to edit profile form"
                        >
                            <i className="bi bi-pencil-fill" aria-hidden="true" />
                            Edit Profile
                        </button>
                        <button
                            type="button"
                            className="profile-btn-outline"
                            aria-label="Account settings"
                        >
                            <i className="bi bi-gear-fill" aria-hidden="true" />
                            Settings
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="profile-stats" role="list" aria-label="Profile statistics">
                {stats.map((s) => (
                    <div key={s.label} className="profile-stat" role="listitem">
                        <span className="stat-num">{s.value}</span>
                        <span className="stat-lbl">{s.label}</span>
                    </div>
                ))}
            </div>

        </div>
    );
}
