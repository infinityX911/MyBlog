'use client';

/**
 * app/admin/(protected)/management/roles/page.tsx
 * Converted from: pages/Management/Roles/ViewRoles.js
 *
 * Changes:
 *  - useNavigate -> useRouter from next/navigation
 *  - fetch Laravel API -> fetch /api/roles
 *  - localStorage Bearer removed
 *  - action links updated to lowercase Next.js paths
 *  - permissions badge column uses tag-pill class (matches admin.css)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import DataTable from '@/components/admin/datatable/DataTable';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function ViewRoles() {
    const router = useRouter();
    const [data, setData] = useState([]);

    useEffect(() => { fetchData(); }, []);

    async function fetchData() {
        try {
            const result = await fetch('/api/roles');
            if (result.ok) {
                const data1 = await result.json();
                setData(Array.isArray(data1) ? data1 : []);
            } else {
                router.push('/admin/login');
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    }

    const filters = useMemo(() => {
        const build = (key: string) => {
            const set = new Set<string>();
            data.forEach((item: any) => {
                const raw = item?.[key];
                if (!raw) return;
                const str = String(raw).trim();
                if (str) set.add(str);
                str.split(/[\s/_-]+/).forEach((tok: string) => tok && set.add(tok));
            });
            return Array.from(set);
        };
        return {
            name: build('name'),
            slug: build('slug'),
        };
    }, [data]);

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Roles List"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Roles', path: '/admin/management/roles' },
                ]}
            />

            <Row>
                <DataTable
                    title="Roles"
                    data={data}
                    columns={[
                        { key: 'name', label: 'Role Name' },
                        { key: 'slug', label: 'Role Slug' },
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
                            to: (row: any) => `/admin/management/roles/${row.id}`,
                            className: 'view',
                        },
                        {
                            icon: <EditIcon fontSize="small" />,
                            to: (row: any) => `/admin/management/roles/${row.id}/edit`,
                            className: 'edit',
                        },
                        {
                            icon: <DeleteIcon fontSize="small" />,
                            to: (row: any) => `/admin/management/roles/${row.id}/delete`,
                            className: 'delete',
                        },
                    ]}
                />
            </Row>
        </Container>
    );
}

export default ViewRoles;
