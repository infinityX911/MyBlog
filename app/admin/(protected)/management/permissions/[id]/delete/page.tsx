'use client';

/**
 * app/admin/(protected)/management/permissions/[id]/delete/page.tsx
 *
 * Shows a confirmation card before deleting.
 * Fixes the silent auto-delete (which caused confusing 500s with no feedback).
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Container, Row, Col } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import Link from 'next/link';

function DeletePermissions() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [permissionName, setPermissionName] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch the permission name so the confirmation card can show it
    useEffect(() => {
        if (!id) return;
        fetch(`/api/permissions/${id}`)
            .then(res => res.ok ? res.json() : Promise.reject(res.status))
            .then(data => setPermissionName(data.name ?? `#${id}`))
            .catch(() => setPermissionName(`#${id}`));
    }, [id]);

    const handleConfirmDelete = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetch(`/api/permissions/${id}`, {
                method: 'DELETE',
            });

            if (result.ok) {
                router.push('/admin/management/permissions');
            } else {
                // Show the actual server error message if available
                let msg = `Server returned ${result.status}`;
                try {
                    const body = await result.json();
                    if (body?.error) msg = body.error;
                } catch { /* ignore parse error */ }
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
                title="Delete Permission"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Permissions', path: '/admin/management/permissions' },
                    { label: 'Delete', path: `/admin/management/permissions/${id}/delete` },
                ]}
            />

            <Row>
                <Col xs={12} md={6}>
                    <div className="card shadow border-0 p-4 mt-1">
                        <h3 className="hd mb-3">Delete Permission</h3>

                        <p className="para mb-1">
                            You are about to permanently delete:
                        </p>
                        <p className="para mb-4" style={{ fontWeight: 600, fontSize: '15px' }}>
                            &quot;{permissionName || '...'}&quot;
                        </p>

                        <p className="para mb-4" style={{ color: '#e74c3c' }}>
                            This action cannot be undone.
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
                            <Link
                                href="/admin/management/permissions"
                                className="btn btn-secondary"
                            >
                                Cancel
                            </Link>
                        </div>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default DeletePermissions;
