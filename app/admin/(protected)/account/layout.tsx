// app/admin/(protected)/account/layout.tsx
import type { Metadata } from 'next';
import '@/app/admin/css/account.css';

export const metadata: Metadata = {
    title: 'My Account',
    robots: {
        index: false,
        follow: false,
        nocache: true,
    },
};

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
