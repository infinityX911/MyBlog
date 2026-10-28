'use client';
/**
 * app/admin/(protected)/account/page.tsx  (Phase 2 redesign)
 *
 * Tabbed "My Account":
 *   • Edit Profile     → Public / Private / Social information
 *   • Change Password  → current + new + confirm (current verified server-side)
 *   • Other Settings   → email notification preferences
 *
 * Role and Status are READ-ONLY (admin-controlled). Each save logs an
 * Activity and notifies admins via the server.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import EditProfileTab, { ProfileForm } from '@/components/admin/account/EditProfileTab';
import ChangePasswordTab from '@/components/admin/account/ChangePasswordTab';
import OtherSettingsTab, { EmailSettings } from '@/components/admin/account/OtherSettingsTab';

type Tab = 'profile' | 'password' | 'settings';

const GENDER_AVATARS: Record<string, string> = {
    MALE: '/avatars/male.svg',
    FEMALE: '/avatars/female.svg',
};

const EMPTY_FORM: ProfileForm = {
    name: '', username: '', bio: '', phone: '', location: '',
    facebook: '', twitter: '', linkedin: '', instagram: '', youtube: '', pinterest: '',
};

const EMPTY_SETTINGS: EmailSettings = {
    emailActivityConnection: true,
    emailActivityMessage: true,
    emailProductConnection: false,
    emailProductMessage: false,
};

export default function AccountPage() {
    const { update: updateSession } = useSession();

    const [tab, setTab] = useState<Tab>('profile');
    // Open a specific tab via ?tab=password|settings (e.g. navbar "Reset Password").
    useEffect(() => {
        const t = new URLSearchParams(window.location.search).get('tab');
        if (t === 'password' || t === 'settings' || t === 'profile') setTab(t as Tab);
    }, []);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // read-only / meta
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('');
    const [status, setStatus] = useState('pending');
    const [gender, setGender] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    // editable form
    const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
    const [settings, setSettings] = useState<EmailSettings>(EMPTY_SETTINGS);

    // password
    const [curPass, setCurPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confPass, setConfPass] = useState('');

    // avatar preview
    const [preview, setPreview] = useState<string | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    // ── Load profile ──────────────────────────────────────────
    useEffect(() => {
        fetch('/api/user/profile')
            .then(r => r.json())
            .then(d => {
                const u = d.user;
                if (u) {
                    setEmail(u.email ?? '');
                    setStatus(u.status ?? 'pending');
                    setGender(u.gender ?? null);
                    setAvatarUrl(u.avatarUrl ?? null);
                    setForm({
                        name: u.name ?? '',
                        username: u.username ?? '',
                        bio: u.bio ?? '',
                        phone: u.phone ?? '',
                        location: u.location ?? '',
                        facebook: u.facebook ?? '',
                        twitter: u.twitter ?? '',
                        linkedin: u.linkedin ?? '',
                        instagram: u.instagram ?? '',
                        youtube: u.youtube ?? '',
                        pinterest: u.pinterest ?? '',
                    });
                    setSettings({
                        emailActivityConnection: !!u.emailActivityConnection,
                        emailActivityMessage: !!u.emailActivityMessage,
                        emailProductConnection: !!u.emailProductConnection,
                        emailProductMessage: !!u.emailProductMessage,
                    });
                }
                if (d.roles?.length) setRole(d.roles.map((r: any) => r.name).join(', '));
            })
            .catch(() => setError('Could not load your profile.'))
            .finally(() => setLoading(false));
    }, []);

    const setField = (key: keyof ProfileForm, value: string) =>
        setForm(prev => ({ ...prev, [key]: value }));
    const setSetting = (key: keyof EmailSettings, value: boolean) =>
        setSettings(prev => ({ ...prev, [key]: value }));

    const avatarSrc =
        preview
        || avatarUrl
        || (gender ? GENDER_AVATARS[gender] : null)
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name || 'Admin')}&background=0858f7&color=fff&size=170&bold=true`;

    function handleFileChange(file: File) {
        if (preview) URL.revokeObjectURL(preview);
        setPreview(URL.createObjectURL(file));
        setPendingFile(file);
        setSuccess(''); setError('');
    }

    // ── Save profile (Edit Profile tab) ───────────────────────
    async function saveProfile() {
        setSaving(true); setSuccess(''); setError('');
        try {
            let uploadedUrl: string | undefined;
            if (pendingFile) {
                const fd = new FormData();
                fd.append('file', pendingFile);
                const up = await fetch('/api/user/avatar', { method: 'POST', body: fd });
                const upData = await up.json();
                if (!up.ok) { setError(upData.error ?? 'Photo upload failed.'); return; }
                uploadedUrl = upData.url;
            }

            const body: Record<string, unknown> = {
                name: form.name.trim(),
                username: form.username.trim(),
                bio: form.bio.trim(),
                phone: form.phone.trim(),
                location: form.location.trim(),
                facebook: form.facebook.trim(),
                twitter: form.twitter.trim(),
                linkedin: form.linkedin.trim(),
                instagram: form.instagram.trim(),
                youtube: form.youtube.trim(),
                pinterest: form.pinterest.trim(),
            };
            if (uploadedUrl) body.avatarUrl = uploadedUrl;

            const res = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Update failed.'); return; }

            if (data.user?.avatarUrl !== undefined) setAvatarUrl(data.user.avatarUrl);
            if (preview) { URL.revokeObjectURL(preview); setPreview(null); }
            setPendingFile(null);
            await updateSession();
            setSuccess('Profile updated successfully!');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    // ── Save password (Change Password tab) ───────────────────
    async function savePassword() {
        setSuccess(''); setError('');
        if (!curPass) { setError('Please enter your current password.'); return; }
        if (newPass.length < 8) { setError('New password must be at least 8 characters.'); return; }
        if (newPass !== confPass) { setError('New passwords do not match.'); return; }

        setSaving(true);
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: curPass, password: newPass }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Could not change password.'); return; }
            setCurPass(''); setNewPass(''); setConfPass('');
            setSuccess('Password changed successfully!');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    // ── Save settings (Other Settings tab) ────────────────────
    async function saveSettings() {
        setSaving(true); setSuccess(''); setError('');
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Could not save settings.'); return; }
            setSuccess('Settings saved successfully!');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    function onSave() {
        if (tab === 'profile') saveProfile();
        else if (tab === 'password') savePassword();
        else saveSettings();
    }

    if (loading) {
        return (
            <div className="right-content">
                <HeaderPanel title="My Account" breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Account', path: '/admin/account' }]} />
                <div className="acc-card"><p className="acc-loading">Loading your account…</p></div>
            </div>
        );
    }

    return (
        <div className="right-content">
            <HeaderPanel
                title="My Account"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Users', path: '/admin/management/users' },
                    { label: 'My Account', path: '/admin/account' },
                ]}
            />

            <div className="acc-card">
                {/* Tabs */}
                <div className="acc-tabs" role="tablist">
                    <button className={`acc-tab${tab === 'profile' ? ' active' : ''}`} onClick={() => { setTab('profile'); setSuccess(''); setError(''); }}>
                        <i className="bi bi-person-fill" aria-hidden="true" /> Edit Profile
                    </button>
                    <button className={`acc-tab${tab === 'password' ? ' active' : ''}`} onClick={() => { setTab('password'); setSuccess(''); setError(''); }}>
                        <i className="bi bi-lock-fill" aria-hidden="true" /> Change Password
                    </button>
                    <button className={`acc-tab${tab === 'settings' ? ' active' : ''}`} onClick={() => { setTab('settings'); setSuccess(''); setError(''); }}>
                        <i className="bi bi-gear-fill" aria-hidden="true" /> Other Settings
                    </button>
                </div>

                {/* Alerts */}
                {success && (
                    <p className="acc-alert success" role="status" aria-live="polite">
                        <i className="bi bi-check-circle-fill" aria-hidden="true" /> {success}
                    </p>
                )}
                {error && (
                    <p className="acc-alert error" role="alert">
                        <i className="bi bi-exclamation-circle-fill" aria-hidden="true" /> {error}
                    </p>
                )}

                {/* Tab content */}
                {tab === 'profile' && (
                    <EditProfileTab
                        form={form}
                        setField={setField}
                        email={email}
                        role={role}
                        status={status}
                        avatarSrc={avatarSrc}
                        onFileChange={handleFileChange}
                    />
                )}
                {tab === 'password' && (
                    <ChangePasswordTab
                        current={curPass} next={newPass} confirm={confPass}
                        setCurrent={setCurPass} setNext={setNewPass} setConfirm={setConfPass}
                    />
                )}
                {tab === 'settings' && (
                    <OtherSettingsTab settings={settings} setSetting={setSetting} />
                )}

                {/* Save */}
                <div className="acc-actions">
                    <button className="acc-save-btn" onClick={onSave} disabled={saving} aria-busy={saving}>
                        {saving ? (
                            <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" /> Saving…</>
                        ) : (
                            <><i className="bi bi-patch-check-fill" aria-hidden="true" /> {tab === 'settings' ? 'Update Changes' : 'Save Changes'}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
