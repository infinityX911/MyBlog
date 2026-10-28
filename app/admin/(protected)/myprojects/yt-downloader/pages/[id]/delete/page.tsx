'use client';

/** Confirm + delete a YT CMS page. */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Container } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

function DeleteCmsPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            const res = await fetch(`/api/yt/cms-pages/${id}`);
            if (res.ok) { const p = await res.json(); setTitle(p.title ?? `#${id}`); }
        })();
    }, [id]);

    async function confirmDelete() {
        setBusy(true);
        try {
            const res = await fetch(`/api/yt/cms-pages/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            router.push('/admin/myprojects/yt-downloader/pages');
        } catch (e: any) {
            alert(`Failed: ${e.message}`);
            setBusy(false);
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Delete Page"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'YT Pages', path: '/admin/myprojects/yt-downloader/pages' },
                    { label: 'Delete', path: '#' },
                ]}
            />
            <div className="card shadow border-0 p-4 mt-1">
                <h5 className="hd">Are you sure?</h5>
                <p>You are about to permanently delete <b>{title || `page #${id}`}</b> and its SEO data. This cannot be undone.</p>
                <div className="d-flex gap-2">
                    <button className="btn btn-danger" onClick={confirmDelete} disabled={busy}>
                        {busy ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button className="btn btn-secondary"
                        onClick={() => router.push('/admin/myprojects/yt-downloader/pages')}>
                        Cancel
                    </button>
                </div>
            </div>
        </Container>
    );
}

export default DeleteCmsPage;
