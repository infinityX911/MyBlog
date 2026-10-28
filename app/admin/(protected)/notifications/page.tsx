'use client';

import { Col, Container, Row } from 'react-bootstrap';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DownloadIcon from '@mui/icons-material/Download';
import NotificationItem from '@/components/admin/notifications/NotificationItem';
import { useAdmin } from '@/context/AdminContext';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import { resolveVisual, timeAgo, type IconConfigMap } from '@/lib/notificationVisuals';

export default function NotificationsPage() {
    const router = useRouter();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [iconConfig, setIconConfig] = useState<IconConfigMap>({});

    // Load the admin-configured icon/colour map once.
    useEffect(() => {
        fetch('/api/notification-icons')
            .then(r => r.json())
            .then(d => {
                const map: IconConfigMap = {};
                (d.items ?? []).forEach((it: any) => { map[it.typeKey] = { icon: it.icon, color: it.color }; });
                setIconConfig(map);
            })
            .catch(() => { /* fallback visuals will be used */ });
    }, []);

    const {
        notifications,
        markNotificationAsRead,
        deleteNotification,
        markAllNotificationsAsRead,
        markAllNotificationsAsUnread,
        deleteAllNotifications,
    } = useAdmin();

    const open = Boolean(anchorEl);
    const handleMenuOpen  = (e: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(e.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // Export the current notifications as a CSV file (client-side, no server
    // round-trip) — useful as an audit/record export.
    const exportCsv = () => {
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const header = ['Type', 'Message', 'Actor', 'Read', 'Created At'];
        const rows = notifications.map(n => [
            esc(n.type),
            esc(n.message),
            esc(n.actorName ?? ''),
            esc(n.isRead ? 'yes' : 'no'),
            esc(n.createdAt),
        ].join(','));
        const csv = [header.map(esc).join(','), ...rows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notifications-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleRowClick = (n: (typeof notifications)[number]) => {
        markNotificationAsRead(n.id);
        if (n.link) {
            // Strip ?commentId before navigating — that param is only for
            // matching the DB row on delete, not for UI navigation.
            const navUrl = n.link.split('?')[0];
            router.push(navUrl);
        }
    };

    return (
        <Container fluid className="right-content">

            <HeaderPanel
                title="Notifications"
                breadcrumbs={[
                    { label: 'Home',          path: '/' },
                    { label: 'Dashboard',     path: '/admin/dashboard' },
                    { label: 'Notifications', path: '/admin/notifications' },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <Container fluid>

                            {/* Header row */}
                            <Row>
                                <Col xs={6} style={{ marginBottom: '10px' }}>
                                    <h3 className="hd">All Notifications</h3>
                                </Col>
                                <Col xs={6} style={{ textAlign: 'right' }}>
                                    {/*
                                     * Plain <button> instead of MUI IconButton —
                                     * MUI adds its own background/ripple CSS that
                                     * can't be fully overridden with inline styles.
                                     * Plain button stays truly transparent in both
                                     * light and dark mode.
                                     */}
                                    <button
                                        onClick={handleMenuOpen}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '5px',
                                            cursor: 'pointer',
                                            color: 'inherit',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '50%',
                                            lineHeight: 0,
                                        }}
                                        title="Options"
                                    >
                                        <MoreHorizIcon />
                                    </button>

                                    <Menu
                                        anchorEl={anchorEl}
                                        open={open}
                                        onClose={handleMenuClose}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                    >
                                        <MenuItem onClick={() => { markAllNotificationsAsRead(); handleMenuClose(); }}>
                                            <ListItemIcon><DoneAllIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText>Mark all as read</ListItemText>
                                        </MenuItem>
                                        <MenuItem onClick={() => { markAllNotificationsAsUnread(); handleMenuClose(); }}>
                                            <ListItemIcon><MarkEmailUnreadIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText>Mark all as unread</ListItemText>
                                        </MenuItem>
                                        <MenuItem onClick={() => { exportCsv(); handleMenuClose(); }}>
                                            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText>Export (CSV)</ListItemText>
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() => {
                                                if (confirm('Delete ALL notifications? This cannot be undone.')) deleteAllNotifications();
                                                handleMenuClose();
                                            }}
                                        >
                                            <ListItemIcon><DeleteSweepIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText>Delete all</ListItemText>
                                        </MenuItem>
                                    </Menu>
                                </Col>
                            </Row>

                            {notifications.length === 0 && (
                                <p className="para text-center py-4 mb-0" style={{ color: '#888' }}>
                                    No notifications yet.
                                </p>
                            )}

                            {notifications.map(notification => {
                                const { icon, background } = resolveVisual(notification.type, iconConfig);
                                const avatarUrl =
                                    notification.actorAvatarUrl
                                    || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        notification.actorName || 'N'
                                    )}&background=0858f7&color=fff&size=70`;

                                return (
                                    <div
                                        key={notification.id}
                                        className={`notificationListForHover ${notification.isRead ? 'read' : 'unreadd'}`}
                                        style={{
                                            borderRadius: '6px',
                                            marginBottom: '8px',
                                            padding: '4px',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => handleRowClick(notification)}
                                    >
                                        <NotificationItem
                                            name={notification.actorName ?? undefined}
                                            message={notification.message}
                                            item=""
                                            timeAgo={timeAgo(notification.createdAt)}
                                            image={avatarUrl}
                                            icon={icon}
                                            iconBackground={background}
                                            isRead={notification.isRead}
                                            onDelete={() => deleteNotification(notification.id)}
                                        />
                                    </div>
                                );
                            })}

                        </Container>
                    </div>
                </Col>
            </Row>

        </Container>
    );
}
