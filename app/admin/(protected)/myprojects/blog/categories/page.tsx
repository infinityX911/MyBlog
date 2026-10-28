'use client';

/**
 * app/admin/(protected)/myprojects/blog/categories/page.tsx
 * Categories list page — Blog Categories CRUD
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import DataTable from '@/components/admin/datatable/DataTable';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function ViewCategories() {
    const router = useRouter();
    const [data, setData] = useState([]);

    useEffect(() => { fetchData(); }, []);

    async function fetchData() {
        try {
            const result = await fetch('/api/categories');
            if (result.ok) {
                const d = await result.json();
                setData(Array.isArray(d) ? d : []);
            } else {
                router.push('/admin/login');
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Blog Categories"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Categories', path: '/admin/myprojects/blog/categories' },
                ]}
            />
            <Row>
                <DataTable
                    title="Blog Categories"
                    data={data}
                    columns={[
                        { key: 'name', label: 'Name' },
                        { key: 'slug', label: 'Slug' },
                        {
                            key: 'description',
                            label: 'Description',
                            render: (_: any, row: any) => row.description
                                ? <span>{row.description}</span>
                                : <span style={{ opacity: 0.4, fontSize: '12px' }}>—</span>,
                        },
                        {
                            key: 'postCount',
                            label: 'Posts',
                            render: (_: any, row: any) => (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    minWidth: '28px', height: '24px', borderRadius: '12px', padding: '0 8px',
                                    background: 'rgba(8,88,247,0.1)', color: '#0858f7',
                                    fontSize: '12px', fontWeight: 700,
                                }}>
                                    {row.postCount ?? 0}
                                </span>
                            ),
                        },
                    ]}
                    actions={[
                        {
                            icon: <VisibilityIcon fontSize="small" />,
                            to: (row: any) => `/admin/myprojects/blog/categories/${row.id}`,
                            className: 'view',
                        },
                        {
                            icon: <EditIcon fontSize="small" />,
                            to: (row: any) => `/admin/myprojects/blog/categories/${row.id}/edit`,
                            className: 'edit',
                        },
                        {
                            icon: <DeleteIcon fontSize="small" />,
                            to: (row: any) => `/admin/myprojects/blog/categories/${row.id}/delete`,
                            className: 'delete',
                        },
                    ]}
                />
            </Row>
        </Container>
    );
}

export default ViewCategories;
