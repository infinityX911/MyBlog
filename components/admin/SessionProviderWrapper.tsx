'use client';

/**
 * SessionProviderWrapper.tsx
 *
 * Why this file exists:
 * next-auth's <SessionProvider> is a Client Component (it uses React context).
 * But layout.tsx is a Server Component.
 * You cannot import a Client Component directly into a Server Component
 * and pass it a prop that comes from a server-side call (getServerSession).
 *
 * Solution: wrap SessionProvider in its own 'use client' file,
 * accept `session` as a prop, and use it here.
 * layout.tsx passes the server-fetched session down as a prop.
 */

import { SessionProvider } from 'next-auth/react';
import { Session } from 'next-auth';

export default function SessionProviderWrapper({
    children,
    session,
}: {
    children: React.ReactNode;
    session: Session | null;
}) {
    return (
        <SessionProvider session={session}>
            {children}
        </SessionProvider>
    );
}
