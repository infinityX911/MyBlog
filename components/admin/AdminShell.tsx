'use client';

/**
 * AdminShell.tsx
 *
 * Converted from: the JSX return block of MasterLayout.js (React)
 *
 * ─── Why this file exists ───────────────────────────────────────────────────
 * In Next.js 16 (App Router), layout.tsx is a Server Component by default.
 * Server Components cannot use hooks (useState, useContext, etc.).
 *
 * So we split the layout into two layers:
 *   layout.tsx  → Server Component  → imports CSS, sets metadata, wraps with <AdminProvider>
 *   AdminShell  → Client Component  → reads context, renders Navbar + Sidebar + content
 *
 * ─── What changed from MasterLayout.js ─────────────────────────────────────
 *  - `<Outlet />` (react-router) → `{children}` prop (Next.js convention)
 *  - All state/context logic lives in AdminContext.tsx now, not here
 *  - handleContentClick and sidebar toggle logic is identical
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useAdmin } from '@/context/AdminContext';
import Navbar from '@/components/admin/Navbar';
import Sidebar from '@/components/admin/Sidebar';
import React from "react";

interface AdminShellProps {
    children: React.ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
    const { isToggleSidebar, setIsToggleSidebar } = useAdmin();

    // Close sidebar when tapping main content on mobile — identical to React version
    const handleContentClick = () => {
        if (window.innerWidth <= 768) {
            setIsToggleSidebar(true);
        }
    };

    return (
        <>
            <Navbar />

            <div className="main d-flex">

                {/* ── Sidebar wrapper ── */}
                {/*
                 * Clicking inside sidebar stops propagation so it doesn't
                 * trigger handleContentClick on the content div behind it.
                 * Same behaviour as React version.
                 */}
                <div
                    className={`sidebarWrapper ${isToggleSidebar ? 'toggle' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Sidebar />
                </div>

                {/* ── Main content area ── */}
                {/*
                 * `<Outlet />` in React Router = `{children}` in Next.js.
                 * Each page file inside /app/admin/ renders here automatically.
                 */}
                <div
                    className={`content ${isToggleSidebar ? 'toggle' : ''}`}
                    onClick={handleContentClick}
                >
                    {children}
                </div>

            </div>
        </>
    );
}
