'use client';

/**
 * components/admin/TutorialSidebarEditor.tsx
 *
 * Builds a page's optional "tutorial sidebar" — collapsible sections, each with
 * a list of lessons. Each lesson links to an EXISTING published post or page,
 * picked from a dropdown (so links never point at a non-existent path). A raw
 * path field is still there for custom/external links.
 *
 * If left empty, the page renders normally; add a section and it switches to the
 * tutorial layout (post template + left navigation).
 */

import React, { useEffect, useState } from 'react';
import type { SidebarItem, SidebarSection } from '@/lib/page-sidebar';

interface Props {
    value: SidebarSection[];
    onChange: (sections: SidebarSection[]) => void;
}

interface LinkOpt { title: string; path: string }

export default function TutorialSidebarEditor({ value, onChange }: Props) {
    const sections = value ?? [];
    const [opts, setOpts] = useState<{ posts: LinkOpt[]; pages: LinkOpt[] }>({ posts: [], pages: [] });

    useEffect(() => {
        fetch('/api/blog/link-options')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d) setOpts({ posts: d.posts ?? [], pages: d.pages ?? [] }); })
            .catch(() => { /* non-critical — the raw path field still works */ });
    }, []);

    const addSection = () => onChange([...sections, { title: 'New section', items: [] }]);
    const removeSection = (si: number) => onChange(sections.filter((_, i) => i !== si));
    const setTitle = (si: number, title: string) =>
        onChange(sections.map((s, i) => (i === si ? { ...s, title } : s)));

    const addItem = (si: number) =>
        onChange(sections.map((s, i) => (i === si ? { ...s, items: [...s.items, { label: '', href: '' }] } : s)));
    const removeItem = (si: number, ii: number) =>
        onChange(sections.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s)));
    const setItem = (si: number, ii: number, patch: Partial<SidebarItem>) =>
        onChange(sections.map((s, i) => (i === si
            ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) }
            : s)));

    // Picking a target sets the href, and fills the label if it's still blank.
    const pickTarget = (si: number, ii: number, path: string, title: string) => {
        const current = sections[si].items[ii];
        setItem(si, ii, { href: path, label: current.label && current.label.trim() ? current.label : title });
    };

    return (
        <div>
            {sections.length === 0 && (
                <p className="para" style={{ color: '#888', marginBottom: 10 }}>
                    No sidebar. Add a section to turn this into a tutorial page (post layout + left navigation).
                </p>
            )}

            {sections.map((section, si) => (
                <div key={si} className="card border-0 shadow-sm p-3 mb-3" style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <div className="d-flex align-items-center mb-3" style={{ gap: 8 }}>
                        <input
                            className="form-control"
                            value={section.title}
                            onChange={(e) => setTitle(si, e.target.value)}
                            placeholder="Section title (e.g. The Foundations)"
                            style={{ fontWeight: 600 }}
                        />
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeSection(si)} title="Remove section">x</button>
                    </div>

                    {section.items.map((item, ii) => (
                        <div key={ii} className="mb-2" style={{ paddingLeft: 12, borderLeft: '2px solid #e5e7eb' }}>
                            <div className="d-flex align-items-center mb-1" style={{ gap: 8 }}>
                                <input
                                    className="form-control"
                                    value={item.label}
                                    onChange={(e) => setItem(si, ii, { label: e.target.value })}
                                    placeholder="Lesson label (e.g. Selectors)"
                                />
                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => removeItem(si, ii)} title="Remove lesson">x</button>
                            </div>
                            <div className="d-flex align-items-center" style={{ gap: 8 }}>
                                <select
                                    className="form-control"
                                    value=""
                                    onChange={(e) => {
                                        const path = e.target.value;
                                        if (!path) return;
                                        const found = [...opts.pages, ...opts.posts].find((o) => o.path === path);
                                        pickTarget(si, ii, path, found ? found.title : '');
                                    }}
                                    style={{ maxWidth: 260 }}
                                >
                                    <option value="">Link to an existing page/post...</option>
                                    {opts.pages.length > 0 && (
                                        <optgroup label="Pages">
                                            {opts.pages.map((o) => <option key={o.path} value={o.path}>{o.title}</option>)}
                                        </optgroup>
                                    )}
                                    {opts.posts.length > 0 && (
                                        <optgroup label="Posts">
                                            {opts.posts.map((o) => <option key={o.path} value={o.path}>{o.title}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                                <input
                                    className="form-control"
                                    value={item.href}
                                    onChange={(e) => setItem(si, ii, { href: e.target.value })}
                                    placeholder="/path (auto-filled, or type a custom link)"
                                />
                            </div>
                        </div>
                    ))}

                    <button type="button" className="btn btn-sm btn-light mt-2" style={{ alignSelf: 'flex-start' }} onClick={() => addItem(si)}>
                        + Add lesson
                    </button>
                </div>
            ))}

            <button type="button" className="btn btn-outline-primary btn-sm" onClick={addSection}>
                + Add section
            </button>
        </div>
    );
}
