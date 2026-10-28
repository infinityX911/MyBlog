'use client';

/**
 * components/TutorialSidebar.tsx
 *
 * Left-hand tutorial navigation: collapsible sections of lessons (links).
 * The section holding the current page is expanded by default; the active
 * lesson is highlighted. Purely presentational — data comes from the CMS page's
 * `sidebar` JSON (see lib/page-sidebar.ts).
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SidebarSection } from '@/lib/page-sidebar';
import styles from './TutorialSidebar.module.css';

export default function TutorialSidebar({ title, sections }: { title?: string; sections: SidebarSection[] }) {
    const pathname = usePathname();
    const activeIdx = sections.findIndex((s) => s.items.some((i) => i.href === pathname));

    const [open, setOpen] = useState<Record<number, boolean>>(() => {
        const init: Record<number, boolean> = {};
        sections.forEach((_, i) => { init[i] = activeIdx === -1 ? i === 0 : i === activeIdx; });
        return init;
    });
    const toggle = (i: number) => setOpen((p) => ({ ...p, [i]: !p[i] }));

    return (
        <nav className={styles.nav} aria-label="Tutorial navigation">
            {title && <div className={styles.navTitle}>{title}</div>}

            {sections.map((section, i) => (
                <div className={styles.section} key={i}>
                    <button
                        type="button"
                        className={styles.sectionBtn}
                        onClick={() => toggle(i)}
                        aria-expanded={!!open[i]}
                    >
                        <span>{section.title}</span>
                        <svg className={`${styles.chev} ${open[i] ? styles.chevOpen : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>

                    {open[i] && section.items.length > 0 && (
                        <ul className={styles.items}>
                            {section.items.map((item, j) => (
                                <li key={j}>
                                    <Link
                                        href={item.href}
                                        className={`${styles.item} ${item.href === pathname ? styles.itemActive : ''}`}
                                    >
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ))}
        </nav>
    );
}
