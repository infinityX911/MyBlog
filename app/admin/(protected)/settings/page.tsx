'use client';

/**
 * app/admin/(protected)/settings/page.tsx
 *
 * Upgraded Settings page — Plan Step 4:
 *  - Site selector dropdown (Portfolio, Blog)
 *  - Informations section (existing — now saves to DB)
 *  - Accessibility toggles (existing — now saves to DB)
 *  - Global SEO defaults (meta title format, separator, robots defaults)
 *  - Per-page SEO (index/follow, meta title/desc, canonical per page)
 *  - Sitemap toggle
 *  - OG image global default
 */

import { Col, Container, Row } from 'react-bootstrap';
import React, { useEffect, useState } from 'react';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

// Pages available per site
// Site types decide which page-set shows under Per-Page SEO
const SITE_TYPES: { value: string; label: string }[] = [
    { value: 'portfolio',  label: 'Portfolio'          },
    { value: 'blog',       label: 'Blog'               },
    { value: 'downloader', label: 'YouTube Downloader' },
    { value: 'custom',     label: 'Custom / Other'     },
];

// Pages available per site TYPE
const SITE_PAGES: Record<string, { slug: string; label: string }[]> = {
    portfolio: [
        { slug: '/',             label: 'Home'          },
        { slug: '/about',        label: 'About'         },
        { slug: '/projects',     label: 'Projects'      },
        { slug: '/testimonials', label: 'Testimonials'  },
        { slug: '/contact',      label: 'Contact'       },
    ],
    blog: [
        { slug: '/',              label: 'Blog Home'    },
        { slug: '/downloads',     label: 'Downloads'    },
        { slug: '/members',       label: 'Members'      },
        { slug: '/announcements', label: 'Announcements'},
        { slug: '/contact',       label: 'Contact'      },
    ],
    downloader: [
        { slug: '/',        label: 'Home'    },
        { slug: '/about',   label: 'About'   },
        { slug: '/privacy', label: 'Privacy' },
        { slug: '/contact', label: 'Contact' },
    ],
    custom: [
        { slug: '/', label: 'Home' },
    ],
};

interface PageSeoEntry {
    pageSlug:        string;
    pageLabel:       string;
    metaTitle:       string;
    metaDescription: string;
    robotsIndex:     boolean;
    robotsFollow:    boolean;
    canonicalUrl:    string;
    ogTitle:         string;
    ogDescription:   string;
    ogImage:         string;
}

interface SiteFormData {
    // Informations
    siteName:    string;
    siteType:    string;
    tagline:     string;
    emailAddress: string;
    websiteUrl:  string;
    description: string;
    // Accessibility
    notifyOnRegister:    boolean;
    registrationEnabled: boolean;
    directMessageNotify: boolean;
    membershipApproval:  boolean;
    hideViewCounts:      boolean;
    hidePostTags:        boolean;
    // Global SEO
    defaultMetaTitle:       string;
    defaultMetaDescription: string;
    titleSeparator:         string;
    defaultRobotsIndex:     boolean;
    defaultRobotsFollow:    boolean;
    ogImage:                string;
    metaKeywords:           string;
    twitterHandle:          string;
    // Branding
    siteIcon:               string;
    themeColor:             string;
    // Author / brand card (blog sidebar)
    authorEnabled:          boolean;
    authorName:             string;
    authorImage:            string;
    authorBio:              string;
    authorLink:             string;
    aboutStats:             string;
    sitemapEnabled:         boolean;
    announcementsEnabled:   boolean;
    membersEnabled:         boolean;
    announcementsRemoved:   boolean;
    membersRemoved:         boolean;
    // Per-page SEO
    pages: PageSeoEntry[];
}

const defaultForm = (siteType: string): SiteFormData => ({
    siteName:    '',
    siteType,
    tagline:     '',
    emailAddress: '',
    websiteUrl:  '',
    description: '',
    notifyOnRegister:    true,
    registrationEnabled: true,
    directMessageNotify: false,
    membershipApproval:  false,
    hideViewCounts:      false,
    hidePostTags:        false,
    defaultMetaTitle:       '',
    defaultMetaDescription: '',
    titleSeparator:         '|',
    defaultRobotsIndex:     true,
    defaultRobotsFollow:    true,
    ogImage:        '',
    metaKeywords:   '',
    twitterHandle:  '',
    siteIcon:       '',
    themeColor:     '#5b4fcf',
    authorEnabled:  true,
    authorName:     '',
    authorImage:    '',
    authorBio:      '',
    authorLink:     '',
    aboutStats:     '',
    sitemapEnabled: true,
    announcementsEnabled: false,
    membersEnabled: false,
    announcementsRemoved: false,
    membersRemoved: false,
    pages: (SITE_PAGES[(siteType || '').toLowerCase().trim()] ?? [{ slug: '/', label: 'Home' }]).map(p => ({
        pageSlug:        p.slug,
        pageLabel:       p.label,
        metaTitle:       '',
        metaDescription: '',
        robotsIndex:     true,
        robotsFollow:    true,
        canonicalUrl:    '',
        ogTitle:         '',
        ogDescription:   '',
        ogImage:         '',
    })),
});

type SiteEntry = { id?: number; key: string; name: string; type: string; locked?: boolean };

const DEFAULT_SITES: SiteEntry[] = [
    { key: 'portfolio', name: 'Portfolio', type: 'portfolio', locked: true },
    { key: 'blog', name: 'Blog', type: 'blog', locked: true },
];

const toSiteKey = (v: string) =>
    v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function Settings() {
    const [sites, setSites] = useState<SiteEntry[]>(DEFAULT_SITES);
    const [selectedSite, setSelectedSite] = useState<string>('portfolio');
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteType, setNewSiteType] = useState('');
    const [newPageLabel, setNewPageLabel] = useState('');
    const [newPageSlug, setNewPageSlug] = useState('');
    const [detected, setDetected] = useState<{ group: string; pages: { slug: string; label: string }[] }[]>([]);
    const [authorUploading, setAuthorUploading] = useState(false);
    const [iconUploading, setIconUploading] = useState(false);
    const [ogUploading, setOgUploading] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [addingSite, setAddingSite] = useState(false);
    const [settingId, setSettingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<SiteFormData>(defaultForm('portfolio'));
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeSection, setActiveSection] = useState<'sites' | 'info' | 'seo' | 'pages' | 'sitemap'>('info');

    // Admin-panel branding (global — logo image + brand text in the admin navbar).
    const [adminLogo, setAdminLogo] = useState('');
    const [adminBrand, setAdminBrand] = useState('');
    const [adminLogoUploading, setAdminLogoUploading] = useState(false);
    const [adminBrandingSaving, setAdminBrandingSaving] = useState(false);
    const [adminBrandingSaved, setAdminBrandingSaved] = useState(false);

    useEffect(() => {
        fetch('/api/admin-branding')
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (d) { setAdminLogo(d.adminLogo || ''); setAdminBrand(d.adminBrand || ''); } })
            .catch(() => { /* non-critical */ });
    }, []);

    const uploadAdminLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setAdminLogoUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('mode', 'cloud');
            const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.url) throw new Error(data?.error ?? `Upload failed (HTTP ${res.status})`);
            setAdminLogo(data.url);
        } catch (err) {
            alert((err as Error).message || 'Image upload failed.');
        } finally {
            setAdminLogoUploading(false);
        }
    };

    const saveAdminBranding = async () => {
        setAdminBrandingSaving(true);
        setAdminBrandingSaved(false);
        try {
            const res = await fetch('/api/admin-branding', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminLogo, adminBrand }),
            });
            if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
            setAdminBrandingSaved(true);
            setTimeout(() => setAdminBrandingSaved(false), 2500);
        } catch (err) {
            alert((err as Error).message || 'Save failed.');
        } finally {
            setAdminBrandingSaving(false);
        }
    };

    // Build the site list once: defaults + any sites already saved in the DB
    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.ok ? r.json() : [])
            .then((all: any[]) => {
                if (!Array.isArray(all)) return;
                setSites(prev => {
                    const map = new Map(prev.map(s => [s.key, { ...s }]));
                    for (const s of all) {
                        const key = String(s.siteKey);
                        const existing = map.get(key);
                        map.set(key, {
                            id: s.id,
                            key,
                            name: (s.siteName?.trim?.() || existing?.name || key),
                            type: (s.siteType || existing?.type || (key === 'portfolio' ? 'portfolio' : key === 'blog' ? 'blog' : 'custom')),
                            locked: existing?.locked,
                        });
                    }
                    return Array.from(map.values());
                });
            })
            .catch(() => {});
    }, []);

    const addSite = async () => {
        const name = newSiteName.trim();
        const key = toSiteKey(name);
        if (!name || !key) { alert('Enter a valid site name.'); return; }
        if (sites.some(s => s.key === key)) { setSelectedSite(key); setActiveSection('info'); setNewSiteName(''); return; }
        setAddingSite(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteKey: key, siteName: name, siteType: newSiteType }),
            });
            if (!res.ok) throw new Error('save failed');
            const data = await res.json();
            setSites(prev => [...prev, { id: data?.id, key, name, type: newSiteType }]);
            setNewSiteName('');
            setNewSiteType('');
            setSelectedSite(key);
            setActiveSection('info');
        } catch {
            alert('Failed to add site.');
        } finally {
            setAddingSite(false);
        }
    };

    const deleteSite = async (s: SiteEntry) => {
        if (s.locked) return;
        if (!confirm(`Remove site "${s.name}"? Its settings will be deleted.`)) return;
        try {
            if (s.id) await fetch(`/api/settings/${s.id}`, { method: 'DELETE' });
            setSites(prev => prev.filter(x => x.key !== s.key));
            if (selectedSite === s.key) setSelectedSite('portfolio');
        } catch {
            alert('Failed to remove site.');
        }
    };

    // Load settings for selected site
    useEffect(() => {
        setFormData(defaultForm(sites.find(s => s.key === selectedSite)?.type ?? (selectedSite === 'blog' ? 'blog' : selectedSite === 'portfolio' ? 'portfolio' : 'custom')));
        setSettingId(null);

        fetch('/api/settings')
            .then(r => r.ok ? r.json() : [])
            .then((all: any[]) => {
                const found = all.find(s => s.siteKey === selectedSite);
                if (found) {
                    setSettingId(found.id);
                    setFormData({
                        siteName:               found.siteName           ?? '',
                        tagline:                found.tagline            ?? '',
                        emailAddress:           found.emailAddress       ?? '',
                        websiteUrl:             found.websiteUrl         ?? '',
                        description:            found.description        ?? '',
                        notifyOnRegister:       found.notifyOnRegister   ?? true,
                        registrationEnabled:    found.registrationEnabled ?? true,
                        directMessageNotify:    found.directMessageNotify ?? false,
                        membershipApproval:     found.membershipApproval  ?? false,
                        hideViewCounts:         found.hideViewCounts      ?? false,
                        hidePostTags:           found.hidePostTags        ?? false,
                        defaultMetaTitle:       found.defaultMetaTitle       ?? '',
                        defaultMetaDescription: found.defaultMetaDescription ?? '',
                        titleSeparator:         found.titleSeparator         ?? '|',
                        defaultRobotsIndex:     found.defaultRobotsIndex     ?? true,
                        defaultRobotsFollow:    found.defaultRobotsFollow     ?? true,
                        ogImage:                found.ogImage                ?? '',
                        metaKeywords:           found.metaKeywords           ?? '',
                        twitterHandle:          found.twitterHandle          ?? '',
                        siteIcon:               found.siteIcon               ?? '',
                        themeColor:             found.themeColor             ?? '#5b4fcf',
                        authorEnabled:          found.authorEnabled          ?? true,
                        authorName:             found.authorName             ?? '',
                        authorImage:            found.authorImage            ?? '',
                        authorBio:              found.authorBio              ?? '',
                        authorLink:             found.authorLink             ?? '',
                        aboutStats:             found.aboutStats             ?? '',
                        sitemapEnabled:         found.sitemapEnabled         ?? true,
                        announcementsEnabled:   found.announcementsEnabled   ?? false,
                        membersEnabled:         found.membersEnabled         ?? false,
                        announcementsRemoved:   found.announcementsRemoved   ?? false,
                        membersRemoved:         found.membersRemoved         ?? false,
                        siteType:               found.siteType ?? (sites.find(s => s.key === selectedSite)?.type ?? ''),
                        pages: (() => {
                            const type = (found.siteType ?? '').toLowerCase().trim();
                            const saved = Array.isArray(found.pages) ? found.pages : [];
                            const savedByslug = new Map<string, any>(saved.map((pg: any) => [pg.pageSlug, pg]));

                            // Canonical pages that actually EXIST for this site type.
                            const canonical = SITE_PAGES[type] ?? [{ slug: '/', label: 'Home' }];
                            const canonicalSlugs = new Set(canonical.map(p => p.slug));

                            // Slugs that belong EXCLUSIVELY to a different site type
                            // (e.g. portfolio's /testimonials, /projects). Used to
                            // strip cross-site contamination from stale saved data
                            // so a blog never shows portfolio pages.
                            const foreignSlugs = new Set<string>();
                            for (const [t, list] of Object.entries(SITE_PAGES)) {
                                if (t === type) continue;
                                for (const p of list) if (!canonicalSlugs.has(p.slug)) foreignSlugs.add(p.slug);
                            }

                            // Real pages first, then any genuinely custom saved pages
                            // (neither canonical nor foreign — e.g. a user-added /pricing).
                            const basis = [
                                ...canonical,
                                ...saved
                                    .filter((pg: any) => !canonicalSlugs.has(pg.pageSlug) && !foreignSlugs.has(pg.pageSlug))
                                    .map((pg: any) => ({ slug: pg.pageSlug, label: pg.pageLabel })),
                            ];
                            return basis.map((p: any) => {
                                const existing = savedByslug.get(p.slug);
                                return {
                                    pageSlug:        p.slug,
                                    pageLabel:       p.label,
                                    metaTitle:       existing?.metaTitle       ?? '',
                                    metaDescription: existing?.metaDescription ?? '',
                                    robotsIndex:     existing?.robotsIndex     ?? true,
                                    robotsFollow:    existing?.robotsFollow     ?? true,
                                    canonicalUrl:    existing?.canonicalUrl    ?? '',
                                    ogTitle:         existing?.ogTitle         ?? '',
                                    ogDescription:   existing?.ogDescription   ?? '',
                                    ogImage:         existing?.ogImage         ?? '',
                                };
                            });
                        })(),
                    });
                }
            })
            .catch(err => console.error('Error loading settings:', err));
    }, [selectedSite]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;
        const { name, value, type } = target;
        const checked = target.checked;
        setFormData(prev => {
            const next: SiteFormData = {
                ...prev,
                [name]: type === 'checkbox' ? checked : value,
            } as SiteFormData;
            // Ticking "remove completely" also switches the matching "enable"
            // off. The API enforces this too, but doing it here keeps the form
            // honest: the box the user sees unticked is the value that gets saved.
            if (name === 'membersRemoved' && checked) next.membersEnabled = false;
            if (name === 'announcementsRemoved' && checked) next.announcementsEnabled = false;
            return next;
        });
    };

    const handlePageChange = (index: number, field: keyof PageSeoEntry, value: any) => {
        setFormData(prev => {
            const pages = [...prev.pages];
            pages[index] = { ...pages[index], [field]: value };
            return { ...prev, pages };
        });
    };

    // Site type is a free-text label — just store it (does not touch pages)
    const handleSiteTypeChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, siteType: e.target.value }));
    };

    // Add a custom page to the Per-Page SEO list
    const addPage = () => {
        const label = newPageLabel.trim();
        let slug = newPageSlug.trim();
        if (!slug && label) slug = '/' + toSiteKey(label);
        if (!slug) { alert('Enter a page path (e.g. /pricing).'); return; }
        if (!slug.startsWith('/')) slug = '/' + slug;
        if (formData.pages.some(p => p.pageSlug === slug)) { alert('That page already exists.'); return; }
        setFormData(prev => ({
            ...prev,
            pages: [...prev.pages, {
                pageSlug: slug, pageLabel: label || slug,
                metaTitle: '', metaDescription: '', robotsIndex: true, robotsFollow: true,
                canonicalUrl: '', ogTitle: '', ogDescription: '', ogImage: '',
            }],
        }));
        setNewPageLabel(''); setNewPageSlug('');
    };
    const removePage = (index: number) => {
        setFormData(prev => ({ ...prev, pages: prev.pages.filter((_, i) => i !== index) }));
    };

    // Scan the app/ folder for real page routes (per project / route group)
    const detectPages = async () => {
        setDetecting(true);
        try {
            const res = await fetch('/api/settings/detect-pages');
            const data = await res.json();
            setDetected(Array.isArray(data.groups) ? data.groups : []);
        } catch {
            alert('Failed to detect pages.');
        } finally {
            setDetecting(false);
        }
    };
    const importPages = (pages: { slug: string; label: string }[]) => {
        setFormData(prev => {
            const have = new Set(prev.pages.map(p => p.pageSlug));
            const additions = pages.filter(p => !have.has(p.slug)).map(p => ({
                pageSlug: p.slug, pageLabel: p.label, metaTitle: '', metaDescription: '',
                robotsIndex: true, robotsFollow: true, canonicalUrl: '', ogTitle: '', ogDescription: '', ogImage: '',
            }));
            return { ...prev, pages: [...prev.pages, ...additions] };
        });
    };

    // Upload the author-card image (reuses the shared /api/upload-image route
    // that the post editor uses). On success, store the returned URL.
    const uploadAuthorImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setAuthorUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('mode', 'cloud'); // Cloudinary if configured, else local
            const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.url) throw new Error(data?.error ?? `Upload failed (HTTP ${res.status})`);
            setFormData(prev => ({ ...prev, authorImage: data.url }));
        } catch (err) {
            alert((err as Error).message || 'Image upload failed.');
        } finally {
            setAuthorUploading(false);
        }
    };

    // Generic image uploader for a formData field (favicon, OG image, …).
    // Uploads via the shared /api/upload-image route (Cloudinary if configured,
    // else local) and stores the returned URL.
    const uploadingField = (field: 'siteIcon' | 'ogImage') => async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const setBusy = field === 'ogImage' ? setOgUploading : setIconUploading;
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('mode', 'cloud');
            const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.url) throw new Error(data?.error ?? `Upload failed (HTTP ${res.status})`);
            setFormData(prev => ({ ...prev, [field]: data.url }));
        } catch (err) {
            alert((err as Error).message || 'Image upload failed.');
        } finally {
            setBusy(false);
        }
    };

    // ── About-section stat boxes (stored as JSON in formData.aboutStats) ──────
    const DEFAULT_ABOUT_STATS = [
        { value: '∞', label: 'Tutorials' },
        { value: '100%', label: 'Free' },
        { value: '✦', label: 'Pro Workflows' },
    ];
    const aboutStatsArr: { value: string; label: string }[] = (() => {
        try {
            const a = JSON.parse(formData.aboutStats || '[]');
            return Array.isArray(a) && a.length ? a : DEFAULT_ABOUT_STATS;
        } catch { return DEFAULT_ABOUT_STATS; }
    })();
    const setAboutStats = (arr: { value: string; label: string }[]) =>
        setFormData((prev) => ({ ...prev, aboutStats: JSON.stringify(arr) }));

    const handleSubmit = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const payload = { ...formData, siteKey: selectedSite };

            if (settingId) {
                const res = await fetch(`/api/settings/${settingId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                // Surface server errors instead of silently showing "saved".
                if (!res.ok) {
                    const err = await res.json().catch(() => null);
                    throw new Error(err?.error ?? `Save failed (HTTP ${res.status})`);
                }
            } else {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => null);
                    throw new Error(err?.error ?? `Save failed (HTTP ${res.status})`);
                }
                const data = await res.json();
                if (data?.id) setSettingId(data.id);
            }
            // If a community feature is enabled, make sure its permissions exist
            // (idempotent — the seed only runs on a fresh DB).
            if (formData.membersEnabled || formData.announcementsEnabled) {
                await fetch('/api/admin/community/provision', { method: 'POST' }).catch(() => {});
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    // ── Live SEO health checklist (like the per-post SEO score) ──────────────
    const seoChecks = [
        { ok: !!formData.siteName.trim(), label: 'Site title is set' },
        { ok: /^https?:\/\//i.test(formData.websiteUrl.trim()), label: 'Website URL set (with https://)' },
        { ok: formData.defaultMetaTitle.trim().length >= 15 && formData.defaultMetaTitle.trim().length <= 60, label: 'Default meta title 15–60 chars' },
        { ok: formData.defaultMetaDescription.trim().length >= 50 && formData.defaultMetaDescription.trim().length <= 160, label: 'Default meta description 50–160 chars' },
        { ok: !!formData.metaKeywords.trim(), label: 'Meta keywords added' },
        { ok: !!formData.ogImage.trim(), label: 'Open Graph image set' },
        { ok: !!formData.siteIcon.trim(), label: 'Favicon / site icon set' },
        { ok: formData.sitemapEnabled, label: 'XML sitemap enabled' },
        { ok: formData.defaultRobotsIndex, label: 'Site is indexable (robots: index)' },
    ];
    const seoPassed = seoChecks.filter(c => c.ok).length;
    const seoScore  = Math.round((seoPassed / seoChecks.length) * 100);
    const seoColor  = seoScore >= 80 ? '#16a34a' : seoScore >= 50 ? '#d97706' : '#dc2626';
    const seoLabel  = seoScore >= 80 ? 'Good' : seoScore >= 50 ? 'Ok' : 'Low';

    const sectionBtnStyle = (active: boolean): React.CSSProperties => ({
        padding: '8px 16px',
        border: 'none',
        borderBottom: active ? '2px solid #0858f7' : '2px solid transparent',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        marginRight: '4px',
        // color handled by CSS class for dark mode compatibility
    });

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Settings"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Settings', path: '/admin/settings' },
                ]}
            />

            <div className="card shadow border-0 p-4 mt-1 infoInputs">

                <datalist id="site-type-list">
                    {SITE_TYPES.map(t => <option key={t.value} value={t.label} />)}
                </datalist>

                {/* ── Site Selector ── */}
                <Row className="mb-4">
                    <Col xs={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <label className="mc-label-field-title para" style={{ marginBottom: 0, fontWeight: 700, fontSize: '14px' }}>
                                Select Site:
                            </label>
                            <select
                                className="mc-label-field-select h-md"
                                value={selectedSite}
                                onChange={e => setSelectedSite(e.target.value)}
                                style={{ minWidth: '180px' }}
                            >
                                {sites.map(s => (
                                    <option key={s.key} value={s.key}>{s.name}</option>
                                ))}
                            </select>
                            <span style={{ fontSize: '12px', opacity: 0.5 }}>
                                {settingId ? `Editing saved settings (ID: ${settingId})` : 'No saved settings yet — will create on save'}
                            </span>
                        </div>
                    </Col>
                </Row>

                {/* ── SEO Health checklist ── */}
                <Row className="mb-4">
                    <Col xs={12}>
                        <div className="seo-health-card" style={{
                            display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
                            border: '1px solid #e7e9f1', borderRadius: 12, padding: '18px 22px',
                        }}>
                            <div style={{
                                width: 84, height: 84, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                border: `4px solid ${seoColor}`, color: seoColor,
                            }}>
                                <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{seoScore}</span>
                                <span style={{ fontSize: 11, fontWeight: 600 }}>{seoLabel}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 260 }}>
                                <h6 className="para" style={{ fontWeight: 700, margin: '0 0 10px' }}>
                                    SEO Health — {seoPassed}/{seoChecks.length} checks passed
                                </h6>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px 18px' }}>
                                    {seoChecks.map((c, i) => (
                                        <div key={i} className="para" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                            <span style={{ color: c.ok ? '#16a34a' : '#cbd5e1', fontWeight: 700 }}>
                                                {c.ok ? '✓' : '○'}
                                            </span>
                                            <span style={{ opacity: c.ok ? 1 : 0.65 }}>{c.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* ── Section Tabs ── */}
                <Row className="mb-4">
                    <Col xs={12}>
                        <div style={{ borderBottom: '1px solid #dee2e6', marginBottom: '24px' }}>
                            <button className={`settings-tab-btn${activeSection === 'sites' ? ' settings-tab-active' : ''}`} style={sectionBtnStyle(activeSection === 'sites')} onClick={() => setActiveSection('sites')}>Sites</button>
                            <button className={`settings-tab-btn${activeSection === 'info' ? ' settings-tab-active' : ''}`} style={sectionBtnStyle(activeSection === 'info')} onClick={() => setActiveSection('info')}>Informations</button>
                            <button className={`settings-tab-btn${activeSection === 'seo' ? ' settings-tab-active' : ''}`} style={sectionBtnStyle(activeSection === 'seo')} onClick={() => setActiveSection('seo')}>Global SEO</button>
                            <button className={`settings-tab-btn${activeSection === 'pages' ? ' settings-tab-active' : ''}`} style={sectionBtnStyle(activeSection === 'pages')} onClick={() => setActiveSection('pages')}>Per-Page SEO</button>
                            <button className={`settings-tab-btn${activeSection === 'sitemap' ? ' settings-tab-active' : ''}`} style={sectionBtnStyle(activeSection === 'sitemap')} onClick={() => setActiveSection('sitemap')}>Sitemap & OG</button>
                        </div>

                        {/* ── SITES ── */}
                        {activeSection === 'sites' && (
                            <Row>
                                <Col xs={12} lg={7}>
                                    {/* Admin-panel branding (global) — logo + brand text in the admin navbar */}
                                    <div className="mc-bordered-box" style={{ border: '1px solid #e7e9f1', borderRadius: 10, padding: 16, marginBottom: 22 }}>
                                        <div className="mc-label-field-title para" style={{ fontWeight: 700, marginBottom: 4 }}>Admin panel logo</div>
                                        <p className="para" style={{ fontSize: 12.5, opacity: 0.7, marginBottom: 12 }}>Shown in the top-left of the admin panel (and its mobile menu). Applies everywhere — it&apos;s not per-site.</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(91,79,207,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                                {adminLogo
                                                    ? <img src={adminLogo} alt="Admin logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                    : <span style={{ fontSize: 11, opacity: 0.5 }}>Logo</span>}
                                            </div>
                                            <label className="mc-ghost-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 8, border: '1px solid #d4d9e6', background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                                                {adminLogoUploading ? 'Uploading…' : (adminLogo ? 'Change logo' : 'Upload logo')}
                                                <input type="file" accept="image/*" onChange={uploadAdminLogo} disabled={adminLogoUploading} style={{ display: 'none' }} />
                                            </label>
                                            {adminLogo && (
                                                <button type="button" className="mc-danger-btn" onClick={() => setAdminLogo('')}
                                                    style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Remove</button>
                                            )}
                                        </div>
                                        <div style={{ marginTop: 14 }}>
                                            <label className="mc-label-field-title para" style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>Brand text</label>
                                            <input type="text" value={adminBrand} onChange={e => setAdminBrand(e.target.value)}
                                                placeholder="e.g. Umair" className="mc-label-field-input h-md" style={{ maxWidth: 300 }} />
                                        </div>
                                        <div style={{ marginTop: 14 }}>
                                            <button type="button" onClick={saveAdminBranding} disabled={adminBrandingSaving}
                                                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0858f7', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', opacity: adminBrandingSaving ? 0.7 : 1 }}>
                                                {adminBrandingSaving ? 'Saving…' : adminBrandingSaved ? '✓ Saved' : 'Save admin logo'}
                                            </button>
                                        </div>
                                    </div>

                                    <p className="para">Add the sites you manage. Every site you add here shows up in the <b>Select Site</b> dropdown above, each with its own Information, SEO and per-page settings.</p>

                                    <div className="mc-label-field-title para" style={{ fontWeight: 700, marginBottom: 6 }}>Add a new site</div>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                                        <input
                                            type="text"
                                            value={newSiteName}
                                            onChange={e => setNewSiteName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') addSite(); }}
                                            placeholder="e.g. YouTube Downloader"
                                            className="mc-label-field-input h-md"
                                            style={{ maxWidth: 300 }}
                                        />
                                        <input
                                            type="text"
                                            value={newSiteType}
                                            onChange={e => setNewSiteType(e.target.value)}
                                            list="site-type-list"
                                            placeholder="Type (e.g. Blog)"
                                            className="mc-label-field-input h-md"
                                            style={{ maxWidth: 220 }}
                                            title="Site type (free text)"
                                        />
                                        <button
                                            onClick={addSite}
                                            disabled={addingSite || !newSiteName.trim()}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                padding: '9px 18px', borderRadius: 8, border: 'none',
                                                background: (addingSite || !newSiteName.trim()) ? '#c7d2fe' : '#4f46e5',
                                                color: '#fff', fontWeight: 600, fontSize: 14,
                                                cursor: (addingSite || !newSiteName.trim()) ? 'not-allowed' : 'pointer',
                                                transition: 'background .15s',
                                            }}
                                        >
                                            {addingSite ? 'Adding…' : '+ Add Site'}
                                        </button>
                                    </div>
                                    {newSiteName.trim() && (
                                        <p className="para" style={{ fontSize: 12, opacity: 0.6, marginBottom: 22 }}>
                                            Site key: <code>{toSiteKey(newSiteName)}</code>
                                        </p>
                                    )}

                                    <div className="mc-label-field-title para" style={{ fontWeight: 700, margin: '14px 0 8px' }}>Your sites</div>
                                    <div className="mc-bordered-box" style={{ border: '1px solid #e7e9f1', borderRadius: 10, overflow: 'hidden' }}>
                                        {sites.map((s, i) => {
                                            const typeLabel = (s.type && s.type.trim()) ? s.type : 'Custom';
                                            return (
                                            <div key={s.key} className="para mc-bordered-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderTop: i === 0 ? 'none' : '1px solid #eef0f5' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</span>
                                                    <span className="mc-type-badge" style={{ fontSize: 11, fontWeight: 600, color: '#4f46e5', background: '#eef2ff', border: '1px solid #e0e7ff', borderRadius: 999, padding: '2px 10px' }}>{typeLabel}</span>
                                                    <code style={{ fontSize: 12, opacity: 0.55 }}>{s.key}</code>
                                                    {s.locked && <span style={{ fontSize: 11, opacity: 0.45 }}>built-in</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                                    <button
                                                        className="mc-ghost-btn"
                                                        onClick={() => { setSelectedSite(s.key); setActiveSection('info'); }}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 8, border: '1px solid #d4d9e6', background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
                                                    >✎ Edit</button>
                                                    {!s.locked && (
                                                        <button
                                                            className="mc-danger-btn"
                                                            onClick={() => deleteSite(s)}
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
                                                        >🗑 Remove</button>
                                                    )}
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </Col>
                            </Row>
                        )}

                        {/* ── INFORMATIONS ── */}
                        {activeSection === 'info' && (
                            <Row>
                                <Col xl={4}>
                                    <div className="userParagraph para">
                                        <p>Basic information about your <b>{selectedSite}</b> site. This data is used across settings and SEO defaults.</p>
                                    </div>
                                </Col>
                                <Col xl={8}>
                                    <Row>
                                        <Col xl={6}>
                                            <div className="mc-label-field-group label-col">
                                                <label className="mc-label-field-title para">Site Type</label>
                                                <input type="text" name="siteType" value={formData.siteType} onChange={handleSiteTypeChange}
                                                    list="site-type-list" placeholder="e.g. Blog, Portfolio, YouTube Downloader"
                                                    className="mc-label-field-input mb-4 w-100 h-md" />
                                            </div>
                                        </Col>
                                        <Col xl={6}>
                                            <div className="mc-label-field-group label-col" style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                                                <p className="para" style={{ fontSize: 12, opacity: 0.6, marginBottom: 22 }}>A free-text label for this project (e.g. "Blog", "YouTube Downloader"). Use <b>Detect pages</b> under Per-Page SEO to pull its routes.</p>
                                            </div>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col xl={6}>
                                            <div className="mc-label-field-group label-col">
                                                <label className="mc-label-field-title para">Site Title</label>
                                                <input type="text" name="siteName" value={formData.siteName} onChange={handleChange}
                                                    placeholder="e.g. Umair Portfolio" className="mc-label-field-input mb-4 w-100 h-md" />
                                            </div>
                                        </Col>
                                        <Col xl={6}>
                                            <div className="mc-label-field-group label-col">
                                                <label className="mc-label-field-title para">Tagline</label>
                                                <input type="text" name="tagline" value={formData.tagline} onChange={handleChange}
                                                    placeholder="e.g. Creative Developer" className="mc-label-field-input mb-4 w-100 h-md" />
                                            </div>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col xl={6}>
                                            <div className="mc-label-field-group label-col para">
                                                <label className="mc-label-field-title para">Email Address</label>
                                                <input type="text" name="emailAddress" value={formData.emailAddress} onChange={handleChange}
                                                    placeholder="contact@yoursite.com" className="mc-label-field-input mb-4 w-100 h-md" />
                                            </div>
                                        </Col>
                                        <Col xl={6}>
                                            <div className="mc-label-field-group label-col">
                                                <label className="mc-label-field-title para">Website URL</label>
                                                <input type="text" name="websiteUrl" value={formData.websiteUrl} onChange={handleChange}
                                                    placeholder="https://yoursite.com" className="mc-label-field-input mb-4 w-100 h-md" />
                                            </div>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col xs={12}>
                                            <div className="mc-label-field-group label-col">
                                                <label className="mc-label-field-title para">Description</label>
                                                <textarea className="mc-label-field-textarea mb-4 w-100 h-text-md" name="description"
                                                    value={formData.description} onChange={handleChange} placeholder="Site description..." />
                                            </div>
                                        </Col>
                                    </Row>

                                    {/* Accessibility */}
                                    <h6 className="mc-divide-title mb-3 para">Accessibility</h6>
                                    <div className="ps-xl-2">
                                        {([
                                            { name: 'notifyOnRegister',    label: 'Send notification on each user registration', id: 'cb1' },
                                            { name: 'registrationEnabled', label: 'All registration is enabled on this site',      id: 'cb2' },
                                            { name: 'directMessageNotify', label: "You're sent a direct message",                  id: 'cb3' },
                                            { name: 'membershipApproval',  label: 'New membership approval',                       id: 'cb4' },
                                            // What a VISITOR sees. An administrator always sees the real
                                            // values, so neither of these ever hides anything from you.
                                            { name: 'hideViewCounts', id: 'cb9',
                                              label: 'Hide view counts from everyone except administrators',
                                              hint: 'A public "1 views" under every post tells each genuine reader that nobody reads the site. The real figures stay here in the admin panel.' },
                                            { name: 'hidePostTags', id: 'cb10',
                                              label: 'Hide post tags from everyone except administrators',
                                              hint: 'Only the small tag chips on cards and under a post. The category filter pills and the sidebar are built from categories, not tags, so navigation is unaffected.' },
                                            { name: 'membersEnabled',      label: 'Enable the public Members directory (/members)', id: 'cb5',
                                              disabledBy: 'membersRemoved' },
                                            { name: 'announcementsEnabled', label: 'Enable Announcements (post updates members can like & comment)', id: 'cb6',
                                              disabledBy: 'announcementsRemoved' },
                                            // The permanent switches. Kept below the "enable" pair and
                                            // labelled with the consequence, because a 404 drops the URL
                                            // from Google and cannot be undone by simply ticking it back.
                                            { name: 'membersRemoved', id: 'cb7',
                                              label: 'Remove /members completely — the page returns 404 (permanent; leave off to only hide it)',
                                              hint: 'With this off and "Enable Members" off, the page stays reachable but is noindex, out of the menu and out of the sitemap.' },
                                            { name: 'announcementsRemoved', id: 'cb8',
                                              label: 'Remove /announcements completely — the page returns 404 (permanent; leave off to only hide it)',
                                              hint: 'With this off and "Enable Announcements" off, the page stays reachable but is noindex, out of the menu and out of the sitemap.' },
                                        ] as { name: string; label: string; id: string; disabledBy?: string; hint?: string }[]).map(item => {
                                            const lockedOff = !!item.disabledBy && !!formData[item.disabledBy as keyof SiteFormData];
                                            return (
                                                <div key={item.id} className="mb-3 form-check">
                                                    <input type="checkbox" id={item.id} name={item.name}
                                                        checked={lockedOff ? false : (formData[item.name as keyof SiteFormData] as boolean)}
                                                        disabled={lockedOff}
                                                        onChange={handleChange} className="form-check-input" />
                                                    <label htmlFor={item.id}
                                                        className="form-check-label para"
                                                        style={lockedOff ? { opacity: 0.5 } : undefined}>
                                                        {item.label}
                                                    </label>
                                                    {lockedOff && (
                                                        <div className="para" style={{ fontSize: '0.82rem', opacity: 0.7, marginTop: 2 }}>
                                                            Locked — the section is set to return 404 below.
                                                        </div>
                                                    )}
                                                    {item.hint && (
                                                        <div className="para" style={{ fontSize: '0.82rem', opacity: 0.7, marginTop: 2 }}>
                                                            {item.hint}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Col>
                            </Row>
                        )}

                        {/* ── GLOBAL SEO ── */}
                        {activeSection === 'seo' && (
                            <Row>
                                <Col xl={4}>
                                    <div className="userParagraph para">
                                        <p>Global SEO defaults for <b>{selectedSite}</b>. These apply site-wide unless overridden per page.</p>
                                    </div>
                                </Col>
                                <Col xl={8}>
                                    <div className="mc-label-field-group label-col mb-3">
                                        <label className="mc-label-field-title para">Default Meta Title</label>
                                        <input type="text" name="defaultMetaTitle" value={formData.defaultMetaTitle} onChange={handleChange}
                                            placeholder="e.g. Umair Ali | Creative Developer"
                                            className="mc-label-field-input mb-2 w-100 h-md" />
                                        <small className="para" style={{ fontSize: '11px', opacity: 0.6 }}>
                                            Used when no page-specific meta title is set
                                        </small>
                                    </div>

                                    <div className="mc-label-field-group label-col mb-3">
                                        <label className="mc-label-field-title para">Default Meta Description</label>
                                        <textarea className="mc-label-field-textarea mb-2 w-100 h-text-md" name="defaultMetaDescription"
                                            value={formData.defaultMetaDescription} onChange={handleChange}
                                            placeholder="Default site description for search engines..." />
                                    </div>

                                    <div className="mc-label-field-group label-col mb-4">
                                        <label className="mc-label-field-title para">Title Separator</label>
                                        <select name="titleSeparator" value={formData.titleSeparator} onChange={handleChange}
                                            className="mc-label-field-select mb-2 w-100 h-md">
                                            <option value="|">| (Pipe)</option>
                                            <option value="-">- (Dash)</option>
                                            <option value="–">– (En dash)</option>
                                            <option value="•">• (Bullet)</option>
                                            <option value="»">» (Arrow)</option>
                                        </select>
                                        <small className="para" style={{ fontSize: '11px', opacity: 0.6 }}>
                                            e.g. Page Title {formData.titleSeparator} {formData.siteName || 'Site Name'}
                                        </small>
                                    </div>

                                    <div className="mc-label-field-group label-col mb-3">
                                        <label className="mc-label-field-title para">Meta Keywords</label>
                                        <input type="text" name="metaKeywords" value={formData.metaKeywords} onChange={handleChange}
                                            placeholder="blog, tech, travel, science (comma separated)"
                                            className="mc-label-field-input mb-2 w-100 h-md" />
                                        <small className="para" style={{ fontSize: '11px', opacity: 0.6 }}>
                                            Comma-separated keywords for the site
                                        </small>
                                    </div>

                                    <div className="mc-label-field-group label-col mb-4">
                                        <label className="mc-label-field-title para">Twitter / X Handle</label>
                                        <input type="text" name="twitterHandle" value={formData.twitterHandle} onChange={handleChange}
                                            placeholder="@yourhandle"
                                            className="mc-label-field-input mb-2 w-100 h-md" />
                                    </div>

                                    {/* Default Robots */}
                                    <div className="mb-3">
                                        <label className="mc-label-field-title para mb-2" style={{ display: 'block' }}>
                                            Default Robots (site-wide)
                                        </label>
                                        <div style={{ display: 'flex', gap: '24px', marginBottom: '8px' }}>
                                            <div className="form-check">
                                                <input type="checkbox" id="defIndex" name="defaultRobotsIndex"
                                                    checked={formData.defaultRobotsIndex} onChange={handleChange} className="form-check-input" />
                                                <label htmlFor="defIndex" className="form-check-label para"><b>Index</b> by default</label>
                                            </div>
                                            <div className="form-check">
                                                <input type="checkbox" id="defFollow" name="defaultRobotsFollow"
                                                    checked={formData.defaultRobotsFollow} onChange={handleChange} className="form-check-input" />
                                                <label htmlFor="defFollow" className="form-check-label para"><b>Follow</b> links by default</label>
                                            </div>
                                        </div>
                                        <div style={{ fontFamily: 'monospace', fontSize: '12px', padding: '8px 12px', borderRadius: '4px', background: 'var(--seo-panel-header-bg, #f8f9fa)', color: 'inherit' }}>
                                            {`<meta name="robots" content="${formData.defaultRobotsIndex ? 'index' : 'noindex'}, ${formData.defaultRobotsFollow ? 'follow' : 'nofollow'}">`}
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        )}

                        {/* ── PER-PAGE SEO ── */}
                        {activeSection === 'pages' && (
                            <div>
                                <p className="para mb-3" style={{ opacity: 0.6, fontSize: '13px' }}>
                                    Set individual SEO settings for each page of your <b>{selectedSite}</b> site.
                                    These override the global defaults above. Add your own pages below.
                                </p>

                                {/* Add a custom page */}
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 22, padding: '14px 16px', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
                                    <input type="text" value={newPageLabel} onChange={e => setNewPageLabel(e.target.value)}
                                        placeholder="Page name (e.g. Pricing)" className="mc-label-field-input h-md" style={{ maxWidth: 240 }} />
                                    <input type="text" value={newPageSlug} onChange={e => setNewPageSlug(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') addPage(); }}
                                        placeholder="/pricing" className="mc-label-field-input h-md" style={{ maxWidth: 200 }} />
                                    <button onClick={addPage} disabled={!newPageLabel.trim() && !newPageSlug.trim()}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none',
                                            background: (!newPageLabel.trim() && !newPageSlug.trim()) ? '#c7d2fe' : '#4f46e5', color: '#fff', fontWeight: 600, fontSize: 14,
                                            cursor: (!newPageLabel.trim() && !newPageSlug.trim()) ? 'not-allowed' : 'pointer' }}>
                                        + Add Page
                                    </button>
                                </div>

                                {/* Auto-detect a project's pages from the app/ folder */}
                                <div style={{ marginBottom: 22 }}>
                                    <button onClick={detectPages} disabled={detecting}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5', fontWeight: 600, fontSize: 13, cursor: detecting ? 'wait' : 'pointer' }}>
                                        {detecting ? 'Scanning…' : '🔍 Detect pages from app'}
                                    </button>
                                    {detected.length > 0 && (
                                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {detected.map(g => (
                                                <div key={g.group} style={{ border: '1px solid #e7e9f1', borderRadius: 10, padding: '10px 14px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <code style={{ fontSize: 12, color: '#4f46e5' }}>{g.group}</code>
                                                            <span className="para" style={{ fontSize: 12, opacity: 0.6 }}>{g.pages.length} pages</span>
                                                        </div>
                                                        <button onClick={() => importPages(g.pages)}
                                                            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                                                            Import all
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {g.pages.map(pg => (
                                                            <code key={pg.slug} className="para" style={{ fontSize: 11, background: '#f8fafc', border: '1px solid #eef0f5', borderRadius: 6, padding: '2px 8px' }}>{pg.slug}</code>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {formData.pages.length === 0 && (
                                    <p className="para" style={{ opacity: 0.55, fontSize: 13, marginBottom: 20 }}>No pages yet — add one above.</p>
                                )}
                                {formData.pages.map((page, index) => (
                                    <div key={page.pageSlug} className="card shadow border-0 p-3 mb-3">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: 12 }}>
                                            <h6 className="hd" style={{ margin: 0 }}>{page.pageLabel}</h6>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <code className='settings-slug-code' style={{ fontSize: '12px' }}>{page.pageSlug}</code>
                                                <button onClick={() => removePage(index)} title="Remove this page"
                                                    style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', lineHeight: 1, fontSize: 14, flexShrink: 0 }}>✕</button>
                                            </div>
                                        </div>
                                        <Row>
                                            <Col xs={12} md={6}>
                                                <div className="mc-label-field-group label-col mb-3">
                                                    <label className="mc-label-field-title para">Meta Title</label>
                                                    <input type="text" value={page.metaTitle}
                                                        onChange={e => handlePageChange(index, 'metaTitle', e.target.value)}
                                                        placeholder="Page meta title..."
                                                        className="mc-label-field-input w-100 h-md" />
                                                </div>
                                            </Col>
                                            <Col xs={12} md={6}>
                                                <div className="mc-label-field-group label-col mb-3">
                                                    <label className="mc-label-field-title para">Canonical URL</label>
                                                    <input type="url" value={page.canonicalUrl}
                                                        onChange={e => handlePageChange(index, 'canonicalUrl', e.target.value)}
                                                        placeholder={`${formData.websiteUrl || 'https://yoursite.com'}${page.pageSlug}`}
                                                        className="mc-label-field-input w-100 h-md" />
                                                </div>
                                            </Col>
                                        </Row>
                                        <div className="mc-label-field-group label-col mb-3">
                                            <label className="mc-label-field-title para">Meta Description</label>
                                            <textarea value={page.metaDescription}
                                                onChange={e => handlePageChange(index, 'metaDescription', e.target.value)}
                                                placeholder="Page meta description (70-160 chars)..."
                                                className="mc-label-field-textarea w-100" style={{ height: '70px' }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                            <div className="form-check">
                                                <input type="checkbox" id={`idx-${index}`} checked={page.robotsIndex}
                                                    onChange={e => handlePageChange(index, 'robotsIndex', e.target.checked)}
                                                    className="form-check-input" />
                                                <label htmlFor={`idx-${index}`} className="form-check-label para"><b>Index</b> this page</label>
                                            </div>
                                            <div className="form-check">
                                                <input type="checkbox" id={`flw-${index}`} checked={page.robotsFollow}
                                                    onChange={e => handlePageChange(index, 'robotsFollow', e.target.checked)}
                                                    className="form-check-input" />
                                                <label htmlFor={`flw-${index}`} className="form-check-label para"><b>Follow</b> links</label>
                                            </div>
                                            <code className='settings-robots-code' style={{ fontSize: '11px', marginLeft: 'auto' }}>
                                                {`robots: ${page.robotsIndex ? 'index' : 'noindex'}, ${page.robotsFollow ? 'follow' : 'nofollow'}`}
                                            </code>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── SITEMAP & OG ── */}
                        {activeSection === 'sitemap' && (
                            <Row>
                                <Col xl={4}>
                                    <div className="userParagraph para">
                                        <p>Sitemap and Open Graph global settings for <b>{selectedSite}</b>.</p>
                                    </div>
                                </Col>
                                <Col xl={8}>
                                    {/* Branding — favicon / site icon + theme colour */}
                                    <div className="mc-label-field-group label-col mb-4">
                                        <label className="mc-label-field-title para">Site Icon (Favicon)</label>
                                        <input type="url" name="siteIcon" value={formData.siteIcon} onChange={handleChange}
                                            placeholder="/favicon.png or upload below"
                                            className="mc-label-field-input mb-2 w-100 h-md" />
                                        <label style={{ cursor: 'pointer', padding: '7px 14px', borderRadius: 8, background: '#5b4fcf', color: '#fff', fontSize: 13, fontWeight: 600, width: 'fit-content', display: 'inline-block', marginBottom: 6 }}>
                                            {iconUploading ? 'Uploading…' : '⬆ Upload favicon'}
                                            <input type="file" accept="image/*" onChange={uploadingField('siteIcon')} disabled={iconUploading} style={{ display: 'none' }} />
                                        </label>
                                        <small className="para" style={{ fontSize: '11px', opacity: 0.6, display: 'block' }}>
                                            Square PNG/SVG/ICO recommended (e.g. 512×512). Paste a URL or upload — goes to Cloudinary if set, else local.
                                        </small>
                                        {formData.siteIcon && (
                                            <img src={formData.siteIcon} alt="Favicon preview"
                                                style={{ width: 48, height: 48, marginTop: 10, borderRadius: 8, display: 'block', objectFit: 'contain', background: '#f1f3f9', padding: 4 }}
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        )}
                                    </div>

                                    <div className="mc-label-field-group label-col mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label className="mc-label-field-title para">Theme Colour</label>
                                        <input type="color" name="themeColor" value={formData.themeColor} onChange={handleChange}
                                            style={{ width: 60, height: 38, border: 'none', background: 'transparent', cursor: 'pointer' }} />
                                        <small className="para" style={{ fontSize: '11px', opacity: 0.6 }}>
                                            Browser address-bar colour on mobile (PWA theme-color).
                                        </small>
                                    </div>

                                    {/* ── AUTHOR / BRAND CARD (blog sidebar) ── */}
                                    <div className="mb-4" style={{ borderTop: '1px solid #e5e7f0', paddingTop: 18 }}>
                                        <div className="form-check mb-3">
                                            <input type="checkbox" id="authorEnabled" name="authorEnabled"
                                                checked={formData.authorEnabled} onChange={handleChange} className="form-check-input" />
                                            <label htmlFor="authorEnabled" className="form-check-label para" style={{ fontWeight: 600 }}>
                                                Show the author / brand card in the sidebar
                                            </label>
                                        </div>

                                        <div className="mc-label-field-group label-col mb-3">
                                            <label className="mc-label-field-title para">Card Image</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: '#eef0f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 24, color: '#5b4fcf' }}>
                                                    {formData.authorImage
                                                        ? <img src={formData.authorImage} alt="Author" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                        : (formData.authorName || formData.siteName || 'A').charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    <label className="mc-btn-secondary" style={{ cursor: 'pointer', padding: '7px 14px', borderRadius: 8, background: '#5b4fcf', color: '#fff', fontSize: 13, fontWeight: 600, width: 'fit-content' }}>
                                                        {authorUploading ? 'Uploading…' : 'Upload image'}
                                                        <input type="file" accept="image/*" onChange={uploadAuthorImage} disabled={authorUploading} style={{ display: 'none' }} />
                                                    </label>
                                                    {formData.authorImage && (
                                                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, authorImage: '' }))}
                                                            style={{ background: 'none', border: 'none', color: '#e11', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                                                            Remove image
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <small className="para" style={{ fontSize: '11px', opacity: 0.6, marginTop: 6 }}>
                                                Square image recommended. If empty, the first letter of the name is shown.
                                            </small>
                                        </div>

                                        <div className="mc-label-field-group label-col mb-3">
                                            <label className="mc-label-field-title para">Card Name</label>
                                            <input type="text" name="authorName" value={formData.authorName} onChange={handleChange}
                                                placeholder="e.g. Flow"
                                                className="mc-label-field-input mb-1 w-100 h-md" />
                                        </div>

                                        <div className="mc-label-field-group label-col mb-3">
                                            <label className="mc-label-field-title para">Card Description</label>
                                            <textarea name="authorBio" value={formData.authorBio} onChange={handleChange}
                                                placeholder="e.g. Turning curiosity into tutorials and stories about code & tech."
                                                rows={3} className="mc-label-field-input w-100" />
                                        </div>

                                        <div className="mc-label-field-group label-col mb-2">
                                            <label className="mc-label-field-title para">Card Link (optional)</label>
                                            <input type="text" name="authorLink" value={formData.authorLink} onChange={handleChange}
                                                placeholder="/about  or  https://youtube.com/@yourchannel"
                                                className="mc-label-field-input w-100 h-md" />
                                            <small className="para" style={{ fontSize: '11px', opacity: 0.6 }}>
                                                Where the whole card links when clicked. Leave empty for no link. External links open in a new tab.
                                            </small>
                                        </div>
                                    </div>

                                    {/* ── HOMEPAGE "ABOUT" STAT BOXES ── */}
                                    <div className="mb-4" style={{ borderTop: '1px solid #e5e7f0', paddingTop: 18 }}>
                                        <label className="mc-label-field-title para mb-1" style={{ display: 'block', fontWeight: 600 }}>
                                            Homepage “About” Stats
                                        </label>
                                        <small className="para" style={{ fontSize: '11px', opacity: 0.6, display: 'block', marginBottom: 12 }}>
                                            The small stat boxes in the homepage About section (e.g. ∞ Tutorials). Value can be a number, %, or emoji.
                                        </small>
                                        {aboutStatsArr.map((st, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                                <input type="text" value={st.value}
                                                    onChange={(e) => { const a = aboutStatsArr.map((x, k) => k === i ? { ...x, value: e.target.value } : x); setAboutStats(a); }}
                                                    placeholder="∞" className="mc-label-field-input h-md" style={{ maxWidth: 110 }} />
                                                <input type="text" value={st.label}
                                                    onChange={(e) => { const a = aboutStatsArr.map((x, k) => k === i ? { ...x, label: e.target.value } : x); setAboutStats(a); }}
                                                    placeholder="Tutorials" className="mc-label-field-input h-md w-100" />
                                                <button type="button" className="mc-danger-btn" onClick={() => setAboutStats(aboutStatsArr.filter((_, k) => k !== i))}
                                                    style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => setAboutStats([...aboutStatsArr, { value: '', label: '' }])}
                                            style={{ padding: '6px 14px', borderRadius: 8, background: '#eef0f8', border: '1px solid #d6dae8', fontSize: 13, cursor: 'pointer', color: '#5b4fcf', fontWeight: 600 }}>
                                            + Add stat
                                        </button>
                                    </div>

                                    <div className="mb-4">
                                        <label className="mc-label-field-title para mb-3" style={{ display: 'block' }}>Sitemap</label>
                                        <div className="form-check mb-2">
                                            <input type="checkbox" id="sitemapEnabled" name="sitemapEnabled"
                                                checked={formData.sitemapEnabled} onChange={handleChange} className="form-check-input" />
                                            <label htmlFor="sitemapEnabled" className="form-check-label para">
                                                Enable XML sitemap for this site
                                            </label>
                                        </div>
                                        {formData.sitemapEnabled && formData.websiteUrl && (
                                            <div className='para' style={{ marginTop: '8px', fontSize: '13px' }}>
                                                Sitemap URL: <code style={{ fontSize: '12px' }}>{formData.websiteUrl}/sitemap.xml</code>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mc-label-field-group label-col mb-3">
                                        <label className="mc-label-field-title para">Global OG Image URL</label>
                                        <input type="url" name="ogImage" value={formData.ogImage} onChange={handleChange}
                                            placeholder="https://…/og-image.png (1200×630) or upload below"
                                            className="mc-label-field-input mb-2 w-100 h-md" />
                                        <label style={{ cursor: 'pointer', padding: '7px 14px', borderRadius: 8, background: '#5b4fcf', color: '#fff', fontSize: 13, fontWeight: 600, width: 'fit-content', display: 'inline-block', marginBottom: 6 }}>
                                            {ogUploading ? 'Uploading…' : '⬆ Upload OG image'}
                                            <input type="file" accept="image/*" onChange={uploadingField('ogImage')} disabled={ogUploading} style={{ display: 'none' }} />
                                        </label>
                                        <small className="para" style={{ fontSize: '11px', opacity: 0.6, display: 'block' }}>
                                            1200×630 recommended. Fallback OG image when a page has none. Paste a URL or upload (Cloudinary if set, else local).
                                        </small>
                                        {formData.ogImage && (
                                            <img src={formData.ogImage} alt="OG preview"
                                                style={{ width: '100%', maxWidth: '400px', marginTop: '10px', borderRadius: '6px', display: 'block' }}
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        )}
                                    </div>
                                </Col>
                            </Row>
                        )}
                    </Col>
                </Row>

                {/* ── Save Button (inside the card) ── */}
                <Row>
                    <Col xs={12} style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: 8 }}>
                        <button
                            type="button"
                            className="settings-save-btn"
                            onClick={handleSubmit}
                            disabled={saving}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                background: '#0057ff',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '12px 20px',
                                fontSize: 15,
                                fontWeight: 600,
                                textTransform: 'none',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.6 : 1,
                                boxShadow: '0 6px 16px rgba(0,87,255,0.28)',
                            }}
                        >
                            <i className="bi bi-patch-check-fill" aria-hidden="true" style={{ color: '#fff' }} />
                            {saving ? 'Saving...' : 'Save All Changes'}
                        </button>
                        {/* Always render this span so the button is never
                            `:only-child` — otherwise a broad table-button rule
                            (admin.css) overrides the button's styles. */}
                        <span style={{ color: '#27ae60', fontSize: '13px', fontWeight: 600 }}>
                            {saved ? '✓ Saved successfully!' : ''}
                        </span>
                    </Col>
                </Row>

            </div>
        </Container>
    );
}

export default Settings;
