'use client';

/**
 * components/TutorialShell.tsx
 *
 * Admin-panel-style tutorial layout:
 *   - a full-width strip (with the "Contents" toggle) that stays put — it never
 *     shifts when the sidebar opens/closes
 *   - a fixed left rail that slides in seamlessly below that strip and PUSHES
 *     the content right (on phones it overlays instead, with a backdrop)
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import IconButton from '@mui/material/IconButton';
import { MdMenuOpen, MdOutlineMenu, MdChevronRight } from 'react-icons/md';
import TutorialSidebar from './TutorialSidebar';
import type { SidebarSection } from '@/lib/page-sidebar';
import s from './TutorialLayout.module.css';

export default function TutorialShell({
    title,
    sections,
    children,
    homeHref,
    parentLabel,
    parentHref,
}: {
    title: string;
    sections: SidebarSection[];
    children: React.ReactNode;
    /** URL of the tutorial's own landing page — makes the title crumb a link. */
    homeHref?: string;
    /** Breadcrumb root (e.g. "Tutorials"), derived from the navbar parent. */
    parentLabel?: string;
    parentHref?: string;
}) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Only one panel may be open at a time. The navbar's mobile menu lives in a
    // completely separate component, so the two talk through a window event
    // rather than shared state: whoever opens announces it, and the other one
    // closes. On a phone both panels overlap, and having them stacked was
    // confusing — you couldn't tell which "close" belonged to which.
    useEffect(() => {
        const closeMe = () => setOpen(false);
        window.addEventListener('ui:navbar-menu-open', closeMe);
        return () => window.removeEventListener('ui:navbar-menu-open', closeMe);
    }, []);

    useEffect(() => {
        if (open) window.dispatchEvent(new CustomEvent('ui:tutorial-rail-open'));
    }, [open]);

    // Active section = the one whose lesson matches the current URL (like the
    // CodeWithHarry breadcrumb: Tutorials › React Tutorial › The Foundations).
    let activeSection = '';
    for (const sec of sections) {
        if (sec.items.some((it) => it.href === pathname)) { activeSection = sec.title; break; }
    }

    return (
        <div className={`${s.shell} ${open ? s.shellOpen : ''}`}>
            {/* Full-width strip — the toggle stays fixed (like the admin panel),
                with breadcrumbs beside it. */}
            <div className={s.topstrip}>
                <IconButton className={s.toggle} onClick={() => setOpen((o) => !o)} aria-label="Toggle tutorial contents" aria-expanded={open}>
                    {open ? <MdMenuOpen /> : <MdOutlineMenu />}
                </IconButton>
                <nav className={s.crumbs} aria-label="Breadcrumb">
                    {parentLabel && (
                        <>
                            {parentHref
                                ? <Link href={parentHref} className={s.crumb}>{parentLabel}</Link>
                                : <span className={s.crumb}>{parentLabel}</span>}
                            <MdChevronRight className={s.crumbSep} />
                        </>
                    )}
                    {homeHref ? (
                        <Link href={homeHref} className={s.crumb}>{title}</Link>
                    ) : (
                        <span className={activeSection ? s.crumb : s.crumbActive}>{title}</span>
                    )}
                    {activeSection && (
                        <>
                            <MdChevronRight className={s.crumbSep} />
                            <span className={s.crumbActive}>{activeSection}</span>
                        </>
                    )}
                </nav>
            </div>

            {/* Fixed left rail — slides in below the strip. */}
            <aside className={s.rail}>
                <TutorialSidebar title={title} sections={sections} />
            </aside>

            {/* Content — pushed right when the rail is open. */}
            <div className={s.main}>{children}</div>

            {open && <div className={s.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />}
        </div>
    );
}
