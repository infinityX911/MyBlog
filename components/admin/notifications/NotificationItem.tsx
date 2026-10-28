'use client';

/**
 * components/admin/notifications/NotificationItem.tsx
 *
 * Changes from previous version:
 *  - X (CloseIcon) button is now fully transparent — no background fill,
 *    no border, just the icon. Matches the user's request.
 *  - Accepts an optional `onDelete` prop. When X is clicked it calls
 *    onDelete() which triggers deleteNotification() in AdminContext,
 *    removing the row from shared state and therefore from BOTH this
 *    page and the Navbar dropdown simultaneously.
 *  - stopPropagation on X click so it doesn't also trigger the row's
 *    onClick (which marks as read + navigates).
 */

import CloseIcon from '@mui/icons-material/Close';
import { Col, Row } from 'react-bootstrap';
import { ReactNode } from 'react';

interface NotificationItemProps {
    name?: string;
    message: ReactNode | string;
    item?: string;
    timeAgo: string;
    image: string;
    icon: ReactNode;
    iconBackground: string;
    isRead?: boolean;
    onDelete?: () => void;   // ← new
}

const NotificationItem = ({
    name,
    message,
    item,
    timeAgo,
    image,
    icon,
    iconBackground,
    isRead,
    onDelete,
}: NotificationItemProps) => {

    // Strip actor name from the start of the full DB message so we don't
    // render "Waqar Waqar left a comment…"
    let displayMessage: ReactNode = message;
    if (name && typeof message === 'string' && message.startsWith(name)) {
        displayMessage = message.slice(name.length).trimStart();
    }

    return (
        <Row
            className="align-items-center justify-content-between mt-3 notificationList"
            style={{ borderBottom: '1px solid #f0f0f0', padding: '10px 10px' }}
        >
            {/* Avatar + type icon overlay */}
            <Col xs="auto" className="d-flex align-items-center">
                <div style={{ position: 'relative' }}>
                    <img
                        src={image}
                        alt={name || 'notification'}
                        style={{
                            width: '70px',
                            height: '70px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                        }}
                    />
                    <div
                        className="white-heart-icon"
                        style={{
                            position: 'absolute',
                            bottom: '-3px',
                            left: '40px',
                            backgroundColor: iconBackground,
                            borderRadius: '50%',
                            width: '38px',
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid white',
                        }}
                    >
                        {icon}
                    </div>
                </div>
            </Col>

            {/* Text block */}
            <Col style={{ paddingLeft: '0' }}>
                <div className="para" style={{ fontSize: '16px', marginBottom: '5px' }}>
                    {name && (
                        <span style={{ fontWeight: '600' }}>{name} </span>
                    )}
                    <span>{displayMessage}</span>
                    {item && (
                        <span style={{ fontWeight: '600' }}> {item}</span>
                    )}
                </div>
                <div className="para" style={{ fontSize: '14px', color: '#0858f7' }}>
                    {timeAgo}
                </div>
            </Col>

            {/* X button — transparent, just the icon */}
            <Col
                xs="auto"
                style={{ position: 'relative', bottom: '14px', left: '10px' }}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // don't trigger row onClick (mark-as-read + navigate)
                        onDelete?.();
                    }}
                    title="Delete notification"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '4px',
                        cursor: onDelete ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#aaa',
                        borderRadius: '50%',
                        transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#e53935')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}
                >
                    <CloseIcon fontSize="small" />
                </button>
            </Col>
        </Row>
    );
};

export default NotificationItem;
