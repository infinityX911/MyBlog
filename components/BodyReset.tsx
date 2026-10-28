'use client';

/**
 * BodyReset.tsx
 * 
 * Removes admin body classes (dark/light) when the portfolio loads.
 * This runs on the client whenever the portfolio layout mounts,
 * cleaning up any classes left by the admin panel.
 */

import { useEffect } from 'react';

export default function BodyReset() {
    useEffect(() => {
        document.body.classList.remove('dark');
        document.body.classList.remove('light');
    }, []);

    return null; // renders nothing
}
