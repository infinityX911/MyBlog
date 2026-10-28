'use client';

/**
 * app/admin/(protected)/management/roles/[id]/edit/page.tsx
 * Converted from: pages/Management/Roles/EditRoles.js
 *
 * Changes:
 *  - useNavigate/useParams -> useRouter/useParams from next/navigation
 *  - fetch Laravel API -> fetch /api/roles/[id]
 *  - localStorage Bearer removed
 *  - FormData + _method PATCH -> JSON PATCH request
 *  - No <form> tag per project rules
 *  - Live slug generation on role name change
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

const toSlug = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

function EditRoles() {
    const [roleName, setRoleName] = useState('');
    const [roleSlug, setRoleSlug] = useState('');
    const [permissionsList, setPermissionsList] = useState<{ id: number; name: string }[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    useEffect(() => {
        if (!id) return;

        // Fetch role data + all permissions in parallel
        Promise.all([
            fetch(`/api/roles/${id}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
            fetch('/api/permissions').then(r => r.ok ? r.json() : Promise.reject(r.status)),
        ])
            .then(([roleData, permsData]) => {
                setRoleName(roleData.name ?? '');
                setRoleSlug(roleData.slug ?? toSlug(roleData.name ?? ''));
                setPermissionsList(Array.isArray(permsData) ? permsData : []);
                // Pre-tick permissions already assigned to this role
                const assigned = (roleData.permissions ?? []).map((p: any) => p.id);
                setSelectedPermissions(assigned);
            })
            .catch(err => console.error('Error fetching role data:', err));
    }, [id]);

    const handleRoleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRoleName(e.target.value);
        setRoleSlug(toSlug(e.target.value));
    };

    const handlePermissionChange = (permissionId: number) => {
        setSelectedPermissions(prev =>
            prev.includes(permissionId)
                ? prev.filter(pid => pid !== permissionId)
                : [...prev, permissionId]
        );
    };

    async function handleSubmit() {
        if (!roleName.trim()) { alert('Role name cannot be empty.'); return; }
        try {
            const result = await fetch(`/api/roles/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: roleName,
                    slug: roleSlug,
                    permissions: selectedPermissions,
                }),
            });
            if (!result.ok) throw new Error(`HTTP error! Status: ${result.status}`);
            alert('Role updated successfully.');
            router.push('/admin/management/roles');
        } catch (error) {
            console.error('Error updating role:', error);
            alert('Failed to update role.');
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Edit Role"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Roles', path: '/admin/management/roles' },
                    { label: 'Edit', path: `/admin/management/roles/${id}/edit` },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <Container fluid>
                            <Row>
                                <Col xs={6} style={{ marginBottom: '10px' }}>
                                    <h3 className="hd">Edit Role</h3>
                                </Col>
                                <Col xs={6} style={{ textAlign: 'right' }}>
                                    <IconButton onClick={handleMenuClick} className="OptionClick" style={{ padding: '5px' }}>
                                        <MoreHorizIcon />
                                    </IconButton>
                                    <Menu
                                        anchorEl={anchorEl}
                                        open={open}
                                        onClose={handleMenuClose}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                    >
                                        <MenuItem onClick={handleMenuClose}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Edit</ListItemText></MenuItem>
                                        <MenuItem onClick={handleMenuClose}><ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon><ListItemText>Delete</ListItemText></MenuItem>
                                        <MenuItem onClick={handleMenuClose}><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon><ListItemText>Downloads</ListItemText></MenuItem>
                                    </Menu>
                                </Col>
                            </Row>

                            <Row>
                                <Col xs={12}>
                                    <div className="form-group pt-2 para">
                                        <label><b>Role:</b></label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={roleName}
                                            onChange={handleRoleNameChange}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                                        />
                                    </div>

                                    <div className="form-group pt-2 para">
                                        <label><b>Slug:</b></label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={roleSlug}
                                            onChange={e => setRoleSlug(e.target.value)}
                                        />
                                    </div>

                                    <div className="form-group pt-2 para">
                                        <label><b>Permissions:</b></label>
                                        <div style={{ marginTop: '8px' }}>
                                            {permissionsList.length === 0 && (
                                                <p className="para" style={{ fontSize: '13px', opacity: 0.6 }}>
                                                    Loading permissions...
                                                </p>
                                            )}
                                            {permissionsList.map(permission => (
                                                <React.Fragment key={permission.id}>
                                                    <input
                                                        type="checkbox"
                                                        id={`perm-${permission.id}`}
                                                        checked={selectedPermissions.includes(permission.id)}
                                                        onChange={() => handlePermissionChange(permission.id)}
                                                        style={{ marginRight: '6px', marginLeft: '8px' }}
                                                    />
                                                    <label htmlFor={`perm-${permission.id}`}>
                                                        <b>{permission.name}</b>
                                                    </label>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group pt-2">
                                        <button className="btn btn-primary" onClick={handleSubmit}>
                                            Update Role
                                        </button>
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

export default EditRoles;
