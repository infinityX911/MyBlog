'use client';

/**
 * app/admin/(protected)/management/users/page.tsx
 * Converted from: pages/Management/Users/ViewUsers.js
 *
 * Changes:
 *  - fetch Laravel -> /api/users
 *  - localStorage Bearer removed
 *  - roles/permissions use explicit join table flatten (same as roles)
 *  - action links lowercase Next.js paths
 *  - tag-pill class instead of badge-secondary
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import DataTable from '@/components/admin/datatable/DataTable';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { FaHourglassHalf, FaCheck, FaBan } from 'react-icons/fa';

function ViewUsers() {
    const router = useRouter();
    const [data, setData] = useState([]);

    useEffect(() => { fetchData(); }, []);

    async function fetchData() {
        try {
            const result = await fetch('/api/users');
            if (result.ok) {
                const data1 = await result.json();
                setData(Array.isArray(data1) ? data1 : []);
            } else {
                router.push('/admin/login');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }

    const filters = useMemo(() => {
        const build = (key: string) => {
            const set = new Set<string>();
            data.forEach((item: any) => {
                const raw = item?.[key];
                if (!raw) return;
                if (Array.isArray(raw)) {
                    raw.forEach((x: any) => x?.name && set.add(x.name));
                } else {
                    const str = String(raw).trim();
                    if (str) set.add(str);
                    str.split(/[\s/_-]+/).forEach((tok: string) => tok && set.add(tok));
                }
            });
            return Array.from(set);
        };
        return {
            name: build('name'),
            email: build('email'),
            roles: build('roles'),
            permissions: build('permissions'),
        };
    }, [data]);

    // Status summary cards (HOTASH-style). Counts come straight from the loaded
    // users list, so they stay in sync without an extra request.
    const counts = useMemo(() => {
        const c = { pending: 0, approved: 0, blocked: 0 };
        data.forEach((u: any) => {
            const s = String(u?.status || 'pending').toLowerCase();
            if (s === 'approved') c.approved++;
            else if (s === 'blocked') c.blocked++;
            else c.pending++;
        });
        return c;
    }, [data]);

    const statCards = [
        { label: 'Pending Users', value: counts.pending, grad: 'linear-gradient(135deg,#c012e2,#eb64fe)', icon: <FaHourglassHalf /> },
        { label: 'Approved Users', value: counts.approved, grad: 'linear-gradient(135deg,#1da256,#48d483)', icon: <FaCheck /> },
        { label: 'Blocked Users', value: counts.blocked, grad: 'linear-gradient(135deg,#e11d48,#fb7185)', icon: <FaBan /> },
    ];

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Users List"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Users', path: '/admin/management/users' },
                ]}
            />

            <Row className="user-stat-row">
                {statCards.map((c) => (
                    <div key={c.label} className="col-12 col-md-4 mb-3">
                        <div className="user-stat-card" style={{ background: c.grad }}>
                            <div className="user-stat-icon">{c.icon}</div>
                            <div className="user-stat-value">{c.value}</div>
                            <div className="user-stat-label">{c.label}</div>
                        </div>
                    </div>
                ))}
            </Row>

            <Row>
                <DataTable
                    title="Users"
                    data={data}
                    columns={[
                        { key: 'name', label: 'Username' },
                        { key: 'email', label: 'Email' },
                        {
                            key: 'roles',
                            label: 'Roles',
                            render: (_: any, row: any) => (
                                <div className="tag-pill-cell" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {row.roles?.length > 0
                                        ? row.roles.map((role: any, i: number) => (
                                            <span key={`${role.id ?? i}-${row.id}`} className="tag-pill">
                                                {role.name}
                                            </span>
                                          ))
                                        : '-'}
                                </div>
                            ),
                        },
                        {
                            key: 'permissions',
                            label: 'Permissions',
                            render: (_: any, row: any) => (
                                <div className="tag-pill-cell" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {row.permissions?.length > 0
                                        ? row.permissions.map((p: any, i: number) => (
                                            <span key={`${p.id ?? i}-${row.id}`} className="tag-pill">
                                                {p.name}
                                            </span>
                                          ))
                                        : '-'}
                                </div>
                            ),
                        },
                    ]}
                    filters={filters}
                    actions={[
                        {
                            icon: <VisibilityIcon fontSize="small" />,
                            to: (row: any) => `/admin/management/users/${row.id}`,
                            className: 'view',
                        },
                        {
                            icon: <EditIcon fontSize="small" />,
                            to: (row: any) => `/admin/management/users/${row.id}/edit`,
                            className: 'edit',
                        },
                        {
                            icon: <DeleteIcon fontSize="small" />,
                            to: (row: any) => `/admin/management/users/${row.id}/delete`,
                            className: 'delete',
                        },
                    ]}
                />
            </Row>
        </Container>
    );
}

export default ViewUsers;
