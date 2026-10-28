'use client';

/**
 * app/admin/(protected)/management/roles/[id]/delete/page.tsx
 * Converted from: pages/Management/Roles/DeleteRoles.js
 *
 * Changes:
 *  - useNavigate/useParams -> useRouter/useParams from next/navigation
 *  - fetch Laravel API -> DELETE /api/roles/[id]
 *  - localStorage Bearer removed
 *  - Silent auto-delete replaced with confirmation card (same pattern as permissions)
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import Link from 'next/link';

function DeleteRoles() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [roleName, setRoleName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch the role name to show in the confirmation card
    useEffect(() => {
        if (!id) return;
        fetch(`/api/roles/${id}`)
            .then(res => res.ok ? res.json() : Promise.reject(res.status))
            .then(data => setRoleName(data.name ?? `#${id}`))
            .catch(() => setRoleName(`#${id}`));
    }, [id]);

    const handleConfirmDelete = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetch(`/api/roles/${id}`, { method: 'DELETE' });

            if (result.ok) {
                router.push('/admin/management/roles');
            } else {
                let msg = `Server returned ${result.status}`;
                try {
                    const body = await result.json();
                    if (body?.error) msg = body.error;
                } catch { /* ignore */ }
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
                title="Delete Role"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Roles', path: '/admin/management/roles' },
                    { label: 'Delete', path: `/admin/management/roles/${id}/delete` },
                ]}
            />

            <Row>
                <Col xs={12} md={6}>
                    <div className="card shadow border-0 p-4 mt-1">
                        <h3 className="hd mb-3">Delete Role</h3>

                        <p className="para mb-1">You are about to permanently delete:</p>
                        <p className="para mb-4" style={{ fontWeight: 600, fontSize: '15px' }}>
                            &quot;{roleName || '...'}&quot;
                        </p>

                        <p className="para mb-4" style={{ color: '#e74c3c' }}>
                            This action cannot be undone. All permissions assigned to this role will also be detached.
                        </p>

                        {error && (
                            <div
                                className="para mb-3"
                                style={{
                                    background: 'rgba(231,76,60,0.1)',
                                    border: '1px solid #e74c3c',
                                    borderRadius: '6px',
                                    padding: '10px 14px',
                                    color: '#e74c3c',
                                    fontSize: '13px',
                                }}
                            >
                                Error: {error}
                            </div>
                        )}

                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-danger"
                                onClick={handleConfirmDelete}
                                disabled={loading}
                            >
                                {loading ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                            <Link href="/admin/management/roles" className="btn btn-secondary">
                                Cancel
                            </Link>
                        </div>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default DeleteRoles;
