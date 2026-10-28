'use client';

/**
 * app/admin/(protected)/management/notification-icons/page.tsx
 *
 * Management → Notification Icons.
 * Pick which icon + colour represents each notification / activity type.
 * Saved to the notification_icons table; the notification dropdown,
 * Notifications page and Recent Activities all resolve visuals from here.
 *
 * Saving requires the 'manage-notifications' permission (enforced by the API).
 */

import React, { useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import { ICON_NAMES, COLOR_PRESETS, renderIcon } from '@/lib/notificationVisuals';
import '@/app/admin/css/notification-icons.css';

interface IconRow {
    typeKey: string;
    label: string;
    icon: string;
    color: string;
    customised: boolean;
}

export default function NotificationIconsPage() {
    const [rows, setRows] = useState<IconRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        fetch('/api/notification-icons')
            .then(r => r.json())
            .then(d => setRows(d.items ?? []))
            .catch(() => setMsg('Could not load.'))
            .finally(() => setLoading(false));
    }, []);

    const update = (typeKey: string, field: 'icon' | 'color', value: string) =>
        setRows(prev => prev.map(r => r.typeKey === typeKey ? { ...r, [field]: value } : r));

    async function save() {
        setSaving(true); setMsg('');
        try {
            const res = await fetch('/api/notification-icons', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: rows }),
            });
            const data = await res.json();
            if (!res.ok) { setMsg(data.error ?? 'Save failed.'); return; }
            setMsg('Saved! Icons updated everywhere.');
        } catch {
            setMsg('Network error.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Notification Icons"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Management', path: '/admin/management/users' },
                    { label: 'Notification Icons', path: '/admin/management/notification-icons' },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <div className="nicons-head">
                            <h3 className="hd" style={{ margin: 0 }}>Notification Icons</h3>
                            <button className="acc-save-btn" onClick={save} disabled={saving}>
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                        <p className="para" style={{ opacity: 0.7, marginTop: 8 }}>
                            Choose the icon and colour shown for each type of notification &amp; activity.
                        </p>
                        {msg && (
                            <p className="para" style={{ color: msg.startsWith('Saved') ? '#16a34a' : '#dc2626' }}>{msg}</p>
                        )}

                        {loading ? (
                            <p className="para" style={{ color: '#888', padding: '30px 0' }}>Loading…</p>
                        ) : (
                            <div className="nicons-grid">
                                {rows.map(row => (
                                    <div key={row.typeKey} className="nicon-row">
                                        <div className="nicon-preview" style={{ background: row.color }}>
                                            {renderIcon(row.icon, '#fff')}
                                        </div>

                                        <div className="nicon-meta">
                                            <span className="nicon-label">{row.label}</span>
                                            <code className="nicon-key">{row.typeKey}</code>
                                        </div>

                                        <div className="nicon-icons">
                                            {ICON_NAMES.map(name => {
                                                const active = row.icon === name;
                                                return (
                                                    <button
                                                        key={name}
                                                        type="button"
                                                        title={name}
                                                        className={`nicon-pick${active ? ' active' : ''}`}
                                                        onClick={() => update(row.typeKey, 'icon', name)}
                                                        style={active ? { background: row.color, borderColor: row.color } : undefined}
                                                    >
                                                        {renderIcon(name, active ? '#fff' : '#6b7280')}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="nicon-colors">
                                            {COLOR_PRESETS.map(c => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    title={c}
                                                    className={`nicon-color${row.color === c ? ' active' : ''}`}
                                                    style={{ background: c }}
                                                    onClick={() => update(row.typeKey, 'color', c)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Col>
            </Row>
        </Container>
    );
}
