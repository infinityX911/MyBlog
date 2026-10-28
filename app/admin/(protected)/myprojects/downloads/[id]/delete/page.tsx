'use client';

/**
 * app/admin/(protected)/myprojects/downloads/[id]/delete/page.tsx
 * Delete confirmation page for a download
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Container, Row, Col } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

function DeleteDownload() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [title, setTitle] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/downloads/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => { setTitle(data.title ?? ''); setLoaded(true); })
            .catch(err => console.error('Error fetching download:', err));
    }, [id]);

    async function handleDelete() {
        setDeleting(true);
        try {
            const result = await fetch(`/api/downloads/${id}`, { method: 'DELETE' });
            if (!result.ok) {
                const err = await result.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${result.status}`);
            }
            router.push('/admin/myprojects/downloads');
        } catch (error: any) {
            alert(`Failed: ${error.message}`);
            setDeleting(false);
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Delete Download"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Downloads', path: '/admin/myprojects/downloads' },
                    { label: 'Delete', path: `/admin/myprojects/downloads/${id}/delete` },
                ]}
            />
            <Row>
                <Col xs={12} lg={6}>
                    <div className="card shadow border-0 p-4 mt-1">
                        {!loaded ? (
                            <div className="para" style={{ opacity: 0.5 }}>Loading...</div>
                        ) : (
                            <>
                                <h5 className="hd mb-3">Are you sure?</h5>
                                <p className="para mb-4">
                                    This will permanently delete <b>&quot;{title}&quot;</b> and its SEO data. This action cannot be undone.
                                </p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                                        {deleting ? 'Deleting...' : 'Yes, Delete'}
                                    </button>
                                    <button className="btn btn-outline-secondary" onClick={() => router.push('/admin/myprojects/downloads')}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default DeleteDownload;
