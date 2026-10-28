'use client';

/**
 * app/admin/(protected)/myprojects/blog/categories/[id]/delete/page.tsx
 * Delete blog category
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import Link from 'next/link';

function DeleteCategory() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [categoryName, setCategoryName] = useState('');
    const [postCount, setPostCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/categories/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                setCategoryName(data.name ?? `#${id}`);
                setPostCount(data.postCount ?? 0);
            })
            .catch(() => setCategoryName(`#${id}`));
    }, [id]);

    const handleConfirmDelete = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
            if (result.ok) {
                router.push('/admin/myprojects/blog/categories');
            } else {
                let msg = `Server returned ${result.status}`;
                try { const body = await result.json(); if (body?.error) msg = body.error; } catch { }
                setError(msg);
                setLoading(false);
            }
        } catch (err) {
            setError('Network error — could not reach the server.');
            setLoading(false);
        }
    };

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Delete Category"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Categories', path: '/admin/myprojects/blog/categories' },
                    { label: 'Delete', path: `/admin/myprojects/blog/categories/${id}/delete` },
                ]}
            />
            <Row>
                <Col xs={12} md={6}>
                    <div className="card shadow border-0 p-4 mt-1">
                        <h3 className="hd mb-3">Delete Category</h3>
                        <p className="para mb-1">You are about to permanently delete:</p>
                        <p className="para mb-4" style={{ fontWeight: 600, fontSize: '15px' }}>
                            &quot;{categoryName || '...'}&quot;
                        </p>

                        {postCount > 0 && (
                            <div className="para mb-4" style={{
                                background: 'rgba(243,156,18,0.1)', border: '1px solid #f39c12',
                                borderRadius: '6px', padding: '10px 14px', color: '#f39c12', fontSize: '13px',
                            }}>
                                This category is currently assigned to {postCount} post{postCount === 1 ? '' : 's'}.
                                Deleting it will remove the category from those posts (the posts themselves will not be deleted).
                            </div>
                        )}

                        <p className="para mb-4" style={{ color: '#e74c3c' }}>
                            This action cannot be undone.
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
                            <Link href="/admin/myprojects/blog/categories" className="btn btn-secondary">Cancel</Link>
                        </div>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default DeleteCategory;
