// app/(blog)/login/layout.tsx
import type { Metadata } from 'next';

// page.tsx here is a 'use client' component (it needs useState/signIn),
// so it can't export `metadata` itself — Next.js only reads `metadata`
// from server components. This segment layout is the standard way to
// attach metadata to a client-component page.
//
// SEO: a login form has no content value and shouldn't be indexed.
export const metadata: Metadata = {
    title: 'Log in',
    robots: {
        index: false,
        follow: false,
    },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
