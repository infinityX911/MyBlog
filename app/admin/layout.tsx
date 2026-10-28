// app/admin/layout.tsx
import './css/admin.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import React from 'react';
import type { Metadata } from 'next';

// SEO: nothing under /admin/* has public/indexable value, and indexing it
// would also leak the existence of the admin login URL to search engines.
// This applies to every page under this layout — login, dashboard, every
// admin/(protected) route — since metadata cascades down unless a child
// route overrides it.
export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
        nocache: true,
    },
};

export default function AdminRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning={true}>
            <body>
                {children}
            </body>
        </html>
    );
}
