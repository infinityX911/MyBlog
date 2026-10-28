'use client';
/**
 * components/admin/account/EditProfileTab.tsx
 *
 * "Edit Profile" tab — Public / Private / Social information.
 * Dumb component: all values + setField come from the parent page.
 * Role and Status are READ-ONLY badges (admin-controlled).
 */

import { useRef } from 'react';

export interface ProfileForm {
    name: string;
    username: string;
    bio: string;
    phone: string;
    location: string;       // shown as "Address"
    facebook: string;
    twitter: string;
    linkedin: string;
    instagram: string;
    youtube: string;
    pinterest: string;
}

interface Props {
    form: ProfileForm;
    setField: (key: keyof ProfileForm, value: string) => void;
    email: string;
    role: string;
    status: string;         // approved | pending | blocked
    avatarSrc: string;
    onFileChange: (file: File) => void;
}

const STATUS_ICON: Record<string, string> = {
    approved: 'bi-patch-check-fill',
    pending: 'bi-hourglass-split',
    blocked: 'bi-slash-circle-fill',
};

export default function EditProfileTab({
    form, setField, email, role, status, avatarSrc, onFileChange,
}: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const statusKey = (status || 'pending').toLowerCase();

    function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (f) onFileChange(f);
        e.target.value = '';
    }

    return (
        <>
            {/* ── Public Information ───────────────────────────── */}
            <section className="acc-section">
                <h3 className="acc-section-title">Public Information</h3>

                <div className="acc-public">
                    <div className="acc-avatar-col">
                        <div className="acc-avatar-ring">
                            <img src={avatarSrc} alt={`${form.name || 'User'} avatar`} />
                        </div>
                        <button type="button" className="acc-upload-btn" onClick={() => fileRef.current?.click()}>
                            <i className="bi bi-cloud-arrow-up-fill" aria-hidden="true" />
                            UPLOAD
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                            style={{ display: 'none' }}
                            onChange={pickFile}
                            aria-label="Upload profile photo"
                        />
                    </div>

                    <div className="acc-public-fields">
                        <div className="acc-grid">
                            <div className="acc-field">
                                <label htmlFor="f-name">Fullname<span className="req">*</span></label>
                                <input id="f-name" type="text" value={form.name}
                                    onChange={e => setField('name', e.target.value)}
                                    placeholder="Your full name" maxLength={80} autoComplete="name" />
                            </div>
                            <div className="acc-field">
                                <label htmlFor="f-username">Username</label>
                                <div className="acc-input-icon">
                                    <i className="bi bi-at" aria-hidden="true" />
                                    <input id="f-username" type="text" value={form.username}
                                        onChange={e => setField('username', e.target.value)}
                                        placeholder="username" maxLength={50} autoComplete="username" />
                                </div>
                            </div>
                        </div>
                        <div className="acc-field full">
                            <label htmlFor="f-bio">Biography</label>
                            <textarea id="f-bio" value={form.bio}
                                onChange={e => setField('bio', e.target.value)}
                                placeholder="Tell us a little about yourself…" maxLength={500} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Private Information ──────────────────────────── */}
            <section className="acc-section">
                <h3 className="acc-section-title">Private Information</h3>

                <div className="acc-grid">
                    <div className="acc-field">
                        <label>Role <span className="acc-readonly-hint">set by admin</span></label>
                        <span className="acc-badge role">
                            <i className="bi bi-person-badge-fill" aria-hidden="true" />
                            {role || 'No role assigned'}
                        </span>
                    </div>
                    <div className="acc-field">
                        <label>Status <span className="acc-readonly-hint">set by admin</span></label>
                        <span className={`acc-badge status-${statusKey}`}>
                            <i className={`bi ${STATUS_ICON[statusKey] ?? 'bi-question-circle-fill'}`} aria-hidden="true" />
                            {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
                        </span>
                    </div>

                    <div className="acc-field">
                        <label htmlFor="f-email">Email <span className="acc-readonly-hint">cannot be changed</span></label>
                        <input id="f-email" type="email" value={email} disabled autoComplete="email" />
                    </div>
                    <div className="acc-field">
                        <label htmlFor="f-phone">Phone</label>
                        <input id="f-phone" type="tel" value={form.phone}
                            onChange={e => setField('phone', e.target.value)}
                            placeholder="+92 300 0000000" maxLength={20} autoComplete="tel" />
                    </div>

                    <div className="acc-field full">
                        <label htmlFor="f-address">Address</label>
                        <textarea id="f-address" value={form.location}
                            onChange={e => setField('location', e.target.value)}
                            placeholder="Street, City, State (ZIP)" maxLength={160}
                            style={{ minHeight: 80 }} autoComplete="street-address" />
                    </div>
                </div>
            </section>

            {/* ── Social Information ───────────────────────────── */}
            <section className="acc-section">
                <h3 className="acc-section-title">Social Information</h3>

                <div className="acc-grid">
                    {([
                        ['facebook', 'Facebook', 'bi-facebook'],
                        ['twitter', 'Twitter', 'bi-twitter-x'],
                        ['linkedin', 'Linkedin', 'bi-linkedin'],
                        ['instagram', 'Instagram', 'bi-instagram'],
                        ['youtube', 'Youtube', 'bi-youtube'],
                        ['pinterest', 'Pinterest', 'bi-pinterest'],
                    ] as const).map(([key, label, icon]) => (
                        <div className="acc-field" key={key}>
                            <label htmlFor={`f-${key}`}>{label}</label>
                            <div className="acc-input-icon">
                                <i className={`bi ${icon}`} aria-hidden="true" />
                                <input id={`f-${key}`} type="url" value={form[key]}
                                    onChange={e => setField(key, e.target.value)}
                                    placeholder="https://example.com/" maxLength={255} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

        </>
    );
}
