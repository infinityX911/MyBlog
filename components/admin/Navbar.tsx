'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import {
    MdMenuOpen,
    MdOutlineLightMode,
    MdOutlineMailOutline,
    MdOutlineMenu,
} from 'react-icons/md';
import {
    Button,
    Divider,
    ListItemIcon,
    MenuItem,
    Menu,
} from '@mui/material';
import { IoSearch, IoShieldHalfSharp } from 'react-icons/io5';
import Logout from '@mui/icons-material/Logout';
import { FaRegBell } from 'react-icons/fa';
import PersonAdd from '@mui/icons-material/PersonAdd';
import LanguageIcon from '@mui/icons-material/Language';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAdmin } from '@/context/AdminContext';
import { useMessaging } from '@/context/MessagingContext';
import MsgItemInNavbarDropDown from '@/components/admin/MsgItemInNavbarDropDown';
import NotificationItemInNavbarDropDown from '@/components/admin/NotificationItemInNavbarDropDown';
import { resolveVisual, timeAgo, type IconConfigMap } from '@/lib/notificationVisuals';
import SearchBox from "@/components/admin/SearchBox";
import { useSession, signOut } from 'next-auth/react';

export default function Navbar() {
    const router = useRouter();
    // ── Dropdown anchor states ──────────────────────────────────────────
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);
    const [MsgAnchorEl, setMsgAnchorEl] = useState<null | HTMLElement>(null);
    const [notifSettingsAnchorEl, setNotifSettingsAnchorEl] = useState<null | HTMLElement>(null);

    const openMyAcc = Boolean(anchorEl);
    const openNotifications = Boolean(notificationAnchorEl);
    const openMsgs = Boolean(MsgAnchorEl);
    const openNotifSettings = Boolean(notifSettingsAnchorEl);

    const handleOpenMyAccDrop = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleCloseMyAccDrop = () => setAnchorEl(null);
    const handleOpenNotificationDrop = (e: React.MouseEvent<HTMLElement>) => {
        setNotificationAnchorEl(e.currentTarget);
        loadIconConfig(); // pull latest icon/colour settings each time it opens
    };
    const handleCloseNotificationDrop = () => setNotificationAnchorEl(null);
    const handleOpenMsgDrop = (e: React.MouseEvent<HTMLElement>) => setMsgAnchorEl(e.currentTarget);
    const handleCloseMsgDrop = () => setMsgAnchorEl(null);
    const handleNotifSettingsOpen = (e: React.MouseEvent<HTMLElement>) => setNotifSettingsAnchorEl(e.currentTarget);
    const handleNotifSettingsClose = () => setNotifSettingsAnchorEl(null);

    const [showChatBox, setShowChatBox] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<any>(null);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    // Admin-panel branding (logo + brand text), editable in Settings → Sites.
    const [branding, setBranding] = useState<{ logo: string; brand: string }>({ logo: '', brand: '' });
    useEffect(() => {
        fetch('/api/admin-branding')
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (d) setBranding({ logo: d.adminLogo || '', brand: d.adminBrand || '' }); })
            .catch(() => { /* fall back to defaults */ });
    }, []);

    // Admin-configured notification icon/colour map (so the navbar matches the
    // Management → Notification Icons settings, not just the built-in defaults).
    const [iconConfig, setIconConfig] = useState<IconConfigMap>({});
    const loadIconConfig = React.useCallback(() => {
        fetch('/api/notification-icons')
            .then(r => r.json())
            .then(d => {
                const map: IconConfigMap = {};
                (d.items ?? []).forEach((it: any) => { map[it.typeKey] = { icon: it.icon, color: it.color }; });
                setIconConfig(map);
            })
            .catch(() => { /* fall back to built-in visuals */ });
    }, []);
    useEffect(() => { loadIconConfig(); }, [loadIconConfig]);

    const handleOpenChat = (msg: any) => {
        setSelectedMessage(msg);
        setShowChatBox(true);
        handleCloseMsgDrop();
    };

    const handleCloseChat = () => {
        setShowChatBox(false);
        setSelectedMessage(null);
    };

    const {
        isToggleSidebar,
        setIsToggleSidebar,
        themeMode,
        setThemeMode,
        messages,
        notifications,
        markConversationAsRead,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        markAllNotificationsAsUnread,
        deleteNotification,
        deleteAllNotifications,
        totalUnreadMessages,
        totalUnreadNotifications,
        logout,
    } = useAdmin();

    // Real direct-messaging state (replaces the old mock `messages`).
    const {
        conversations,
        totalUnread: totalUnreadDms,
        openConversation,
        deleteConversation,
    } = useMessaging();
    const { data: session } = useSession();


    return (
        <>
            <Container fluid className="navbar-Container">
                <Row className="align-items-center">
                    <Col xs={4} sm={3} md={3} lg={3} xl={2}>
                        <div className="logo-div d-flex align-items-center">
                            <img src={branding.logo || '/assets/logo.webp'} alt="Logo" className="logo img-fluid" />
                            <span>{branding.brand || 'Umair'}</span>
                        </div>
                    </Col>

                    <Col xs={3} sm={3} md={3} lg={3} xl={3}>

                        <div className="d-none d-md-none d-lg-flex d-xl-flex align-items-center me-1">
                            <Button className="rounded-circle" onClick={() => setIsToggleSidebar(!isToggleSidebar)}>
                                {isToggleSidebar === false ? <MdMenuOpen /> : <MdOutlineMenu />}
                            </Button>
                            <SearchBox />
                        </div>


                        <div className="d-flex d-lg-none d-xl-none d-md-flex d-sm-flex justify-content-end">
                            <Button className="rounded-circle" onClick={() => setMobileSearchOpen(true)}><IoSearch className="fs-5 me-1" /></Button>
                            <Button className="rounded-circle" onClick={() => setIsToggleSidebar(!isToggleSidebar)}>
                                {isToggleSidebar === false ? <MdMenuOpen /> : <MdOutlineMenu />}
                            </Button>
                        </div>
                    </Col>

                    <Col xs={1} sm={1} md={1} lg={1} xl={1} />

                    <Col xs={4} sm={5} md={5} lg={5} xl={6}>
                        <div className="d-flex justify-content-end">
                            <div className="col-sm-7 d-flex align-items-center justify-content-end part3 pl-4">
                                <Button onClick={() => setThemeMode(!themeMode)} className="rounded-circle darkMode me-2">
                                    {themeMode ? <MdOutlineLightMode className="fs-5" /> : <DarkModeIcon fontSize="small" />}
                                </Button>
                                <Button className="rounded-circle Translator me-2"><LanguageIcon className="fs-5" /></Button>

                                {/* Messages */}
                                <div className="dropdownWrapper position-relative">
                                    <Button className="rounded-circle me-2 d-none d-md-flex messageNumbers" onClick={handleOpenMsgDrop}>
                                        <MdOutlineMailOutline className="fs-5" />
                                        {totalUnreadDms > 0 && (
                                            <sup className="primary">
                                                {totalUnreadDms > 99 ? "99+" : totalUnreadDms}
                                            </sup>
                                        )}
                                    </Button>
                                    <Menu
                                        anchorEl={MsgAnchorEl}
                                        className="msgs dropdown_list"
                                        id="msgs"
                                        open={openMsgs}
                                        onClose={handleCloseMsgDrop}
                                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                                    >
                                        <div className="head pl-1 pb-0">
                                            <Container fluid style={{ padding: 0, margin: 0 }}>
                                                <Row style={{ padding: 0, margin: 0 }}>
                                                    <Col xs={6} sm={6} md={6} lg={6} xl={6}>
                                                        <h4>Messages ({conversations.length})</h4>
                                                    </Col>

                                                    <Col xs={6} sm={6} md={6} lg={6} xl={6} style={{ textAlign: "right" }}>
                                                        <Button className="allSettingBtnForNotifications"
                                                                onClick={(event) => {
                                                                    event.stopPropagation(); // prevents parent menu from closing
                                                                    handleNotifSettingsOpen(event);
                                                                }}
                                                                style={{ minWidth: 0, padding: 0 }}
                                                        >
                                                            <SettingsIcon />
                                                        </Button>
                                                    </Col>
                                                </Row>
                                                <Divider className="mb-2" />
                                                <ul className="">
                                                    {conversations.length === 0 && (
                                                        <li className="para" style={{ padding: '10px 6px', color: '#888', fontSize: 13 }}>
                                                            No conversations yet.
                                                        </li>
                                                    )}
                                                    {conversations.map((conv) => (
                                                        <MsgItemInNavbarDropDown
                                                            key={conv.id}
                                                            conversationId={conv.id}
                                                            avatar={conv.peer?.avatarUrl
                                                                || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.peer?.name || 'User')}&background=0858f7&color=fff`}
                                                            name={conv.peer?.name || 'Conversation'}
                                                            time={conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : ''}
                                                            message={conv.lastMessage || ''}
                                                            unreadCount={conv.unreadCount}
                                                            isOnline={false}
                                                            isSupport={conv.isSupport}
                                                            onOpenChat={() => { openConversation(conv.id, conv.peer); handleCloseMsgDrop(); }}
                                                            markAsRead={() => { /* read is cleared when the chat window opens */ }}
                                                            onDelete={() => deleteConversation(conv.id)}
                                                        />
                                                    ))}
                                                </ul>
                                            </Container>
                                        </div>
                                        <Divider className="mb-2" />
                                        <div className="pl-0 pr-0 w-100 pt-0 pb-0">
                                            <Button
                                                className="btn-blue w-100"
                                                onClick={() => { handleCloseMsgDrop(); router.push('/admin/messages'); }}
                                            >
                                                View All Messages
                                            </Button>
                                        </div>
                                    </Menu>
                                </div>

                                {/* Notifications */}
                                <div className="dropdownWrapper position-relative">
                                    <Button className="rounded-circle me-3 d-none d-md-flex notificationNumbers"
                                            onClick={handleOpenNotificationDrop}>
                                        <FaRegBell className="fs-5" />
                                        {totalUnreadNotifications > 0 && (
                                            <sup className="primary">
                                                {totalUnreadNotifications > 99 ? "99+" : totalUnreadNotifications}
                                            </sup>
                                        )}
                                    </Button>
                                    <Menu
                                        anchorEl={notificationAnchorEl}
                                        className="notifications dropdown_list"
                                        id="notifications"
                                        open={openNotifications}
                                        onClose={handleCloseNotificationDrop}
                                        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
                                        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
                                    >
                                        <div className="head pl-1  pb-0">
                                            <Container fluid style={{ padding: 0, margin: 0 }}>
                                                <Row style={{ padding: 0, margin: 0 }}>
                                                    <Col xs={6} sm={6} md={6} lg={6} xl={6}>
                                                        <h4>Notifications ({notifications.length})</h4>
                                                    </Col>

                                                    <Col xs={6} sm={6} md={6} lg={6} xl={6} style={{ textAlign: "right" }}>
                                                        <Button className="allSettingBtnForNotifications"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    handleNotifSettingsOpen(event);
                                                                }}
                                                                style={{ minWidth: 0, padding: 0 }}
                                                        >
                                                            <SettingsIcon />
                                                        </Button>
                                                    </Col>
                                                </Row>
                                            </Container>
                                        </div>
                                        <Divider className="mb-2" />
                                        <div className="scroll">
                                            {notifications.map((notif, index) => {
                                                // Type-specific icon + colour from the admin's saved config.
                                                const visual = resolveVisual(notif.type, iconConfig);
                                                // Real actor avatar/name (falls back to initials of the actor,
                                                // never the literal word "Notification").
                                                const actorName = notif.actorName || 'System';
                                                const avatar = notif.actorAvatarUrl
                                                    || `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=0858f7&color=fff`;

                                                return (
                                                    <React.Fragment key={notif.id}>
                                                        <div
                                                            style={{
                                                                backgroundColor: notif.isRead ? "transparent" : "#ebf6ff",
                                                                borderRadius: "8px",
                                                            }}
                                                        >
                                                            <NotificationItemInNavbarDropDown
                                                                image={avatar}
                                                                icon={visual.icon}
                                                                name={notif.actorName || ''}
                                                                message={notif.message}
                                                                item=""
                                                                timeAgo={timeAgo(notif.createdAt)}
                                                                iconBackground={visual.background}
                                                                isRead={notif.isRead}
                                                                onClick={() => {
                                                                    markNotificationAsRead(notif.id);
                                                                    handleCloseNotificationDrop();
                                                                    if (notif.link) router.push(notif.link);
                                                                }}
                                                                onMarkAsRead={() => markNotificationAsRead(notif.id)}
                                                                onRemove={() => deleteNotification(notif.id)}
                                                            />
                                                        </div>
                                                        {index !== notifications.length - 1 &&
                                                            <Divider className="my-1"/>}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                        <div className="pl-0 pr-0 w-100 pt-0 pb-0">
                                            <Button
                                                className="btn-blue w-100"
                                                onClick={() => {
                                                    handleCloseNotificationDrop();
                                                    router.push('/admin/notifications');
                                                }}
                                            >
                                                View All Notifications
                                            </Button>
                                        </div>
                                    </Menu>

                                    {/* Settings Dropdown inside Notification */}
                                    <Menu
                                        anchorEl={notifSettingsAnchorEl}
                                        open={openNotifSettings}
                                        onClose={handleNotifSettingsClose}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                    >
                                        <MenuItem
                                            onClick={() => {
                                                markAllNotificationsAsRead();   // ✅ call context function
                                                handleNotifSettingsClose();
                                            }}
                                        >
                                            Mark All As Read
                                        </MenuItem>
                                        <MenuItem onClick={() => { markAllNotificationsAsUnread(); handleNotifSettingsClose(); }}>
                                            Mark All As Unread
                                        </MenuItem>
                                        <MenuItem onClick={() => {
                                            if (confirm('Delete ALL notifications? This cannot be undone.')) deleteAllNotifications();
                                            handleNotifSettingsClose();
                                        }}>
                                            Delete All Notifications
                                        </MenuItem>
                                    </Menu>
                                </div>


                                {/* Account */}
                                <div className="myAccWrapper">
                                    <Button className="myAcc d-flex align-items-center " onClick={handleOpenMyAccDrop}>
                                        <div className="userImg">
                                            <span className="rounded-circle">
                                                <img
                                                    src={(session?.user as any)?.avatarUrl || session?.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session?.user?.name || 'Admin')}&background=0858f7&color=fff`}
                                                    alt="" />
                                            </span>
                                        </div>
                                        <div className="userInfo d-none d-md-block d-lg-block d-xl-block">
                                            <h4>{session?.user?.name ?? 'Admin'}</h4>
                                            <p className="mb-0">{session?.user?.email ?? ''}</p>
                                        </div>
                                    </Button>
                                    <Menu
                                        anchorEl={anchorEl}
                                        id="account-menu"
                                        open={openMyAcc}
                                        onClose={handleCloseMyAccDrop}
                                        onClick={handleCloseMyAccDrop}
                                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                                    >
                                        <Divider />
                                        <MenuItem onClick={() => { handleCloseMyAccDrop(); router.push('/admin/account'); }}>
                                            <ListItemIcon>
                                                <PersonAdd fontSize="small" />
                                            </ListItemIcon>
                                            My Account
                                        </MenuItem>
                                        <MenuItem onClick={() => { handleCloseMyAccDrop(); router.push('/admin/account?tab=password'); }}>
                                            <ListItemIcon>
                                                <IoShieldHalfSharp />
                                            </ListItemIcon>
                                            Reset Password
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() => {
                                                handleCloseMyAccDrop(); // close the menu
                                                logout();    // trigger your logout function
                                            }}
                                        >
                                            <ListItemIcon>
                                                <Logout fontSize="small" />
                                            </ListItemIcon>
                                            Logout
                                        </MenuItem>
                                    </Menu>
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Container>

            {/* Mobile search overlay — the small-screen search icon opens this
                centred box (the inline SearchBox input is hidden below lg). */}
            {mobileSearchOpen && (
                <div className="mobileSearchOverlay" onMouseDown={() => setMobileSearchOpen(false)}>
                    <div className="mobileSearchInner" onMouseDown={(e) => e.stopPropagation()}>
                        <SearchBox mobile onClose={() => setMobileSearchOpen(false)} />
                    </div>
                </div>
            )}
        </>
    );
}
