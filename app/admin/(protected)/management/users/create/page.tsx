'use client';

/**
 * app/admin/(protected)/management/users/create/page.tsx
 * Converted from: pages/Management/Users/AddUsers.js
 *
 * Changes:
 *  - useNavigate -> useRouter from next/navigation
 *  - fetch Laravel -> /api/roles (for role list) + /api/users POST
 *  - localStorage Bearer removed
 *  - When role is selected, permissions of that role are pre-loaded as checkboxes
 *  - No <form> tag per project rules
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

function AddUsers() {
    const router = useRouter();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rolesList, setRolesList] = useState<{ id: number; name: string; permissions: { id: number; name: string }[] }[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [rolePermissions, setRolePermissions] = useState<{ id: number; name: string }[]>([]);
    const [checkedPermissions, setCheckedPermissions] = useState<number[]>([]);

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // Fetch all roles with their permissions on mount
    useEffect(() => {
        fetch('/api/roles')
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => setRolesList(Array.isArray(data) ? data : []))
            .catch(err => console.error('Error fetching roles:', err));
    }, []);

    // When role changes, load that role's permissions as default checkboxes
    const handleRoleSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const roleId = e.target.value;
        setSelectedRoleId(roleId);
        const role = rolesList.find(r => String(r.id) === roleId);
        const perms = role?.permissions ?? [];
        setRolePermissions(perms);
        // Pre-tick all permissions of selected role
        setCheckedPermissions(perms.map((p: any) => p.id));
    };

    const handlePermissionChange = (permId: number) => {
        setCheckedPermissions(prev =>
            prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
        );
    };

    async function handleSubmit() {
        if (!name.trim() || !email.trim() || !password.trim()) {
            alert('Name, email and password are required.');
            return;
        }
        try {
            const result = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    roleId: selectedRoleId ? Number(selectedRoleId) : null,
                    permissions: checkedPermissions,
                }),
            });
            if (!result.ok) {
                // Expected validation errors (e.g. duplicate email) — show a
                // friendly message instead of throwing (which triggers the red
                // dev error overlay).
                const err = await result.json().catch(() => ({}));
                alert(err.error ?? `Could not add user (HTTP ${result.status}).`);
                return;
            }
            alert('The User Has Been Added Successfully.');
            router.push('/admin/management/users');
        } catch {
            alert('Network error. Please try again.');
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Add Users"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Users', path: '/admin/management/users' },
                    { label: 'Add', path: '/admin/management/users/create' },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <Container fluid>
                            <Row>
                                <Col xs={6} style={{ marginBottom: '10px' }}>
                                    <h3 className="hd">Add Users</h3>
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
                                        <label><b>Password:</b></label>
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
                                            Add User
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

export default AddUsers;
