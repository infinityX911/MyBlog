// app/(blog)/signup/layout.tsx
import type { Metadata } from 'next';

// Same reasoning as app/(blog)/login/layout.tsx — page.tsx is a client
// component and can't export metadata itself, and a signup form has no
// SEO value of its own.
export const metadata: Metadata = {
    title: 'Sign up',
    robots: {
        index: false,
        follow: false,
    },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
