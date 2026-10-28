'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Col, Row } from 'react-bootstrap';
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

// Converts a plain string into a URL-safe slug
const toSlug = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^\w\s]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '')
        .trim();

const AddPermissions = () => {
    const [tags, setTags] = useState<string[]>([]);
    const [inputValue, setInputValue] = useState('');
    const router = useRouter();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // Live slug preview: committed tags + whatever is currently typed
    const getSlugPreview = () => {
        const allValues = inputValue.trim() ? [...tags, inputValue.trim()] : tags;
        return [...new Set(allValues.map(toSlug))].join(', ');
    };

    const addTag = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed || tags.includes(trimmed)) { setInputValue(''); return; }
        setTags(prev => [...prev, trimmed]);
        setInputValue('');
    };

    const handleRemoveTag = (tag: string) => {
        setTags(prev => prev.filter(t => t !== tag));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
        }
        if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
            handleRemoveTag(tags[tags.length - 1]);
        }
    };

    async function handleSubmit(e: React.MouseEvent | React.FormEvent) {
        e.preventDefault();
        if (tags.length === 0) { alert('Please add at least one permission.'); return; }
        try {
            const result = await fetch('/api/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: tags }),
            });
            if (!result.ok) throw new Error(`HTTP error! Status: ${result.status}`);
            alert('The Permissions Were Added Successfully..');
            router.push('/admin/management/permissions');
        } catch (error) {
            console.error('Error during permission creation:', error);
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Add Permissions"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Permissions', path: '/admin/management/permissions' },
                    { label: 'Add', path: '/admin/management/permissions/create' },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <Container fluid>
                            <Row>
                                <Col xs={6} style={{ marginBottom: '10px' }}>
                                    <h3 className="hd">Add Permissions</h3>
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
                                        <MenuItem onClick={handleMenuClose}>
                                            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText>Edit</ListItemText>
                                        </MenuItem>
                                        <MenuItem onClick={handleMenuClose}>
                                            <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText>Delete</ListItemText>
                                        </MenuItem>
                                        <MenuItem onClick={handleMenuClose}>
                                            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText>Downloads</ListItemText>
                                        </MenuItem>
                                    </Menu>
                                </Col>
                            </Row>

                            <Row>
                                <Col xs={12}>
                                    <div className="para mb-3">
                                        <label htmlFor="tag-input"><b>Permissions</b></label>

                                        {/* Tag input container — .theinput + .form-control gives border/bg */}
                                        <div
                                            className="form-control theinput"
                                            onClick={() => document.getElementById('tag-input')?.focus()}
                                        >
                                            {tags.map((tag, i) => (
                                                <span key={i} className="tag-pill">
                                                    {tag}
                                                    <button
                                                        className="react-tagsinput-remove"
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                                                        aria-label={`Remove ${tag}`}
                                                    >
                                                        &times;
                                                    </button>
                                                </span>
                                            ))}
                                            <input
                                                id="tag-input"
                                                type="text"
                                                className="tag-input-field"
                                                value={inputValue}
                                                onChange={e => setInputValue(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder={tags.length === 0 ? 'Type and press Enter, Tab, or , to add' : ''}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group pt-2 para">
                                        <label htmlFor="permissionsSlug"><b>Permissions Slug</b></label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="permissionsSlug"
                                            value={getSlugPreview()}
                                            readOnly
                                        />
                                    </div>

                                    <div className="form-group pt-2">
                                        <button className="btn btn-primary" onClick={handleSubmit}>
                                            Add Permissions
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
};

export default AddPermissions;
