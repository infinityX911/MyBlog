'use client';

/**
 * components/Admin/Sidebar.tsx
 *
 * Fixed routes — all paths now lowercase Next.js convention:
 *   /admin/management/permissions/create   (was /admin/Permissions/Create)
 *   /admin/management/permissions          (was /admin/Permissions)
 *   /admin/management/roles/create         (was /admin/Roles/Create)
 *   /admin/management/roles                (was /admin/Roles)
 *   /admin/management/users/create         (was /admin/Users/Create)
 *   /admin/management/users                (was /admin/Users)
 *   /admin/orders                          (was /admin/Orders)
 *   /admin/myprojects/portfolio/navbar     (was /admin/MyProjects/Portfollio/Navbar)
 *   etc.
 *
 * useEffect path matching updated to match new lowercase routes.
 *
 * Updated: Added "Categories" link under Blog submenu.
 * Updated: Added "Downloads" menu under My Projects (after Blog).
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Button from '@mui/material/Button';
import { MdDashboard, MdMessage, MdRateReview, MdArticle, MdDownload, MdEditNotifications, MdSwapHoriz, MdViewColumn, MdForum, MdCampaign, MdPermMedia, MdSettings } from 'react-icons/md';
import { FaAngleRight, FaBell, FaCartArrowDown, FaUserShield, FaUserLock, FaChartBar, FaYoutube, FaPlug } from 'react-icons/fa6';
import { FaUsersCog } from 'react-icons/fa';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { TbLayoutNavbarExpandFilled } from 'react-icons/tb';
import { RiContactsBook2Fill, RiPinyinInput } from 'react-icons/ri';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import { IoIosSettings, IoMdLogOut } from 'react-icons/io';
import { AiFillProject } from 'react-icons/ai';
import { useAdmin } from '@/context/AdminContext';
import { useSession } from 'next-auth/react';

// Management items — label shown in UI + their lowercase route segment + the
// permission required to see the tab at all.
const managementItems = [
    { label: 'Permissions', segment: 'permissions', perm: 'view-permissions' },
    { label: 'Roles',       segment: 'roles',       perm: 'view-roles'       },
    { label: 'Users',       segment: 'users',       perm: 'view-users'       },
];

export default function Sidebar() {
    const [activeTab, setActiveTab]   = useState<number | null>(null);
    const [openMenus, setOpenMenus]   = useState<Record<number, boolean>>({});
    const [openLevel1, setOpenLevel1] = useState<string | null>(null);
    const [openLevel2, setOpenLevel2] = useState<string | null>(null);

    const { setIsToggleSidebar, logout } = useAdmin();
    const pathname = usePathname();
    const router = useRouter();

    // ── Permission gating: hide tabs the user can't view ────────────────────
    const { data: session } = useSession();
    const perms = ((session?.user as any)?.permissions ?? []) as string[];
    const roles = ((session?.user as any)?.roles ?? []) as string[];
    const isSuperAdmin = roles.includes('administrator');
    const can = (p: string) => isSuperAdmin || perms.includes(p);
    const visibleMgmt = managementItems.filter((m) => can(m.perm));
    const canManagement = visibleMgmt.length > 0 || can('manage-notifications') || can('manage-settings') || can('view-media');
    const canPortfolio = ['view-navbar', 'view-header', 'view-projects', 'view-testimonials', 'view-contactus', 'manage-footer'].some(can);
    const canBlog = ['view-navbar', 'view-pages', 'view-youtube-channels', 'manage-footer', 'view-posts', 'view-categories', 'view-comments'].some(can);
    const canProjects = canPortfolio || canBlog || can('manage-downloads') || can('manage-yt-downloader');

    // ── Section groups (headings hide when all their items are hidden) ───────
    const canMgmtGroup = canManagement || canProjects;
    const canStore = can('view-orders');
    const canComms = can('view-messages') || can('view-notifications') || can('oversee-messages') || can('manage-announcements');
    const canSystem = can('manage-settings');

    // Section-heading label style (uppercase, muted — like the reference).
    const sectionLabel: React.CSSProperties = {
        display: 'block', padding: '16px 18px 6px', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9aa0b3', pointerEvents: 'none',
    };

    // -- Toggle handlers ------------------------------------------------------
    const toggleMenu = (tab: number) => {
        setActiveTab(tab);
        setOpenMenus(prev => {
            const newState: Record<number, boolean> = {};
            Object.keys(prev).forEach(key => (newState[Number(key)] = false));
            newState[tab] = !prev[tab];
            return newState;
        });
        setOpenLevel1(null);
        setOpenLevel2(null);
    };

    const toggleLevel1 = (name: string) => {
        setOpenLevel1(prev => (prev === name ? null : name));
        setOpenLevel2(null);
    };

    const toggleLevel2 = (name: string) => {
        setOpenLevel2(prev => (prev === name ? null : name));
    };

    // -- Auto-open correct menu based on current URL --------------------------
    useEffect(() => {
        if (pathname === '/') {
            setActiveTab(0);
        }
        // Management
        else if (pathname.startsWith('/admin/management')) {
            setActiveTab(1);
            setOpenMenus({ 1: true });
            if (pathname.includes('permissions')) { setOpenLevel1('Permissions'); setOpenLevel2('permissions'); }
            else if (pathname.includes('roles'))  { setOpenLevel1('Roles');       setOpenLevel2('roles');       }
            else if (pathname.includes('users'))  { setOpenLevel1('Users');       setOpenLevel2('users');       }
        }
        // My Projects
        else if (pathname.startsWith('/admin/myprojects')) {
            setActiveTab(2);
            setOpenMenus({ 2: true });
            // Blog (now contains Posts / Categories / Comments / Downloads as level2)
            if (pathname.startsWith('/admin/myprojects/blog/navbar')) {
                setOpenLevel1('Blog'); setOpenLevel2('');
            }
            else if (pathname.startsWith('/admin/myprojects/blog/pages')) {
                setOpenLevel1('Blog'); setOpenLevel2('BlogPages');
            }
            else if (pathname.startsWith('/admin/myprojects/blog/categories')) {
                setOpenLevel1('Blog'); setOpenLevel2('Categories');
            }
            else if (pathname.startsWith('/admin/myprojects/blog/comments')) {
                setOpenLevel1('Blog'); setOpenLevel2('Comments');
            }
            else if (pathname.startsWith('/admin/myprojects/blog')) {
                setOpenLevel1('Blog'); setOpenLevel2('Posts');
            }
            else if (pathname.startsWith('/admin/myprojects/downloads')) {
                setOpenLevel1('Blog'); setOpenLevel2('Downloads');
            }
            // YouTube Downloader
            else if (pathname.startsWith('/admin/myprojects/yt-downloader/pages')) {
                setOpenLevel1('YouTube'); setOpenLevel2('YtPages');
            }
            else if (pathname.startsWith('/admin/myprojects/yt-downloader/analytics')
                  || pathname.startsWith('/admin/myprojects/yt-downloader/settings')) {
                setOpenLevel1('YouTube'); setOpenLevel2('');
            }
            // Portfolio
            else if (pathname.includes('navbar'))           { setOpenLevel1('Portfolio'); setOpenLevel2('Navbar');        }
            else if (pathname.includes('headers'))          { setOpenLevel1('Portfolio'); setOpenLevel2('Headers');       }
            else if (pathname.includes('projects'))         { setOpenLevel1('Portfolio'); setOpenLevel2('Projects');      }
            else if (pathname.includes('testimonials'))     { setOpenLevel1('Portfolio'); setOpenLevel2('Testimonials'); }
            else if (pathname.includes('contactus'))        { setOpenLevel1('Portfolio'); setOpenLevel2('Contact US');   }
            else if (pathname.includes('footer'))           { setOpenLevel1('Portfolio'); setOpenLevel2('Footer');       }
        }
        else if (pathname.startsWith('/admin/orders'))         setActiveTab(3);
        else if (pathname.startsWith('/admin/messages'))       setActiveTab(4);
        else if (pathname.startsWith('/admin/notifications'))  setActiveTab(5);
        else if (pathname.startsWith('/admin/settings'))       setActiveTab(6);
        else if (pathname.startsWith('/admin/conversations'))  setActiveTab(7);
        else if (pathname.startsWith('/admin/announcements'))  setActiveTab(8);
    }, [pathname]);

    return (
        <div className="sidebar">
            <ul>

                {/* ── Section: MAIN ── */}
                <li style={{ listStyle: 'none' }}><span style={sectionLabel}>Main</span></li>

                {/* -- Dashboard (admin home — visible to anyone who can enter) - */}
                <li>
                    <Link href="/admin/dashboard">
                        <Button
                            className={`w-100 ${activeTab === 0 ? 'active' : ''}`}
                            onClick={() => toggleMenu(0)}
                        >
                            <span className="icon"><MdDashboard /></span> Dashboard
                            <span className={`arrow ${activeTab === 0 ? 'rotate' : ''}`}><FaAngleRight /></span>
                        </Button>
                    </Link>
                </li>

                {/* ── Section: MANAGEMENT ── */}
                <li style={{ listStyle: 'none', display: canMgmtGroup ? undefined : 'none' }}>
                    <span style={sectionLabel}>Management</span>
                </li>

                {/* -- Management --------------------------------------------- */}
                <li style={{ display: canManagement ? undefined : 'none' }}>
                    <Button
                        className={`w-100 ${openMenus[1] ? 'active rotate' : ''}`}
                        onClick={() => toggleMenu(1)}
                    >
                        <span className="icon"><FaUsersCog /></span> Management
                        <span className="arrow"><FaAngleRight /></span>
                    </Button>

                    <div className={`submenuWrapper ${openMenus[1] ? 'open' : ''}`}>
                        <ul className="submenu">
                            {visibleMgmt.map(({ label, segment }) => (
                                <li key={segment}>
                                    <Button
                                        className={`w-100 nestedMenu ${openLevel1 === label ? 'active' : ''}`}
                                        onClick={() => toggleLevel1(label)}
                                    >
                                        <span className="icon">
                                            {label === 'Roles' ? <FaUserShield /> : <FaUserLock />}
                                        </span>
                                        {label}
                                        <span className="arrow"><FaAngleRight /></span>
                                    </Button>

                                    <ul className={`submenu nested ${openLevel1 === label ? 'open' : ''}`}>
                                        <li>
                                            <Link
                                                href={`/admin/management/${segment}/create`}
                                                onClick={() => setIsToggleSidebar(true)}
                                                className={pathname === `/admin/management/${segment}/create` ? 'active' : ''}
                                            >
                                                <span className="icon"><FaAngleRight /></span> Add {label}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href={`/admin/management/${segment}`}
                                                onClick={() => setIsToggleSidebar(true)}
                                                className={pathname === `/admin/management/${segment}` ? 'active' : ''}
                                            >
                                                <span className="icon"><FaAngleRight /></span> View {label}
                                            </Link>
                                        </li>
                                    </ul>
                                </li>
                            ))}

                            {/* Notification Icons — single config page.
                                Rendered as a Button (like Permissions/Roles/Users)
                                instead of a Link>Button, so its active/hover style
                                matches the other items exactly. */}
                            <li style={{ display: can('manage-notifications') ? undefined : 'none' }}>
                                <Button
                                    className={`w-100 nestedMenu ${pathname === '/admin/management/notification-icons' ? 'active' : ''}`}
                                    onClick={() => {
                                        router.push('/admin/management/notification-icons');
                                        setIsToggleSidebar(true);
                                    }}
                                >
                                    <span className="icon"><MdEditNotifications /></span>
                                    Notification Icons
                                    <span className="arrow"><FaAngleRight /></span>
                                </Button>
                            </li>

                            {/* Redirects — single config page */}
                            <li style={{ display: can('manage-settings') ? undefined : 'none' }}>
                                <Button
                                    className={`w-100 nestedMenu ${pathname === '/admin/management/redirects' ? 'active' : ''}`}
                                    onClick={() => {
                                        router.push('/admin/management/redirects');
                                        setIsToggleSidebar(true);
                                    }}
                                >
                                    <span className="icon"><MdSwapHoriz /></span>
                                    Redirects
                                    <span className="arrow"><FaAngleRight /></span>
                                </Button>
                            </li>

                            {/* Media Library — every uploaded file, across sites */}
                            <li style={{ display: can('view-media') ? undefined : 'none' }}>
                                <Button
                                    className={`w-100 nestedMenu ${pathname === '/admin/management/media' ? 'active' : ''}`}
                                    onClick={() => {
                                        router.push('/admin/management/media');
                                        setIsToggleSidebar(true);
                                    }}
                                >
                                    <span className="icon"><MdPermMedia /></span>
                                    Media Library
                                    <span className="arrow"><FaAngleRight /></span>
                                </Button>
                            </li>
                        </ul>
                    </div>
                </li>

                {/* -- My Projects -------------------------------------------- */}
                <li style={{ display: canProjects ? undefined : 'none' }}>
                    <Button
                        className={`w-100 ${openMenus[2] ? 'active rotate' : ''}`}
                        onClick={() => toggleMenu(2)}
                    >
                        <span className="icon"><AccountTreeIcon className="MuiSvgIcon-root" /></span> My Projects
                        <span className="arrow"><FaAngleRight /></span>
                    </Button>

                    <div className={`submenuWrapper ${openMenus[2] ? 'open' : ''}`}>
                        <ul className="submenu">
                            <li style={{ display: canPortfolio ? undefined : 'none' }}>
                                <Button
                                    className={`w-100 nestedMenu ${openLevel1 === 'Portfolio' ? 'active' : ''}`}
                                    onClick={() => toggleLevel1('Portfolio')}
                                >
                                    <span className="icon"><FaUserShield /></span> Portfolio
                                    <span className="arrow"><FaAngleRight /></span>
                                </Button>

                                <ul className={`submenu nested ${openLevel1 === 'Portfolio' ? 'open' : ''}`}>

                                    {/* Navbar */}
                                    <li>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Navbar' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Navbar')}
                                        >
                                            <span className="icon"><TbLayoutNavbarExpandFilled /></span> Navbar
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Navbar' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/navbar/create"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/navbar/create' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> Add Navbar
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/navbar"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/navbar' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Navbar
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    {/* Headers */}
                                    <li>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Headers' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Headers')}
                                        >
                                            <span className="icon"><RiPinyinInput /></span> Headers
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Headers' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/headers/create"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/headers/create' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> Add Headers
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/headers"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/headers' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Headers
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    {/* Projects */}
                                    <li>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Projects' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Projects')}
                                        >
                                            <span className="icon"><AiFillProject /></span> Projects
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Projects' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/projects/create"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/projects/create' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> Add Projects
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/projects"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/projects' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Projects
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    {/* Testimonials */}
                                    <li>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Testimonials' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Testimonials')}
                                        >
                                            <span className="icon"><MdRateReview /></span> Testimonials
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Testimonials' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/testimonials/create"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/testimonials/create' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> Add Testimonials
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/testimonials"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/testimonials' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Testimonials
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    {/* Contact US */}
                                    <li>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Contact US' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Contact US')}
                                        >
                                            <span className="icon"><RiContactsBook2Fill /></span> Contact US
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Contact US' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/contactus"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/contactus' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Contacts
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    {/* Footer */}
                                    <li>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Footer' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Footer')}
                                        >
                                            <span className="icon"><LibraryBooksIcon /></span> Footer
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Footer' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/footer/create"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/footer/create' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> Add Footer
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/portfolio/footer"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/portfolio/footer' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Footer
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                </ul>
                            </li>

                            {/* -- Blog ---------------------------------------- */}
                            <li>
                                <Button
                                    style={{ display: canBlog ? undefined : 'none' }}
                                    className={`w-100 nestedMenu ${openLevel1 === 'Blog' ? 'active' : ''}`}
                                    onClick={() => toggleLevel1('Blog')}
                                >
                                    <span className="icon"><MdArticle /></span> Blog
                                    <span className="arrow"><FaAngleRight /></span>
                                </Button>
                                <ul className={`submenu nested ${openLevel1 === 'Blog' ? 'open' : ''}`}>

                                    {/* Navbar */}
                                    <li style={{ display: can('view-navbar') ? undefined : 'none' }}>
                                        <Link
                                            href="/admin/myprojects/blog/navbar"
                                            onClick={() => setIsToggleSidebar(true)}
                                            className={pathname === '/admin/myprojects/blog/navbar' ? 'active' : ''}
                                        >
                                            <span className="icon"><TbLayoutNavbarExpandFilled /></span> Navbar
                                        </Link>
                                    </li>

                                    {/* Posts */}
                                    <li style={{ display: can('view-posts') ? undefined : 'none' }}>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Posts' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Posts')}
                                        >
                                            <span className="icon"><MdArticle /></span> Posts
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Posts' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/blog/create"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/blog/create' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> Add Post
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/blog"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/blog' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Posts
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    {/* Pages */}
                                    <li style={{ display: can('view-pages') ? undefined : 'none' }}>
                                        <Link
                                            href="/admin/myprojects/blog/pages"
                                            onClick={() => setIsToggleSidebar(true)}
                                            className={pathname.startsWith('/admin/myprojects/blog/pages') ? 'active' : ''}
                                        >
                                            <span className="icon"><MdArticle /></span> Pages
                                        </Link>
                                    </li>

                                    {/* YouTube Channels */}
                                    <li style={{ display: can('view-youtube-channels') ? undefined : 'none' }}>
                                        <Link
                                            href="/admin/myprojects/blog/youtube"
                                            onClick={() => setIsToggleSidebar(true)}
                                            className={pathname.startsWith('/admin/myprojects/blog/youtube') ? 'active' : ''}
                                        >
                                            <span className="icon"><FaYoutube /></span> YouTube Channels
                                        </Link>
                                    </li>

                                    {/* Footer */}
                                    <li style={{ display: can('manage-footer') ? undefined : 'none' }}>
                                        <Link
                                            href="/admin/myprojects/blog/footer"
                                            onClick={() => setIsToggleSidebar(true)}
                                            className={pathname.startsWith('/admin/myprojects/blog/footer') ? 'active' : ''}
                                        >
                                            <span className="icon"><MdViewColumn /></span> Footer
                                        </Link>
                                    </li>

                                    {/* Ads */}
                                    <li style={{ display: can('access-admin-panel') ? undefined : 'none' }}>
                                        <Link
                                            href="/admin/myprojects/blog/ads"
                                            onClick={() => setIsToggleSidebar(true)}
                                            className={pathname.startsWith('/admin/myprojects/blog/ads') ? 'active' : ''}
                                        >
                                            <span className="icon"><FaCartArrowDown /></span> Ads
                                        </Link>
                                    </li>

                                    {/* Integrations */}
                                    <li style={{ display: can('access-admin-panel') ? undefined : 'none' }}>
                                        <Link
                                            href="/admin/myprojects/blog/integrations"
                                            onClick={() => setIsToggleSidebar(true)}
                                            className={pathname.startsWith('/admin/myprojects/blog/integrations') ? 'active' : ''}
                                        >
                                            <span className="icon"><FaPlug /></span> Integrations
                                        </Link>
                                    </li>

                                    {/* Categories */}
                                    <li style={{ display: can('view-categories') ? undefined : 'none' }}>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Categories' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Categories')}
                                        >
                                            <span className="icon"><LibraryBooksIcon /></span> Categories
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Categories' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/blog/categories/create"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/blog/categories/create' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> Add Category
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/blog/categories"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/blog/categories' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Categories
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    {/* Comments */}
                                    <li style={{ display: can('view-comments') ? undefined : 'none' }}>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Comments' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Comments')}
                                        >
                                            <span className="icon"><MdRateReview /></span> Comments
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Comments' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/blog/comments"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname.startsWith('/admin/myprojects/blog/comments') ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Comments
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    {/* Downloads */}
                                    <li style={{ display: can('manage-downloads') ? undefined : 'none' }}>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'Downloads' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('Downloads')}
                                        >
                                            <span className="icon"><MdDownload /></span> Downloads
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'Downloads' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/downloads/create"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/downloads/create' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> Add Download
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/downloads"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/downloads' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Downloads
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                </ul>
                            </li>

                            {/* -- YouTube Downloader -------------------------- */}
                            <li style={{ display: can('manage-yt-downloader') ? undefined : 'none' }}>
                                <Button
                                    className={`w-100 nestedMenu ${openLevel1 === 'YouTube' ? 'active' : ''}`}
                                    onClick={() => toggleLevel1('YouTube')}
                                >
                                    <span className="icon"><MdDownload /></span> YouTube Downloader
                                    <span className="arrow"><FaAngleRight /></span>
                                </Button>
                                <ul className={`submenu nested ${openLevel1 === 'YouTube' ? 'open' : ''}`}>

                                    {/* Pages (CMS) */}
                                    <li>
                                        <Button
                                            className={`w-100 nestedMenu ${openLevel2 === 'YtPages' ? 'active' : ''}`}
                                            onClick={() => toggleLevel2('YtPages')}
                                        >
                                            <span className="icon"><MdArticle /></span> Pages
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                        <ul className={`submenu nested ${openLevel2 === 'YtPages' ? 'open' : ''}`}>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/yt-downloader/pages/create"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/yt-downloader/pages/create' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> Add Page
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href="/admin/myprojects/yt-downloader/pages"
                                                    onClick={() => setIsToggleSidebar(true)}
                                                    className={pathname === '/admin/myprojects/yt-downloader/pages' ? 'active' : ''}
                                                >
                                                    <span className="icon"><FaAngleRight /></span> View Pages
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>

                                    {/* Analytics (level-2 leaf link) */}
                                    <li>
                                        <Button
                                            className={`w-100 nestedMenu ${pathname === '/admin/myprojects/yt-downloader/analytics' ? 'active' : ''}`}
                                            onClick={() => { setIsToggleSidebar(true); router.push('/admin/myprojects/yt-downloader/analytics'); }}
                                        >
                                            <span className="icon"><FaChartBar /></span> Analytics
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                    </li>

                                    {/* Settings — YouTube session cookies for HD formats */}
                                    <li>
                                        <Button
                                            className={`w-100 nestedMenu ${pathname === '/admin/myprojects/yt-downloader/settings' ? 'active' : ''}`}
                                            onClick={() => { setIsToggleSidebar(true); router.push('/admin/myprojects/yt-downloader/settings'); }}
                                        >
                                            <span className="icon"><MdSettings /></span> Settings
                                            <span className="arrow"><FaAngleRight /></span>
                                        </Button>
                                    </li>

                                </ul>
                            </li>

                        </ul>
                    </div>
                </li>

                {/* ── Section: STORE ── */}
                <li style={{ listStyle: 'none', display: canStore ? undefined : 'none' }}>
                    <span style={sectionLabel}>Store</span>
                </li>

                {/* -- Orders ------------------------------------------------- */}
                <li style={{ display: can('view-orders') ? undefined : 'none' }}>
                    <Link href="/admin/orders">
                        <Button
                            className={`w-100 ${activeTab === 3 ? 'active' : ''}`}
                            onClick={() => toggleMenu(3)}
                        >
                            <span className="icon"><FaCartArrowDown /></span> Orders
                            <span className="arrow"><FaAngleRight /></span>
                        </Button>
                    </Link>
                </li>

                {/* ── Section: COMMUNICATION ── */}
                <li style={{ listStyle: 'none', display: canComms ? undefined : 'none' }}>
                    <span style={sectionLabel}>Communication</span>
                </li>

                {/* -- Messages ----------------------------------------------- */}
                <li style={{ display: can('view-messages') ? undefined : 'none' }}>
                    <Link href="/admin/messages">
                        <Button
                            className={`w-100 ${activeTab === 4 ? 'active' : ''}`}
                            onClick={() => toggleMenu(4)}
                        >
                            <span className="icon"><MdMessage /></span> Messages
                            <span className="arrow"><FaAngleRight /></span>
                        </Button>
                    </Link>
                </li>

                {/* Support is now a filter inside Messages (grid icon → Support Chats),
                    so a separate sidebar item is no longer needed. */}

                {/* -- Message Oversight (read-only, all conversations) ------- */}
                <li style={{ display: can('oversee-messages') ? undefined : 'none' }}>
                    <Link href="/admin/conversations">
                        <Button
                            className={`w-100 ${activeTab === 7 ? 'active' : ''}`}
                            onClick={() => toggleMenu(7)}
                        >
                            <span className="icon"><MdForum /></span> Message Oversight
                            <span className="arrow"><FaAngleRight /></span>
                        </Button>
                    </Link>
                </li>

                {/* -- Announcements (composer) ------------------------------- */}
                <li style={{ display: can('manage-announcements') ? undefined : 'none' }}>
                    <Link href="/admin/announcements">
                        <Button
                            className={`w-100 ${activeTab === 8 ? 'active' : ''}`}
                            onClick={() => toggleMenu(8)}
                        >
                            <span className="icon"><MdCampaign /></span> Announcements
                            <span className="arrow"><FaAngleRight /></span>
                        </Button>
                    </Link>
                </li>

                {/* -- Notifications ------------------------------------------ */}
                <li style={{ display: can('view-notifications') ? undefined : 'none' }}>
                    <Link href="/admin/notifications">
                        <Button
                            className={`w-100 ${activeTab === 5 ? 'active' : ''}`}
                            onClick={() => toggleMenu(5)}
                        >
                            <span className="icon"><FaBell /></span> Notifications
                            <span className="arrow"><FaAngleRight /></span>
                        </Button>
                    </Link>
                </li>

                {/* ── Section: SYSTEM ── */}
                <li style={{ listStyle: 'none', display: canSystem ? undefined : 'none' }}>
                    <span style={sectionLabel}>System</span>
                </li>

                {/* -- Settings ----------------------------------------------- */}
                <li style={{ display: can('manage-settings') ? undefined : 'none' }}>
                    <Link href="/admin/settings">
                        <Button
                            className={`w-100 ${activeTab === 6 ? 'active' : ''}`}
                            onClick={() => toggleMenu(6)}
                        >
                            <span className="icon"><IoIosSettings /></span> Settings
                            <span className="arrow"><FaAngleRight /></span>
                        </Button>
                    </Link>
                </li>

            </ul>

            <br />

            {/* -- Logout box ------------------------------------------------- */}
            <div className="logoutWrapper">
                <div className="logoutBox">
                    <Button variant="contained" onClick={logout}>
                        <IoMdLogOut /> Logout
                    </Button>
                </div>
            </div>

        </div>
    );
}
