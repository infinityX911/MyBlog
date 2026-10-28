'use client';

/**
 * app/admin/(protected)/myprojects/blog/categories/create/page.tsx
 * Add new blog category
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

function AddCategory() {
    const router = useRouter();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    // Shown on the home-page category chips, the /tag hero, the sidebar and
    // every post thumbnail. There was no field for it, so every category was
    // stuck on the schema default of 📝.
    const [emoji, setEmoji] = useState('📝');
    const [saving, setSaving] = useState(false);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setName(newName);
        setSlug(toSlug(newName));
    };

    async function handleSubmit() {
        if (!name.trim()) { alert('Please enter a category name.'); return; }
        setSaving(true);
        try {
            const result = await fetch('/api/categories', {
                method: 'POST',
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

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Add Category"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Categories', path: '/admin/myprojects/blog/categories' },
                    { label: 'Add Category', path: '/admin/myprojects/blog/categories/create' },
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
                                placeholder="e.g. Web Development"
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
                                placeholder="Short description of this category..."
                            />
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Category'}
                        </button>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default AddCategory;
