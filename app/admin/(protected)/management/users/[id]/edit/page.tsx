'use client';

/**
 * app/admin/(protected)/management/users/[id]/edit/page.tsx
 * Converted from: pages/Management/Users/EditUsers.js
 *
 * Changes:
 *  - useNavigate/useParams -> useRouter/useParams from next/navigation
 *  - fetch Laravel -> /api/users/[id] PATCH
 *  - localStorage Bearer removed
 *  - FormData + _method PATCH -> JSON PATCH
 *  - No <form> tag per project rules
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

function EditUsers() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('pending');
    const [rolesList, setRolesList] = useState<{ id: number; name: string; permissions: { id: number; name: string }[] }[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [rolePermissions, setRolePermissions] = useState<{ id: number; name: string }[]>([]);
    const [checkedPermissions, setCheckedPermissions] = useState<number[]>([]);

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    useEffect(() => {
        if (!id) return;

        // Fetch user data + all roles in parallel
        Promise.all([
            fetch(`/api/users/${id}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
            fetch('/api/roles').then(r => r.ok ? r.json() : Promise.reject(r.status)),
        ])
            .then(([userData, rolesData]) => {
                setName(userData.name ?? '');
                setEmail(userData.email ?? '');
                setStatus(userData.status ?? 'pending');
                setRolesList(Array.isArray(rolesData) ? rolesData : []);

                // Show the role's permission POOL as checkboxes...
                const currentRole = userData.roles?.[0];
                if (currentRole) {
                    setSelectedRoleId(String(currentRole.id));
                    const role = rolesData.find((r: any) => r.id === currentRole.id);
                    setRolePermissions(role?.permissions ?? []);
                }
                // ...with the user's ASSIGNED (direct) permissions pre-checked.
                setCheckedPermissions((userData.permissions ?? []).map((p: any) => p.id));
            })
            .catch(err => console.error('Error fetching user data:', err));
    }, [id]);

    const handleRoleSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const roleId = e.target.value;
        setSelectedRoleId(roleId);
        const role = rolesList.find(r => String(r.id) === roleId);
        const perms = role?.permissions ?? [];
        setRolePermissions(perms);
        // Switching role: keep only the checks that exist in the new role's pool.
        const poolIds = perms.map((p: any) => p.id);
        setCheckedPermissions(prev => prev.filter(id => poolIds.includes(id)));
    };

    const handlePermissionChange = (permId: number) => {
        setCheckedPermissions(prev =>
            prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
        );
    };

    async function handleSubmit() {
        if (!name.trim() || !email.trim()) {
            alert('Name and email are required.');
            return;
        }
        try {
            const body: any = {
                name,
                email,
                status,
                roleId: selectedRoleId ? Number(selectedRoleId) : null,
                permissions: checkedPermissions,
            };
            if (password.trim()) body.password = password;

            const result = await fetch(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!result.ok) {
                const err = await result.json().catch(() => ({}));
                alert(err.error ?? `Could not update user (HTTP ${result.status}).`);
                return;
            }
            alert('The User Has Been Updated Successfully.');
            router.push('/admin/management/users');
        } catch {
            alert('Network error. Please try again.');
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Edit User"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Users', path: '/admin/management/users' },
                    { label: 'Edit', path: `/admin/management/users/${id}/edit` },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <Container fluid>
                            <Row>
                                <Col xs={6} style={{ marginBottom: '10px' }}>
                                    <h3 className="hd">Edit User</h3>
                                </Col>
                                <Col xs={6} style={{ textAlign: 'right' }}>
                                    <IconButton onClick={handleMenuClick} className="OptionClick" style={{ padding: '5px' }}>
                                        <MoreHorizIcon />
                                    </IconButton>
                                    <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                                        <MenuItem onClick={handleMenuClose}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Edit</ListItemText></MenuItem>
                                        <MenuItem onClick={handleMenuClose}><ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon><ListItemText>Delete</ListItemText></MenuItem>
                                        <MenuItem onClick={handleMenuClose}><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon><ListItemText>Downloads</ListItemText></MenuItem>
                                    </Menu>
                                </Col>
                            </Row>

                            <Row>
                                <Col xs={12}>
                                    <div className="form-group pt-2 para">
                                        <label><b>Username:</b></label>
                                        <input className="form-control" type="text" value={name}
                                            onChange={e => setName(e.target.value)} />
                                    </div>

                                    <div className="form-group pt-2 para">
                                        <label><b>Email:</b></label>
                                        <input className="form-control" type="email" value={email}
                                            onChange={e => setEmail(e.target.value)} />
                                    </div>

                                    <div className="form-group pt-2 para">
                                        <label><b>Password: <small style={{ fontWeight: 400 }}>(leave blank to keep current)</small></b></label>
                                        <input className="form-control" type="password" value={password}
                                            onChange={e => setPassword(e.target.value)} />
                                    </div>

                                    <div className="form-group pt-2 para">
                                        <label><b>Select Role:</b></label>
                                        <select className="form-control" value={selectedRoleId}
                                            onChange={handleRoleSelection}>
                                            <option value="">Select Role...</option>
                                            {rolesList.map(role => (
                                                <option key={role.id} value={role.id}>{role.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group pt-2 para">
                                        <label><b>Account Status:</b></label>
                                        <select className="form-control" value={status}
                                            onChange={e => setStatus(e.target.value)}>
                                            <option value="approved">Approved</option>
                                            <option value="pending">Pending</option>
                                            <option value="blocked">Blocked (cannot log in)</option>
                                        </select>
                                        <small style={{ fontWeight: 400, opacity: 0.7 }}>
                                            Set to Blocked to ban the user from signing in.
                                        </small>
                                    </div>

                                    {/* The selected role's permission POOL — check the ones to
                                        actually assign to THIS user (their real access). */}
                                    {rolePermissions.length > 0 && (
                                        <div className="form-group pt-2 para">
                                            <label><b>Select Permissions:</b></label>
                                            <div style={{ marginTop: '8px' }}>
                                                {rolePermissions.map(permission => (
                                                    <React.Fragment key={permission.id}>
                                                        <input
                                                            type="checkbox"
                                                            id={`perm-${permission.id}`}
                                                            checked={checkedPermissions.includes(permission.id)}
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
                                    )}

                                    <div className="form-group pt-2">
                                        <button className="btn btn-primary" onClick={handleSubmit}>
                                            Update User
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

export default EditUsers;
