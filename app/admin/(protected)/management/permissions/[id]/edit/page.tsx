'use client';

/**
 * app/admin/(protected)/management/permissions/[id]/edit/page.tsx
 * Converted from: pages/Management/Permissions/EditPermissions.js
 *
 * Changes:
 *  - useNavigate -> useRouter, useParams from next/navigation
 *  - fetch Laravel -> /api/permissions/[id]
 *  - localStorage Bearer removed
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import IconButton from '@mui/material/IconButton';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import EditIcon from '@mui/icons-material/Edit';
import ListItemText from '@mui/material/ListItemText';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';

function EditPermissions() {
    const [permission, setPermission] = useState('');
    const [slug, setSlug] = useState('');
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    useEffect(() => { if (id) getData(); }, [id]);

    const generateSlug = (permission: string) => {
        setSlug(
            permission.toLowerCase().replace(/[^\w\s]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/-$/, '').trim() || ''
        );
    };

    const handlePermissionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setPermission(value);
        generateSlug(value);
    };

    async function getData() {
        try {
            const result = await fetch(`/api/permissions/${id}`);
            if (result.ok) {
                const data = await result.json();
                setPermission(data.name);
                setSlug(data.slug);
            } else {
                console.error('Failed to fetch permission:', result.status);
            }
        } catch (error) {
            console.error('Error during fetch:', error);
        }
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        try {
            const result = await fetch(`/api/permissions/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: permission }),
            });

            if (!result.ok) throw new Error(`HTTP error! Status: ${result.status}`);

            alert('The Permission Was Updated Successfully..');
            router.push('/admin/management/permissions');
        } catch (error) {
            console.error('Error during update:', error);
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Edit Permission"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Permissions', path: '/admin/management/permissions' },
                    { label: 'Edit', path: `/admin/management/permissions/${id}/edit` },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <Container fluid>
                            <Row>
                                <Col xs={6} style={{ marginBottom: '10px' }}>
                                    <h3 className="hd">Edit Permission</h3>
                                </Col>
                                <Col xs={6} style={{ textAlign: 'right' }}>
                                    <IconButton onClick={handleClick} className="OptionClick" style={{ padding: '5px' }}>
                                        <MoreHorizIcon />
                                    </IconButton>
                                    <Menu anchorEl={anchorEl} open={open} onClose={handleClose}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                    >
                                        <MenuItem onClick={handleClose}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Edit</ListItemText></MenuItem>
                                        <MenuItem onClick={handleClose}><ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon><ListItemText>Delete</ListItemText></MenuItem>
                                        <MenuItem onClick={handleClose}><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon><ListItemText>Downloads</ListItemText></MenuItem>
                                    </Menu>
                                </Col>
                            </Row>

                            <Row>
                                <Col xs={12}>
                                    <div onSubmit={handleSubmit}>
                                        <div className="para">
                                            <label htmlFor="permission"><b>Permission</b></label>
                                            <input type="text" className="form-control" id="permission" value={permission} onChange={handlePermissionChange} />
                                        </div>
                                        <div className="form-group pt-2 para">
                                            <label htmlFor="permissionsSlug"><b>Permissions Slug</b></label>
                                            <input type="text" className="form-control" id="permissionsSlug" value={slug} readOnly />
                                        </div>
                                        <div className="form-group pt-2">
                                            <button className="btn btn-primary" onClick={handleSubmit}>Update Permission</button>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        </Container>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default EditPermissions;
