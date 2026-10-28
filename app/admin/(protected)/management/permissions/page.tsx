'use client';

/**
 * app/admin/(protected)/management/permissions/page.tsx
 * Converted from: pages/Management/Permissions/ViewPermissions.js
 *
 * Changes:
 *  - useNavigate -> useRouter from next/navigation
 *  - fetch Laravel API -> fetch /api/permissions
 *  - localStorage Bearer token removed (next-auth handles auth)
 *  - action links updated to lowercase next.js paths
 */

import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import DataTable from '@/components/admin/datatable/DataTable';
import { Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function ViewPermissions() {
    const router = useRouter();
    const [data, setData] = useState([]);

    useEffect(() => { fetchData(); }, []);

    async function fetchData() {
        try {
            const result = await fetch('/api/permissions');
            if (result.ok) {
                const data1 = await result.json();
                setData(Array.isArray(data1) ? data1 : []);
            } else {
                router.push('/admin/login');
            }
        } catch (error) {
            console.error('Error fetching permissions:', error);
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
        return { name: build('name'), slug: build('slug') };
    }, [data]);

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Permissions List"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Permissions', path: '/admin/management/permissions' },
                ]}
            />
            <Row>
                <DataTable
                    title="Permissions"
                    data={data}
                    columns={[
                        { key: 'name', label: 'Permission Name' },
                        { key: 'slug', label: 'Permission Slug' },
                    ]}
                    filters={filters}
                    actions={[
                        {
                            icon: <VisibilityIcon fontSize="small" />,
                            to: (row: any) => `/admin/management/permissions/${row.id}`,
                            className: 'view',
                        },
                        {
                            icon: <EditIcon fontSize="small" />,
                            to: (row: any) => `/admin/management/permissions/${row.id}/edit`,
                            className: 'edit',
                        },
                        {
                            icon: <DeleteIcon fontSize="small" />,
                            to: (row: any) => `/admin/management/permissions/${row.id}/delete`,
                            className: 'delete',
                        },
                    ]}
                />
            </Row>
        </Container>
    );
}

export default ViewPermissions;
