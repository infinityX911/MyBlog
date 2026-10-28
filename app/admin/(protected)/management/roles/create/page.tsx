'use client';

/**
 * app/admin/(protected)/management/roles/create/page.tsx
 * Converted from: pages/Management/Roles/AddRoles.js
 *
 * Changes:
 *  - useNavigate -> useRouter from next/navigation
 *  - fetch Laravel API -> fetch /api/roles (GET for permissions list, POST to create)
 *  - localStorage Bearer removed
 *  - FormData -> JSON body (cleaner for Next.js API routes)
 *  - No <form> tag per project rules — button onClick handles submit
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

function AddRoles() {
    const [roleName, setRoleName] = useState('');
    const [roleSlug, setRoleSlug] = useState('');
    const [permissionsList, setPermissionsList] = useState<{ id: number; name: string }[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
    const router = useRouter();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // Fetch all permissions for the checkbox list
    useEffect(() => {
        fetch('/api/permissions')
            .then(res => res.ok ? res.json() : Promise.reject(res.status))
            .then(data => setPermissionsList(Array.isArray(data) ? data : []))
            .catch(err => console.error('Error fetching permissions:', err));
    }, []);

    const handleRoleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRoleName(e.target.value);
        setRoleSlug(toSlug(e.target.value));
    };

    const handlePermissionChange = (permissionId: number) => {
        setSelectedPermissions(prev =>
            prev.includes(permissionId)
                ? prev.filter(id => id !== permissionId)
                : [...prev, permissionId]
        );
    };

    async function handleSubmit() {
        if (!roleName.trim()) { alert('Please enter a role name.'); return; }
        try {
            const result = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: roleName,
                    slug: roleSlug,
                    permissions: selectedPermissions,
                }),
            });
            if (!result.ok) throw new Error(`HTTP error! Status: ${result.status}`);
            alert('Role added successfully.');
            router.push('/admin/management/roles');
        } catch (error) {
            console.error('Error creating role:', error);
            alert('Failed to create role.');
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Add Roles"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Roles', path: '/admin/management/roles' },
                    { label: 'Add', path: '/admin/management/roles/create' },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <Container fluid>
                            <Row>
                                <Col xs={6} style={{ marginBottom: '10px' }}>
                                    <h3 className="hd">Add Roles</h3>
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
                                            Add Role
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

export default AddRoles;
