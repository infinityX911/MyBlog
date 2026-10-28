'use client';

/**
 * app/admin/dashboard/page.tsx
 * Converted from: pages/Dashboard/Dashboard.js
 *
 * Changes:
 *  - Added 'use client' (uses useState, useEffect)
 *  - All import paths updated to new component locations
 *  - Zero JSX changes — layout, classNames, MUI all identical
 */

import DashboardBox from '@/components/admin/dashboard/DashboardBox';
import { FaUserCircle, FaRegNewspaper, FaEye, FaUserShield } from 'react-icons/fa';
import { IoIosTimer } from 'react-icons/io';
import { useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import { HiDotsHorizontal } from 'react-icons/hi';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MyAreaChart from '@/components/admin/dashboard/MyAreaChart';
import { Col, Container, Row } from 'react-bootstrap';
import RecentActivity from '@/components/admin/dashboard/RecentActivity';
import PopularClients from '@/components/admin/dashboard/PopularClients';
import DashboardInsights from '@/components/admin/dashboard/DashboardInsights';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

function Dashboard() {
    const { data: session } = useSession();
    const perms = ((session?.user as any)?.permissions ?? []) as string[];
    // The dashboard is the admin LANDING (anyone with access-admin-panel reaches
    // it), but its analytics — cards, sales graph, recent activity — are only for
    // users who hold 'view-dashboard'. Everyone else sees a friendly placeholder.
    const canDashboard = perms.includes('view-dashboard');

    // Visitors card: range-driven series from the post_views log.
    type Range = 'day' | 'week' | 'month' | 'year';
    const [range, setRange] = useState<Range>('year');
    const [visitorTotal, setVisitorTotal] = useState(0);
    const [visitorSeries, setVisitorSeries] = useState<{ name: string; value: number }[]>([]);

    const RANGE_LABEL: Record<Range, string> = {
        day: 'last 24 hours', week: 'last 7 days', month: 'last 30 days', year: 'last 12 months',
    };
    const rangeOptions: { label: string; value: Range }[] = [
        { label: 'Last Day', value: 'day' },
        { label: 'Last Week', value: 'week' },
        { label: 'Last Month', value: 'month' },
        { label: 'Last Year', value: 'year' },
    ];

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Refetch the visitor trend whenever the range changes.
    useEffect(() => {
        if (!canDashboard) return;
        fetch(`/api/admin/analytics/visitors?range=${range}`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (d) { setVisitorTotal(d.total ?? 0); setVisitorSeries(d.series ?? []); } })
            .catch(() => { /* non-critical */ });
    }, [canDashboard, range]);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const ITEM_HEIGHT = 48;
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <Container fluid className="right-content">

            <HeaderPanel
                title="Dashboard"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                ]}
            />

            {!canDashboard && (
                <div className="card shadow border-0 p-4 mt-2 text-center">
                    <h4 className="mb-2">Welcome 👋</h4>
                    <p className="mb-0" style={{ color: '#888' }}>
                        You don&apos;t have permission to view the dashboard analytics.
                        Use the menu on the left to open the sections you have access to.
                    </p>
                </div>
            )}

            {canDashboard && (
              <>
              <Row>
                <Col xs={12} sm={12} md={12} lg={12} xl={8} className="p-0 m-0">
                    <Container fluid>
                        <Row>
                            <Col xs={12} sm={12} md={6} lg={6} xl={6} className="GreenBox">
                                <div className="dashboardBoxWrapper d-flex">
                                    <DashboardBox color={['#1da256', '#48d483']} icon={<FaRegNewspaper />} title="Total Posts" metric="posts" />
                                </div>
                            </Col>
                            <Col xs={12} sm={12} md={6} lg={6} xl={6} className="PurpleBox">
                                <div className="dashboardBoxWrapper d-flex">
                                    <DashboardBox color={['#c012e2', '#eb64fe']} icon={<FaUserCircle />} title="Total Users" metric="users" />
                                </div>
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12} sm={12} md={6} lg={6} xl={6} className="BlueBox">
                                <div className="dashboardBoxWrapper d-flex">
                                    <DashboardBox color={['#2c7Be5', '#60aff5']} icon={<FaEye />} title="Page Views" metric="views" />
                                </div>
                            </Col>
                            <Col xs={12} sm={12} md={6} lg={6} xl={6} className="OrangeBox">
                                <div className="dashboardBoxWrapper d-flex">
                                    <DashboardBox color={['#e1950e', '#f3cd29']} icon={<FaUserShield />} title="Total Roles" metric="roles" />
                                </div>
                            </Col>
                        </Row>
                    </Container>
                </Col>

                <Col className="MyGraph" xs={12} sm={12} md={12} lg={12} xl={4}>
                    <div className="box graphbox">
                        <div className="d-flex align-items-center w-100 bottomEle graphboxHeading">
                            <h6 className="text-white mb-0 mt-0">Visitors</h6>
                            <div className="toggleIcon ms-auto">
                                <span onClick={handleClick}>
                                    <HiDotsHorizontal />
                                </span>
                                <Menu
                                    id="dropdown_menu"
                                    anchorEl={anchorEl}
                                    open={open}
                                    onClose={handleClose}
                                    slotProps={{
                                        list: { 'aria-labelledby': 'long-button' },
                                        paper: {
                                            style: {
                                                maxHeight: ITEM_HEIGHT * 4.5,
                                                width: '20ch',
                                            },
                                        },
                                    }}
                                >
                                    {rangeOptions.map((option) => (
                                        <MenuItem
                                            key={option.value}
                                            selected={option.value === range}
                                            onClick={() => { setRange(option.value); handleClose(); }}
                                        >
                                            <IoIosTimer className="menuIcon" /> {option.label}
                                        </MenuItem>
                                    ))}
                                </Menu>
                            </div>
                        </div>
                        <h3 className="text-white font-weight-bold graphboxHeading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {visitorTotal.toLocaleString()}
                            <span style={{ color: '#5eead4', fontSize: 14, fontWeight: 600 }}>visitors</span>
                        </h3>
                        <p className="graphboxHeading">in the {RANGE_LABEL[range]}</p>
                        <MyAreaChart data={visitorSeries} />
                    </div>
                </Col>
            </Row>

            <Row>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                    <div className="card shadow border-0 p-0 p-sm-3 mt-1">
                        <PopularClients />
                    </div>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                    <div className="card shadow border-0 p-0 p-sm-3 mt-1">
                        <RecentActivity />
                    </div>
                </Col>
            </Row>

            {/* GA-powered widgets: Visitors Device, Countries, Page Views,
                Traffic Sources. Real data once GA4 Data API is configured;
                demo data until then. */}
            <DashboardInsights />
              </>
            )}

        </Container>
    );
}

export default Dashboard;
