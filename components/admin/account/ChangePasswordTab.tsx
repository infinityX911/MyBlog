'use client';
/**
 * components/admin/account/ChangePasswordTab.tsx
 *
 * "Change Password" tab. Requires the current password (verified
 * server-side) before setting a new one.
 */

interface Props {
    current: string;
    next: string;
    confirm: string;
    setCurrent: (v: string) => void;
    setNext: (v: string) => void;
    setConfirm: (v: string) => void;
}

export default function ChangePasswordTab({
    current, next, confirm, setCurrent, setNext, setConfirm,
}: Props) {
    return (
        <section className="acc-section">
            <h3 className="acc-section-title">Generate Password</h3>

            <div className="acc-field full" style={{ marginBottom: 18 }}>
                <label htmlFor="p-current">Current Password<span className="req">*</span></label>
                <div className="acc-input-icon">
                    <i className="bi bi-lock-fill" aria-hidden="true" />
                    <input id="p-current" type="password" value={current}
                        onChange={e => setCurrent(e.target.value)}
                        placeholder="current password" autoComplete="current-password" maxLength={200} />
                </div>
            </div>

            <div className="acc-grid">
                <div className="acc-field">
                    <label htmlFor="p-new">New Password<span className="req">*</span></label>
                    <div className="acc-input-icon">
                        <i className="bi bi-shield-lock-fill" aria-hidden="true" />
                        <input id="p-new" type="password" value={next}
                            onChange={e => setNext(e.target.value)}
                            placeholder="new password (min 8 chars)" autoComplete="new-password"
                            minLength={8} maxLength={200} />
                    </div>
                </div>
                <div className="acc-field">
                    <label htmlFor="p-confirm">Confirm Password<span className="req">*</span></label>
                    <div className="acc-input-icon">
                        <i className="bi bi-shield-check" aria-hidden="true" />
                        <input id="p-confirm" type="password" value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            placeholder="confirm password" autoComplete="new-password" maxLength={200} />
                    </div>
                </div>
            </div>
        </section>
    );
}
