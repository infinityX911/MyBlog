'use client';

/**
 * MessageList.tsx  (HOTASH design, wired to real data)
 *
 *  - Grid (Apps) icon  → filter dropdown: Active Users / All Conversations /
 *    Unread Messages / Read Messages / Support Chats. (This replaces the old
 *    separate "Support" tab — filtering happens from here, like the design.)
 *  - Search box        → live filters the list by username.
 *  - Per-row 3-dot     → View Profile / Mark As Unread / Delete / Block.
 */

import { Col, Container, Row } from 'react-bootstrap';
import { Box, InputBase, IconButton, Paper } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AppsIcon from '@mui/icons-material/Apps';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonIcon from '@mui/icons-material/Person';
import ForumIcon from '@mui/icons-material/Forum';
import MarkChatUnreadIcon from '@mui/icons-material/MarkChatUnread';
import MarkChatReadIcon from '@mui/icons-material/MarkChatRead';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import DeleteIcon from '@mui/icons-material/Delete';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import Divider from '@mui/material/Divider';
import { useState } from 'react';

interface Message { id: number; text: string; sender: string; time: string }
interface Conversation {
    id: number;
    avatar: string;
    name: string;
    isOnline: boolean;
    isActive: boolean;
    unreadCount: number;
    messages: Message[];
    message?: string;
    time?: string;
    peerId?: number;
}

export type MsgFilter = 'all' | 'active' | 'unread' | 'read' | 'support';

interface MessageListProps {
    messages: Conversation[];
    onSelectConversation: (id: number) => void;
    filter?: MsgFilter;
    onFilterChange?: (f: MsgFilter) => void;
    search?: string;
    onSearchChange?: (s: string) => void;
    onViewProfile?: (conv: Conversation) => void;
    onMarkUnread?: (id: number) => void;
    onDelete?: (id: number) => void;
    onBlock?: (id: number) => void;
}

const FILTER_LABEL: Record<MsgFilter, string> = {
    all: 'All Conversations',
    active: 'Active Users',
    unread: 'Unread Messages',
    read: 'Read Messages',
    support: 'Support Chats',
};

function MessageList({
    messages, onSelectConversation,
    filter = 'all', onFilterChange,
    search = '', onSearchChange,
    onViewProfile, onMarkUnread, onDelete, onBlock,
}: MessageListProps) {
    // Filter (grid) dropdown
    const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
    // Per-row options menu
    const [rowAnchor, setRowAnchor] = useState<null | HTMLElement>(null);
    const [rowConv, setRowConv] = useState<Conversation | null>(null);

    const formatSupNumber = (num: number) => {
        const str = num.toString();
        return str.length > 3 ? `${str.slice(0, 4)}+` : str;
    };

    const pickFilter = (f: MsgFilter) => { onFilterChange?.(f); setFilterAnchor(null); };
    const openRow = (e: React.MouseEvent<HTMLElement>, conv: Conversation) => {
        e.stopPropagation();
        setRowConv(conv);
        setRowAnchor(e.currentTarget);
    };
    const closeRow = () => { setRowAnchor(null); setRowConv(null); };

    return (
        <div className="card shadow border-0 mt-1 MycardMsg" style={{ margin: 0 }}>
            <Container fluid className="mc-message-user" style={{ padding: 0, margin: 0 }}>
                <Row style={{ padding: 0, margin: 0 }}>
                    <Col xs={12} style={{ padding: 0, margin: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Paper
                                className="searchbarr"
                                component="div"
                                sx={{ p: '2px 8px', display: 'flex', alignItems: 'center', width: '100%', borderRadius: '8px', border: '1px solid #e4e4e4', backgroundColor: 'transparent', boxShadow: 'none' }}
                            >
                                <SearchIcon className="searchbarrInputIcon" sx={{ color: '#1976d2', mr: 1 }} />
                                <InputBase
                                    sx={{ ml: 1, flex: 1 }}
                                    placeholder="search username"
                                    className="searchbarrInput"
                                    value={search}
                                    onChange={(e) => onSearchChange?.(e.target.value)}
                                    inputProps={{ 'aria-label': 'search username' }}
                                />
                            </Paper>
                            <IconButton
                                className="searchbarrOptionButton"
                                onClick={(e) => setFilterAnchor(e.currentTarget)}
                                title={FILTER_LABEL[filter]}
                                sx={{ ml: 1, backgroundColor: '#f5f5f5', borderRadius: 2, width: 40, height: 40 }}
                            >
                                <AppsIcon sx={{ color: '#444' }} />
                            </IconButton>
                            <Menu anchorEl={filterAnchor} open={Boolean(filterAnchor)} onClose={() => setFilterAnchor(null)}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                                <MenuItem selected={filter === 'active'} onClick={() => pickFilter('active')}>
                                    <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon><ListItemText>Active Users</ListItemText>
                                </MenuItem>
                                <MenuItem selected={filter === 'all'} onClick={() => pickFilter('all')}>
                                    <ListItemIcon><ForumIcon fontSize="small" /></ListItemIcon><ListItemText>All Conversations</ListItemText>
                                </MenuItem>
                                <MenuItem selected={filter === 'unread'} onClick={() => pickFilter('unread')}>
                                    <ListItemIcon><MarkChatUnreadIcon fontSize="small" /></ListItemIcon><ListItemText>Unread Messages</ListItemText>
                                </MenuItem>
                                <MenuItem selected={filter === 'read'} onClick={() => pickFilter('read')}>
                                    <ListItemIcon><MarkChatReadIcon fontSize="small" /></ListItemIcon><ListItemText>Read Messages</ListItemText>
                                </MenuItem>
                                <Divider />
                                <MenuItem selected={filter === 'support'} onClick={() => pickFilter('support')}>
                                    <ListItemIcon><SupportAgentIcon fontSize="small" /></ListItemIcon><ListItemText>Support Chats</ListItemText>
                                </MenuItem>
                            </Menu>
                        </Box>
                    </Col>
                </Row>

                <Row>
                    <Col xs={12} className="msg-scroll-container" style={{ padding: 0, margin: 0 }}>
                        <ul className="mc-message-user-list thin-scrolling">
                            {messages.map((msg) => {
                                const lastMsg = msg.messages && msg.messages.length > 0
                                    ? msg.messages[msg.messages.length - 1]
                                    : { text: msg.message, time: msg.time };
                                return (
                                    <li
                                        key={msg.id}
                                        className={`mc-message-user-item ${msg.isActive ? 'active' : ''}`}
                                        onClick={() => onSelectConversation(msg.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <Container fluid style={{ padding: 0, margin: 0, marginTop: '10px' }}>
                                            <Row className="msgRow" style={{ padding: 0, margin: 0 }}>
                                                <Col xs={2} className="msgAvaterDiv">
                                                    <div className={`mc-round-avatar ${msg.isOnline ? 'online' : 'offline'}`}>
                                                        <div className="userImg2">
                                                            <div className="rounded-circle2">
                                                                <img src={msg.avatar} alt={msg.name} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Col>

                                                <Col xs={6} className="msgChatDiv">
                                                    <div className={`mc-duel-text xs ${msg.unreadCount > 0 ? 'unread' : ''}`}>
                                                        <div className="mc-duel-text-title">
                                                            <strong>{msg.name}</strong> <span>~ {lastMsg?.time}</span>
                                                        </div>
                                                        <div className={`mc-duel-text-message ${msg.unreadCount > 0 ? 'unread' : ''} para`}>
                                                            <p>{lastMsg?.text}</p>
                                                        </div>
                                                    </div>
                                                </Col>

                                                <Col xs={2} className="msgSupDiv">
                                                    {msg.unreadCount > 0 && (
                                                        <sup>{formatSupNumber(msg.unreadCount)}</sup>
                                                    )}
                                                </Col>

                                                <Col xs={2} className="msgOptionDiv">
                                                    <IconButton
                                                        aria-label="more"
                                                        onClick={(e) => openRow(e, msg)}
                                                        sx={{ padding: 1, borderRadius: '50%', backgroundColor: '#f1f1f1', '&:hover': { backgroundColor: '#e0e0e0' } }}
                                                    >
                                                        <MoreVertIcon fontSize="small" />
                                                    </IconButton>
                                                </Col>
                                            </Row>
                                        </Container>
                                    </li>
                                );
                            })}
                        </ul>
                    </Col>
                </Row>

                {/* Shared per-row options menu */}
                <Menu anchorEl={rowAnchor} open={Boolean(rowAnchor)} onClose={closeRow}>
                    <MenuItem onClick={() => { if (rowConv) onViewProfile?.(rowConv); closeRow(); }}>
                        <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon><ListItemText>View Profile</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { if (rowConv) onMarkUnread?.(rowConv.id); closeRow(); }}>
                        <ListItemIcon><MarkChatUnreadIcon fontSize="small" /></ListItemIcon><ListItemText>Mark As Unread</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { if (rowConv) onDelete?.(rowConv.id); closeRow(); }}>
                        <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon><ListItemText>Delete Messages</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { if (rowConv) onBlock?.(rowConv.id); closeRow(); }}>
                        <ListItemIcon><RemoveCircleIcon fontSize="small" /></ListItemIcon><ListItemText>Block Messages</ListItemText>
                    </MenuItem>
                </Menu>
            </Container>
        </div>
    );
}

export default MessageList;
