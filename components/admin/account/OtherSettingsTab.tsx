'use client';
/**
 * components/admin/account/OtherSettingsTab.tsx
 *
 * "Other Settings" tab — email notification preferences, two columns.
 * Excluded per request: "New membership approval",
 * "Send Copy To Personal Email", "Tips on getting more out of PCT-themes".
 */

export interface EmailSettings {
    emailActivityConnection: boolean;
    emailActivityMessage: boolean;
    emailProductConnection: boolean;
    emailProductMessage: boolean;
}

interface Props {
    settings: EmailSettings;
    setSetting: (key: keyof EmailSettings, value: boolean) => void;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void; }) {
    return (
        <div className="acc-toggle-row">
            <label className="acc-switch">
                <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
                <span className="slider" />
            </label>
            <span>{label}</span>
        </div>
    );
}

export default function OtherSettingsTab({ settings, setSetting }: Props) {
    return (
        <div className="acc-settings-cols">
            <section>
                <h3 className="acc-section-title">Activity Email Settings</h3>
                <Toggle label="Someone adds you as a connection"
                    checked={settings.emailActivityConnection}
                    onChange={v => setSetting('emailActivityConnection', v)} />
                <Toggle label="You're sent a direct message"
                    checked={settings.emailActivityMessage}
                    onChange={v => setSetting('emailActivityMessage', v)} />
            </section>

            <section>
                <h3 className="acc-section-title">Product Email Settings</h3>
                <Toggle label="Someone adds you as a connection"
                    checked={settings.emailProductConnection}
                    onChange={v => setSetting('emailProductConnection', v)} />
                <Toggle label="You're sent a direct message"
                    checked={settings.emailProductMessage}
                    onChange={v => setSetting('emailProductMessage', v)} />
            </section>
        </div>
    );
}
