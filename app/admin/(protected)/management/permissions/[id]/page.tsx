'use client';

/**
 * app/admin/(protected)/management/permissions/[id]/page.tsx
 * Converted from: ViewPermissions single view
 *
 * Shows a single permission detail
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import Link from 'next/link';

function ViewPermission() {
    const params = useParams();
    const id = params.id as string;
    const [permission, setPermission] = useState<{ id: number; name: string; slug: string } | null>(null);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/permissions/${id}`)
            .then(res => res.json())
            .then(data => setPermission(data))
            .catch(err => console.error('Error fetching permission:', err));
    }, [id]);

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="View Permission"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Permissions', path: '/admin/management/permissions' },
                    { label: 'View', path: `/admin/management/permissions/${id}` },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <Container fluid>
                            <Row>
                                <Col xs={6}>
                                    <h3 className="hd">Permission Details</h3>
                                </Col>
                                <Col xs={6} style={{ textAlign: 'right' }}>
                                    <Link href={`/admin/management/permissions/${id}/edit`} className="btn btn-primary btn-sm me-2">
                                        Edit
                                    </Link>
                                    <Link href="/admin/management/permissions" className="btn btn-secondary btn-sm">
                                        Back
                                    </Link>
                                </Col>
                            </Row>

                            {permission ? (
                                <Row className="mt-3">
                                    <Col xs={12} md={6}>
                                        <div className="para mb-3">
                                            <label className="mc-label-field-title para"><b>ID</b></label>
                                            <p>#{permission.id}</p>
                                        </div>
                                        <div className="para mb-3">
                                            <label className="mc-label-field-title para"><b>Permission Name</b></label>
                                            <p>{permission.name}</p>
                                        </div>
                                        <div className="para mb-3">
                                            <label className="mc-label-field-title para"><b>Permission Slug</b></label>
                                            <p>{permission.slug}</p>
                                        </div>
                                    </Col>
                                </Row>
                            ) : (
                                <div className="para mt-3">Loading...</div>
                            )}
                        </Container>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default ViewPermission;
