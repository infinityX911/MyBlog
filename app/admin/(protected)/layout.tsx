import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSiteSetting } from '@/lib/siteSettings';
import { AdminProvider } from '@/context/AdminContext';
import { MessagingProvider } from '@/context/MessagingContext';
import FloatingChats from '@/components/messaging/FloatingChats';
import SupportAlerts from '@/components/admin/SupportAlerts';
import Toaster from '@/components/admin/Toaster';
import AdminShell from '@/components/admin/AdminShell';
import SessionProviderWrapper from '@/components/admin/SessionProviderWrapper';

import React from 'react';

// Use the SAME site icon as the public blog so the admin browser tab matches
// the rest of the site (favicon comes from Settings → Branding → Site Icon).
export async function generateMetadata(): Promise<Metadata> {
    const s = await getSiteSetting('blog').catch(() => null);
    const favicon = s?.siteIcon || '/favicon.ico';
    return {
        title: 'Admin Panel',
        description: 'Portfolio Admin Dashboard',
        icons: { icon: favicon, shortcut: favicon, apple: favicon },
    };
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Get session server-side to pass user info to context
    // NO redirect here — proxy.ts handles auth protection
    // Having redirect in BOTH causes infinite redirect loop on logout
    const session = await getServerSession(authOptions);

    return (
        <SessionProviderWrapper session={session}>
            <AdminProvider user={session?.user}>
                <MessagingProvider>
                    <AdminShell>
                        {children}
                    </AdminShell>
                    <FloatingChats />
                    <SupportAlerts />
                    <Toaster />
                </MessagingProvider>
            </AdminProvider>
        </SessionProviderWrapper>
    );
}
