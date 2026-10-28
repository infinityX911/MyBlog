'use client';

/**
 * app/admin/(protected)/myprojects/blog/categories/[id]/edit/page.tsx
 * Edit existing blog category
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

function EditCategory() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [emoji, setEmoji] = useState('📝');
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/categories/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                setName(data.name ?? '');
                setSlug(data.slug ?? '');
                setDescription(data.description ?? '');
                setEmoji(data.emoji ?? '📝');
                setLoaded(true);
            })
            .catch(err => console.error('Error fetching category:', err));
    }, [id]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    };

    async function handleSubmit() {
        if (!name.trim()) { alert('Please enter a category name.'); return; }
        setSaving(true);
        try {
            const result = await fetch(`/api/categories/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, slug, description, emoji }),
            });
            if (!result.ok) {
                const err = await result.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${result.status}`);
            }
            router.push('/admin/myprojects/blog/categories');
        } catch (error: any) {
            alert(`Failed: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    if (!loaded) {
        return (
            <Container fluid className="right-content">
                <HeaderPanel
                    title="Edit Category"
                    breadcrumbs={[
                        { label: 'Blog', path: '/admin/myprojects/blog' },
                        { label: 'Categories', path: '/admin/myprojects/blog/categories' },
                        { label: 'Edit', path: '#' },
                    ]}
                />
                <div className="para mt-4" style={{ textAlign: 'center', opacity: 0.5 }}>Loading category...</div>
            </Container>
        );
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Edit Category"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Categories', path: '/admin/myprojects/blog/categories' },
                    { label: 'Edit', path: `/admin/myprojects/blog/categories/${id}/edit` },
                ]}
            />

            <Row>
                <Col xs={12} lg={8}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <div className="form-group para mb-3">
                            <label><b>Category Name</b></label>
                            <input
                                type="text"
                                className="form-control"
                                value={name}
                                onChange={handleNameChange}
                                style={{ fontSize: '16px', fontWeight: 500 }}
                            />
                        </div>

                        <div className="form-group para mb-3">
                            <label><b>Slug</b></label>
                            <input
                                type="text"
                                className="form-control"
                                value={slug}
                                onChange={e => setSlug(e.target.value)}
                            />
                        </div>

                        <div className="form-group para mb-3">
                            <label><b>Emoji</b> <small style={{ fontWeight: 400 }}>(shown on category chips, cards and the category page)</small></label>
                            <input
                                type="text"
                                className="form-control"
                                value={emoji}
                                onChange={e => setEmoji(e.target.value)}
                                placeholder="🤖"
                                maxLength={8}
                                style={{ fontSize: '20px', width: 90, textAlign: 'center' }}
                            />
                        </div>

                        <div className="form-group para mb-3">
                            <label><b>Description</b> <small style={{ fontWeight: 400 }}>(optional)</small></label>
                            <textarea
                                className="form-control"
                                rows={3}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Update Category'}
                        </button>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default EditCategory;
