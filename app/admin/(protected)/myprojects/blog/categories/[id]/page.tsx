'use client';

/**
 * app/admin/(protected)/myprojects/blog/categories/[id]/page.tsx
 * View single category — read only
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import Link from 'next/link';

function ViewCategory() {
    const params = useParams();
    const id = params.id as string;
    const [category, setCategory] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/categories/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => { setCategory(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id]);

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="View Category"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Categories', path: '/admin/myprojects/blog/categories' },
                    { label: 'View', path: `/admin/myprojects/blog/categories/${id}` },
                ]}
            />

            {loading && (
                <div className="para mt-4" style={{ textAlign: 'center', opacity: 0.5 }}>
                    Loading category...
                </div>
            )}

            {!loading && !category && (
                <div className="para mt-4" style={{ textAlign: 'center', color: '#e74c3c' }}>
                    Category not found.
                </div>
            )}

            {!loading && category && (
                <Row>
                    <Col xs={12} lg={8}>
                        <div className="card shadow border-0 p-3 mt-1">

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <h3 className="hd" style={{ margin: 0, flex: 1 }}>{category.name}</h3>
                                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                                    <Link href={`/admin/myprojects/blog/categories/${id}/edit`} className="btn btn-primary btn-sm">Edit</Link>
                                    <Link href="/admin/myprojects/blog/categories" className="btn btn-secondary btn-sm">Back</Link>
                                </div>
                            </div>

                            <div className="form-group para mb-3">
                                <label className="mc-label-field-title para"><b>Slug</b></label>
                                <input type="text" className="form-control" value={`/${category.slug}`} readOnly />
                            </div>

                            <div className="form-group para mb-3">
                                <label className="mc-label-field-title para"><b>Description</b></label>
                                <textarea
                                    className="form-control"
                                    value={category.description || '—'}
                                    readOnly
                                    rows={3}
                                />
                            </div>

                            <div className="form-group para mb-3">
                                <label className="mc-label-field-title para"><b>Posts in this category</b></label>
                                <div style={{ marginTop: '6px' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        minWidth: '32px', height: '28px', borderRadius: '14px', padding: '0 10px',
                                        background: 'rgba(8,88,247,0.1)', color: '#0858f7',
                                        fontSize: '13px', fontWeight: 700,
                                    }}>
                                        {category.postCount ?? 0}
                                    </span>
                                </div>
                            </div>

                            <div className="form-group para mb-2">
                                <label className="mc-label-field-title para"><b>Created At</b></label>
                                <input type="text" className="form-control" value={new Date(category.createdAt).toLocaleString()} readOnly />
                            </div>

                            <div className="form-group para mb-2">
                                <label className="mc-label-field-title para"><b>Last Updated</b></label>
                                <input type="text" className="form-control" value={new Date(category.updatedAt).toLocaleString()} readOnly />
                            </div>
                        </div>
                    </Col>
                </Row>
            )}
        </Container>
    );
}

export default ViewCategory;
