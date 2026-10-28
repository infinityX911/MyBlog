/**
 * lib/page-sidebar.ts
 *
 * Shared types + parser for a CMS page's "tutorial sidebar" — the left-hand
 * navigation (collapsible sections of lessons) shown on tutorial-style pages.
 *
 * Stored on CmsPage.sidebar as a JSON string:
 *   [{ "title": "The Foundations", "items": [{ "label": "Intro", "href": "/intro" }] }]
 *
 * An empty array (or null) means the page has no sidebar and renders normally.
 */

export interface SidebarItem { label: string; href: string }
export interface SidebarSection { title: string; items: SidebarItem[] }

/** Safely parse the stored JSON into a clean, typed sidebar (never throws). */
export function parseSidebar(raw: string | null | undefined): SidebarSection[] {
    if (!raw) return [];
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return []; }
    if (!Array.isArray(value)) return [];

    return value
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .map((s) => ({
            title: typeof s.title === 'string' ? s.title : '',
            items: Array.isArray(s.items)
                ? s.items
                    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
                    .map((i) => ({
                        label: typeof i.label === 'string' ? i.label : '',
                        href: typeof i.href === 'string' && i.href.trim() ? i.href.trim() : '#',
                    }))
                    .filter((i) => i.label !== '')
                : [],
        }))
        .filter((s) => s.title !== '' || s.items.length > 0);
}

/** Serialize back to a compact JSON string for saving. */
export function serializeSidebar(sections: SidebarSection[]): string {
    return JSON.stringify(sections ?? []);
}
