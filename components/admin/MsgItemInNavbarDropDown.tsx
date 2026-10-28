'use client';

/**
 * MsgItemInNavbarDropDown.tsx
 * Converted from: component/Navbar/MsgItemInNavbarDropDown.js
 *
 * Changes from React version:
 *  - Added 'use client' (uses useState, event handlers)
 *  - CSS import path updated (from ../../CSS/ → your Next.js CSS location)
 *  - Everything else is identical — props, logic, JSX unchanged
 */

import { Divider, IconButton, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import React, { useState } from 'react';

// Update this path to wherever you put MsgItemInNavbarDropDown.css
// e.g. if you put it in app/admin/css/ → import '@/app/admin/css/MsgItemInNavbarDropDown.css'
// import '@/app/admin/css/MsgItemInNavbarDropDown.css';

interface MsgItemProps {
    conversationId: number;
    avatar: string;
    name: string;
    time: string;
    message: string;
    unreadCount: number;
    isOnline?: boolean;
    isSupport?: boolean;
    onOpenChat: (msg: any) => void;
    markAsRead: (id: number) => void;
    onDelete?: (id: number) => void;
}

export default function MsgItemInNavbarDropDown({
    conversationId,
    avatar,
    name,
    time,
    message,
    unreadCount,
    isOnline = false,
    isSupport = false,
    onOpenChat,
    markAsRead,
    onDelete,
}: MsgItemProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    const handleClickMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = (event?: React.MouseEvent) => {
        if (event) event.stopPropagation();
        setAnchorEl(null);
    };

    const handleMsgClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (typeof onOpenChat === 'function') {
            onOpenChat({ avatar, name, time, message, unreadCount, isOnline });
        }
        if (typeof markAsRead === 'function') {
            markAsRead(conversationId);
        }
    };

    const handleMarkAsRead = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (typeof markAsRead === 'function') {
            markAsRead(conversationId);
        }
        handleCloseMenu();
    };

    const formatSupNumber = (num: number) => {
        const str = num.toString();
        return str.length > 3 ? `${str.slice(0, 4)}+` : str;
    };

    return (
        <>
            <li className="msg-item" onClick={handleMsgClick} style={{ cursor: 'pointer' }}>
                <div className="msg-avatar avatar-wrapper">
                    <img src={avatar} alt={name} />
                    <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`} />
                </div>

                <div className="msg-info">
                    <div className="msg-header">
                        <span className="msg-name">{name}</span>
                        {isSupport && (
                            <span style={{ marginLeft: 6, background: '#5b4fcf', color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, letterSpacing: 0.3, textTransform: 'uppercase' }}>Support</span>
                        )}
                        <span className="msg-time">~ {time}</span>
                    </div>
                    <div className="msg-snippet">{message}</div>
                </div>

                {unreadCount > 0 && (
                    <span className="msg-unread">{formatSupNumber(unreadCount)}</span>
                )}

                <IconButton
                    aria-label="more"
                    size="small"
                    onClick={handleClickMenu}
                    className="msg-options-btn"
                >
                    <MoreVertIcon fontSize="small" />
                </IconButton>

                <Menu
                    anchorEl={anchorEl}
                    open={menuOpen}
                    onClose={handleCloseMenu}
                    onClick={(e) => e.stopPropagation()}
                >
                    <MenuItem onClick={(e) => { e.stopPropagation(); onOpenChat({ avatar, name }); handleCloseMenu(); }}>
                        Reply
                    </MenuItem>
                    <MenuItem onClick={handleMarkAsRead}>Mark as Read</MenuItem>
                    <MenuItem onClick={(e) => {
                        e.stopPropagation();
                        if (onDelete && confirm('Delete this conversation?')) onDelete(conversationId);
                        handleCloseMenu();
                    }}>
                        Delete
                    </MenuItem>
                </Menu>
            </li>

            <Divider className="mb-2" />
        </>
    );
}
