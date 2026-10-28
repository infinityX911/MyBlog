/**
 * app/admin/(protected)/support/page.tsx
 *
 * Support now lives inside the unified Messages inbox (grid icon → "Support
 * Chats"). This route just redirects there, preserving any ?c=<id> deep link
 * from older support notifications.
 */

import { redirect } from 'next/navigation';

export default async function SupportRedirect({
    searchParams,
}: {
    searchParams: Promise<{ c?: string }>;
}) {
    const { c } = await searchParams;
    redirect(c ? `/admin/messages?c=${c}` : '/admin/messages');
}
