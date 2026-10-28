'use client';

/**
 * app/admin/(protected)/management/users/[id]/delete/page.tsx
 * Converted from: pages/Management/Users/DeleteUsers.js
 *
 * Changes:
 *  - useNavigate/useParams -> useRouter/useParams from next/navigation
 *  - fetch Laravel -> DELETE /api/users/[id]
 *  - localStorage Bearer removed
 *  - Silent auto-delete -> confirmation card (same pattern as roles/permissions)
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import Link from 'next/link';

function DeleteUsers() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [userName, setUserName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/users/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => setUserName(data.name ?? `#${id}`))
            .catch(() => setUserName(`#${id}`));
    }, [id]);

    const handleConfirmDelete = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (result.ok) {
                router.push('/admin/management/users');
            } else {
                let msg = `Server returned ${result.status}`;
                try { const body = await result.json(); if (body?.error) msg = body.error; } catch { }
                setError(msg);
                setLoading(false);
            }
        } catch (err) {
            console.error('Error during deletion:', err);
            setError('Network error — could not reach the server.');
            setLoading(false);
        }
    };

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Delete User"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Users', path: '/admin/management/users' },
                    { label: 'Delete', path: `/admin/management/users/${id}/delete` },
                ]}
            />

            <Row>
                <Col xs={12} md={6}>
                    <div className="card shadow border-0 p-4 mt-1">
                        <h3 className="hd mb-3">Delete User</h3>

                        <p className="para mb-1">You are about to permanently delete:</p>
                        <p className="para mb-4" style={{ fontWeight: 600, fontSize: '15px' }}>
                            &quot;{userName || '...'}&quot;
                        </p>

                        <p className="para mb-4" style={{ color: '#e74c3c' }}>
                            This action cannot be undone. All roles and permissions assigned to this user will also be removed.
                        </p>

                        {error && (
                            <div className="para mb-3" style={{
                                background: 'rgba(231,76,60,0.1)', border: '1px solid #e74c3c',
                                borderRadius: '6px', padding: '10px 14px', color: '#e74c3c', fontSize: '13px',
                            }}>
                                Error: {error}
                            </div>
                        )}

                        <div className="d-flex gap-2">
                            <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={loading}>
                                {loading ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                            <Link href="/admin/management/users" className="btn btn-secondary">
                                Cancel
                            </Link>
                        </div>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default DeleteUsers;
