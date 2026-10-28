'use client';

/**
 * RecentActivity.tsx  (Phase 2 — real data)
 *
 * Pulls the live activity feed from /api/activities (written by
 * lib/activity.ts → recordEvent() on every action across the app) and
 * subscribes to the same Socket.io 'new-notification' channel so new
 * activity appears instantly without a reload.
 *
 * Users with the 'view-activities' permission see the GLOBAL feed; everyone
 * else sees only their own activity (the API scopes this server-side).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';

interface Activity {
    id: number;
    type: string;
    action: string;
    description: string | null;
    link: string | null;
    createdAt: string;
    actorName: string | null;
    actorAvatarUrl: string | null;
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d > 1 ? 's' : ''} ago`;
}

function RecentActivity() {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/activities?limit=20');
            const data = await res.json();
            if (res.ok) setActivities(data.activities ?? []);
        } catch {
            /* non-critical */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const socket: Socket = io({ path: '/api/socket' });
        socket.on('connect', () => socket.emit('join-admin-room'));
        // Any new notification means a new activity row was written too —
        // cheapest correct refresh is to re-pull the (small) feed.
        socket.on('new-notification', () => load());
        return () => { socket.disconnect(); };
    }, [load]);

    const handleClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleClose = () => setAnchorEl(null);

    async function clearFeed() {
        handleClose();
        if (!confirm('Clear the entire activity log? This cannot be undone.')) return;
        try {
            const res = await fetch('/api/activities', { method: 'DELETE' });
            if (res.ok) setActivities([]);
            else alert('You do not have permission to clear activities.');
        } catch { /* ignore */ }
    }

    return (
        <Container fluid className="activity-scroll-container" style={{ height: '452px' }}>
            <Row style={{ marginBottom: '18px' }}>
                <Col xs={6}><h4 className="hd">Recent Activities</h4></Col>
                <Col xs={6} style={{ textAlign: 'right' }}>
                    <IconButton onClick={handleClick} className="OptionClick" style={{ padding: '5px' }}>
                        <MoreHorizIcon />
                    </IconButton>
                    <Menu anchorEl={anchorEl} open={open} onClose={handleClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                        <MenuItem onClick={() => { handleClose(); load(); }}>
                            <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Refresh</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={clearFeed}>
                            <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Clear log</ListItemText>
                        </MenuItem>
                    </Menu>
                </Col>
            </Row>

            <Row>
                <Col xs={12}>
                    {loading ? (
                        <p className="para" style={{ color: '#999' }}>Loading activities…</p>
                    ) : activities.length === 0 ? (
                        <p className="para" style={{ color: '#999' }}>No activity yet.</p>
                    ) : (
                        <ul className="activity-timeline">
                            {activities.map((a) => (
                                <li className="activity-item" key={a.id}>
                                    <Container fluid style={{ border: 0, padding: 0 }}>
                                        <Row style={{ border: 0, padding: 0 }}>
                                            <Col xs={12} md={8} style={{ border: 0, padding: 0 }}>
                                                <div className="ActivityTitle"><h6>{a.action}</h6></div>
                                            </Col>
                                            <Col xs={12} md={4} style={{ border: 0, padding: 0 }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <small>{timeAgo(a.createdAt)}</small>
                                                </div>
                                            </Col>
                                        </Row>
                                        {a.description && (
                                            <Row><Col xs={12}><div className="para">{a.description}</div></Col></Row>
                                        )}
                                        <Row>
                                            <Col xs={12}>
                                                <div className="activity-card-media-div">
                                                    <img
                                                        src={a.actorAvatarUrl
                                                            || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.actorName || 'System')}&background=0858f7&color=fff&size=40&bold=true`}
                                                        alt=""
                                                    />
                                                    <h6>{a.actorName ?? 'System'}</h6>
                                                </div>
                                                {a.link && (
                                                    <div className="activity-card-button-div">
                                                        <Link href={a.link} className="btn">Go There</Link>
                                                    </div>
                                                )}
                                            </Col>
                                        </Row>
                                    </Container>
                                </li>
                            ))}
                        </ul>
                    )}
                </Col>
            </Row>
        </Container>
    );
}

export default RecentActivity;
