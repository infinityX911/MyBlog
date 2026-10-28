'use client';

/**
 * NotificationItemInNavbarDropDown.tsx
 * Converted from: component/Navbar/NotificationItemInNavbarDropDown.js
 *
 * Changes from React version:
 *  - Added 'use client' (uses useState, event handlers)
 *  - Props typed with TypeScript interface
 *  - Zero JSX changes — layout, classNames, styles all identical
 */

import React, { useState } from 'react';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { IconButton, Menu, MenuItem } from '@mui/material';

interface NotificationItemProps {
    image: string;
    icon: React.ReactNode;
    name: string;
    message: React.ReactNode;
    item: string;
    timeAgo: string;
    onClick: () => void;
    iconBackground: string;
    isRead?: boolean;
    onMarkAsRead?: () => void;
    onRemove?: () => void;
}

export default function NotificationItemInNavbarDropDown({
    image,
    icon,
    name,
    message,
    item,
    timeAgo,
    onClick,
    iconBackground,
    isRead,
    onMarkAsRead,
    onRemove,
}: NotificationItemProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    return (
        <div
            className="d-flex notificationDropDowndiv para"
            style={{ justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '10px 12px' }}
        >
            {/* Left side: image + text */}
            <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '12px', minWidth: 0 }}>
                <div style={{ position: 'relative' }}>
                    <img
                        src={image}
                        alt=""
                        className="navbar-notif-avatar"
                        style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                        }}
                    />
                    {/* Icon overlay */}
                    <div
                        className="navbarNotificationIcon"
                        style={{ backgroundColor: iconBackground }}
                    >
                        {icon}
                    </div>
                </div>

                <div className="dropdownInfo" style={{ marginLeft: '0' }}>
                    <h4 style={{ fontSize: '14px', margin: 0 }}>
                        <b>{name}</b> {message} <b>{item}</b>
                    </h4>
                    <p className="text-sky mb-0" style={{ fontSize: '12px' }}>
                        {timeAgo}
                    </p>
                </div>
            </div>

            {/* Right side: 3-dot menu */}
            <div>
                <IconButton size="small" onClick={handleMenuOpen}>
                    <MoreVertIcon fontSize="small" />
                </IconButton>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {!isRead && (
                        <MenuItem onClick={() => { onMarkAsRead?.(); handleMenuClose(); }}>
                            Mark as read
                        </MenuItem>
                    )}
                    <MenuItem onClick={() => { onRemove?.(); handleMenuClose(); }}>
                        Remove notification
                    </MenuItem>
                </Menu>
            </div>
        </div>
    );
}
