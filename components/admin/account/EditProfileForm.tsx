'use client';
/**
 * components/admin/account/EditProfileForm.tsx
 *
 * Right-column edit form. Handles its own field state; calls
 * onSave(data) when submitted so the parent page handles the
 * actual API call. This separation keeps the component reusable
 * and the page responsible for data-fetching/mutation.
 */

import { useState, useEffect } from 'react';

export interface ProfileFormData {
    firstName: string;
    lastName: string;
    phone: string;
    bio: string;
    location: string;
    newPassword: string;
}

interface EditProfileFormProps {
    initialFirstName?: string;
    initialLastName?: string;
    initialPhone?: string;
    initialBio?: string;
    initialLocation?: string;
    email: string;
    saving: boolean;
    success: string;
    error: string;
    onSave: (data: ProfileFormData) => Promise<void>;
}

export default function EditProfileForm({
    initialFirstName = '',
    initialLastName  = '',
    initialPhone     = '',
    initialBio       = '',
    initialLocation  = '',
    email,
    saving,
    success,
    error,
    onSave,
}: EditProfileFormProps) {
    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName,  setLastName]  = useState(initialLastName);
    const [phone,     setPhone]     = useState(initialPhone);
    const [bio,       setBio]       = useState(initialBio);
    const [location,  setLocation]  = useState(initialLocation);
    const [newPass,   setNewPass]   = useState('');
    const [confPass,  setConfPass]  = useState('');
    const [localErr,  setLocalErr]  = useState('');

    // Sync when parent loads profile data
    useEffect(() => { setFirstName(initialFirstName); }, [initialFirstName]);
    useEffect(() => { setLastName(initialLastName);   }, [initialLastName]);
    useEffect(() => { setPhone(initialPhone);         }, [initialPhone]);
    useEffect(() => { setBio(initialBio);             }, [initialBio]);
    useEffect(() => { setLocation(initialLocation);   }, [initialLocation]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLocalErr('');

        const name = `${firstName.trim()} ${lastName.trim()}`.trim();
        if (!name || name.length < 2) {
            setLocalErr('Please enter your first and last name.');
            return;
        }
        if (newPass && newPass !== confPass) {
            setLocalErr('Passwords do not match.');
            return;
        }
        if (newPass && newPass.length < 8) {
            setLocalErr('Password must be at least 8 characters.');
            return;
        }

        await onSave({ firstName, lastName, phone, bio, location, newPassword: newPass });

        // Clear password fields on success
        if (!error) {
            setNewPass('');
            setConfPass('');
        }
    }

    const displayError = localErr || error;

    return (
        <section className="edit-card" id="edit-form" aria-label="Edit profile form">
            <form onSubmit={handleSubmit} noValidate>

                {/* Alerts */}
                {success && (
                    <div className="account-alert-wrap">
                        <p className="account-alert success" role="status" aria-live="polite">
                            <i className="bi bi-check-circle-fill" aria-hidden="true" />
                            {success}
                        </p>
                    </div>
                )}
                {displayError && (
                    <div className="account-alert-wrap">
                        <p className="account-alert error" role="alert">
                            <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
                            {displayError}
                        </p>
                    </div>
                )}

                {/* ── Basic Info ────────────────────────────────── */}
                <div className="edit-card-section">
                    <h6 className="edit-section-title">
                        <i className="bi bi-person-fill" aria-hidden="true" />
                        Basic Information
                    </h6>

                    <div className="edit-row">
                        <div className="edit-field">
                            <label htmlFor="acc-first-name">First Name</label>
                            <input
                                id="acc-first-name"
                                type="text"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                                placeholder="First name"
                                maxLength={40}
                                autoComplete="given-name"
                            />
                        </div>
                        <div className="edit-field">
                            <label htmlFor="acc-last-name">Last Name</label>
                            <input
                                id="acc-last-name"
                                type="text"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                                placeholder="Last name"
                                maxLength={40}
                                autoComplete="family-name"
                            />
                        </div>

                        <div className="edit-field">
                            <label htmlFor="acc-email">
                                Email Address
                                <span style={{ fontSize: '11px', fontWeight: 400, color: '#aaa', marginLeft: '6px' }}>
                                    (cannot be changed)
                                </span>
                            </label>
                            <input
                                id="acc-email"
                                type="email"
                                value={email}
                                disabled
                                aria-readonly="true"
                                autoComplete="email"
                            />
                        </div>
                        <div className="edit-field">
                            <label htmlFor="acc-phone">Phone Number</label>
                            <input
                                id="acc-phone"
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="+92 300 0000000"
                                maxLength={20}
                                autoComplete="tel"
                            />
                        </div>

                        <div className="edit-field full">
                            <label htmlFor="acc-location">Location</label>
                            <input
                                id="acc-location"
                                type="text"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                placeholder="City, Country"
                                maxLength={120}
                                autoComplete="address-level2"
                            />
                        </div>

                        <div className="edit-field full">
                            <label htmlFor="acc-bio">Bio</label>
                            <textarea
                                id="acc-bio"
                                rows={3}
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                placeholder="Tell us a little about yourself…"
                                maxLength={300}
                            />
                        </div>
                    </div>
                </div>

                <hr className="edit-divider" />

                {/* ── Change Password ───────────────────────────── */}
                <div className="edit-card-section">
                    <h6 className="edit-section-title">
                        <i className="bi bi-lock-fill" aria-hidden="true" />
                        Change Password
                        <span className="hint">(leave blank to keep current)</span>
                    </h6>

                    <div className="edit-row">
                        <div className="edit-field">
                            <label htmlFor="acc-new-pass">New Password</label>
                            <input
                                id="acc-new-pass"
                                type="password"
                                value={newPass}
                                onChange={e => setNewPass(e.target.value)}
                                placeholder="Min 8 characters"
                                minLength={8}
                                maxLength={200}
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="edit-field">
                            <label htmlFor="acc-conf-pass">Confirm Password</label>
                            <input
                                id="acc-conf-pass"
                                type="password"
                                value={confPass}
                                onChange={e => setConfPass(e.target.value)}
                                placeholder="Re-enter password"
                                maxLength={200}
                                autoComplete="new-password"
                            />
                        </div>
                    </div>
                </div>

                <hr className="edit-divider" />

                {/* ── Save button ───────────────────────────────── */}
                <div className="edit-card-section" style={{ paddingBottom: '24px' }}>
                    <button
                        type="submit"
                        className="account-save-btn"
                        disabled={saving}
                        aria-busy={saving}
                    >
                        {saving ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status" aria-label="Saving" />
                                Saving…
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check2-circle" aria-hidden="true" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>

            </form>
        </section>
    );
}
