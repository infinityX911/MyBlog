'use client';

/**
 * MessageChatBox.tsx
 * Converted from: component/Messages/MessageChatBox.js
 *
 * Changes:
 *  - 'use client' added
 *  - TypeScript props typed
 *  - iconBtnStyle replaced with className="chatbox-action-btn" (beats global MUI CSS override)
 *  - <form> tag replaced with <div> (Next.js doesn't allow nested forms)
 *  - import iconBtnStyle removed (inlined via CSS class instead)
 */

import { useState, useEffect, useRef } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import MarkChatReadIcon from '@mui/icons-material/MarkChatRead';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { IoSend } from 'react-icons/io5';

interface Message {
    id?: number;
    text: string;
    sender: string;
    time?: string;
}

interface SenderInfo {
    avatar: string;
    name: string;
    isOnline: boolean;
    role?: string | null;     // e.g. "Viewer" / "Administrator" — shown as a chip
    isSupport?: boolean;      // adds a "Support" chip next to the name
}

interface MessageChatBoxProps {
    senderInfo: SenderInfo;
    messages: Message[];
    onSend: (text: string) => void;
}

function MessageChatBox({ senderInfo, messages, onSend }: MessageChatBoxProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    // Never pass an empty string to <img src> (browser re-downloads the page).
    const avatarSrc = senderInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderInfo?.name || 'User')}&background=0858f7&color=fff`;

    const handleSend = () => {
        const trimmedMessage = input.trim();
        if (!trimmedMessage) return;
        onSend(trimmedMessage);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    useEffect(() => {
        // Only auto-scroll to the newest message when the user is ALREADY near
        // the bottom. If they've scrolled up to read history, leave them there —
        // otherwise polling/re-fetches kept yanking them back down (and on mobile
        // scrollIntoView also scrolled the whole page), making it impossible to
        // scroll up. We scroll the list's own scrollTop, never the window.
        const el = listRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 140) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="card shadow border-0 mt-1 MycardMsg" style={{ margin: 0 }}>
            <Container fluid style={{ padding: 0, margin: 0 }}>

                {/* Header */}
                <Row className="chatboxHeader">
                    <Col xs={2} sm={2} md={1} lg={1} xl={1} className="chatboxAvaterDiv">
                        <div className={`mc-round-avatar3 ${senderInfo?.isOnline ? 'online3' : 'offline3'}`}>
                            <div className="userImg3">
                                <div className="rounded-circle3">
                                    <img src={avatarSrc} alt={senderInfo?.name || 'user'} />
                                </div>
                            </div>
                        </div>
                    </Col>

                    <Col xs={4} sm={4} md={5} lg={5} xl={5} className="chatboxStatusDiv">
                        <div className="chatboxContainer">
                            <div className="chatboxPerson" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <strong>{senderInfo?.name || 'Unknown User'}</strong>
                                {senderInfo?.role && (
                                    <span style={{ background: '#0858f7', color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 7px', borderRadius: 999, letterSpacing: 0.3, textTransform: 'uppercase' }}>{senderInfo.role}</span>
                                )}
                                {senderInfo?.isSupport && (
                                    <span style={{ background: '#5b4fcf', color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 7px', borderRadius: 999, letterSpacing: 0.3, textTransform: 'uppercase' }}>Support</span>
                                )}
                            </div>
                            <div className="chatboxStatus">
                                <p>{senderInfo?.isOnline ? 'Active Now' : 'Offline'}</p>
                            </div>
                        </div>
                    </Col>

                    {/* Action buttons — use className instead of sx to avoid MUI global override */}
                    <Col xs={6} sm={6} md={6} lg={6} xl={6} className="chatboxiconsDiv">
                        <IconButton className="chatbox-action-btn" disableRipple>
                            <RemoveCircleIcon sx={{ fontSize: '18px' }} />
                        </IconButton>
                        <IconButton className="chatbox-action-btn" disableRipple>
                            <DeleteIcon sx={{ fontSize: '18px' }} />
                        </IconButton>
                        <IconButton className="chatbox-action-btn" disableRipple>
                            <MarkChatReadIcon sx={{ fontSize: '18px' }} />
                        </IconButton>
                        <IconButton className="chatbox-action-btn" disableRipple>
                            <AccountCircleIcon sx={{ fontSize: '18px' }} />
                        </IconButton>
                    </Col>
                </Row>

                {/* Messages */}
                <Row>
                    <Col xs={12} style={{ margin: 0, padding: 0 }}>
                        <ul className="mc-message-chat-list thin-scrolling" ref={listRef}>
                            {messages.map((msg, idx) => {
                                // Join/leave → subtle centered system notice, not a bubble.
                                if (/(joined|left) the chat/i.test(msg.text)) {
                                    return (
                                        <li key={msg.id || idx} style={{ listStyle: 'none', textAlign: 'center', fontSize: 11, color: '#9aa0a6', margin: '6px 0' }}>
                                            {msg.text.replace(/^🤖\s*/, '')}
                                        </li>
                                    );
                                }
                                return (
                                <li
                                    key={msg.id || idx}
                                    className={`mc-message-chat-item ${msg.sender === 'outgoing' ? 'right' : ''}`}
                                >
                                    <div className="userImg3">
                                        <div className="rounded-circle3">
                                            <img src={avatarSrc} alt="user" />
                                        </div>
                                    </div>
                                    <div className="mc-message-chat-group para">
                                        <div className="mc-message-chat-text">
                                            <p>{msg.text}</p>
                                        </div>
                                        <p className="mc-message-chat-datetime">{msg.time || 'Just now'}</p>
                                    </div>
                                </li>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </ul>
                    </Col>
                </Row>

                {/* Footer */}
                <Row style={{ margin: 0, padding: 0, position: 'relative', bottom: '16px' }}>
                    <Col xs={12} style={{ margin: 0, padding: 0 }}>
                        <div className="mc-message-chat-footer">
                            <Container fluid style={{ margin: 0, padding: 0 }}>
                                <Row style={{ margin: 0, padding: 0 }}>
                                    <Col
                                        xs={10}
                                        className="mc-composer-bg"
                                        style={{
                                            margin: 0,
                                            padding: 0,
                                            borderTopLeftRadius: '25px',
                                            borderBottomLeftRadius: '25px',
                                        }}
                                    >
                                        <input
                                            type="text"
                                            placeholder="type a message"
                                            className="w-100 send-textbox"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                        />
                                    </Col>
                                    <Col
                                        xs={2}
                                        className="mc-composer-bg"
                                        style={{
                                            margin: 0,
                                            padding: 0,
                                            borderTopRightRadius: '25px',
                                            borderBottomRightRadius: '25px',
                                            textAlign: 'right',
                                        }}
                                    >
                                        <IconButton onClick={handleSend}>
                                            <span className="send-icon">
                                                <IoSend />
                                            </span>
                                        </IconButton>
                                    </Col>
                                </Row>
                            </Container>
                        </div>
                    </Col>
                </Row>

            </Container>
        </div>
    );
}

export default MessageChatBox;
