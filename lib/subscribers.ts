/**
 * lib/subscribers.ts
 * Notifies all subscribers when a post is published — via email (nodemailer,
 * reusing lib/delivery) and browser push (web-push + VAPID). Both are optional:
 * missing SMTP or VAPID env just skips that channel.
 */
import { prisma } from '@/lib/prisma';
import { deliverEmail } from '@/lib/delivery';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

type PostLite = { title: string; slug: string; excerpt?: string | null };

export async function notifySubscribers(post: PostLite): Promise<void> {
    const subs = await prisma.subscriber.findMany();
    if (subs.length === 0) return;
    // Category-siloed URL: /<primaryCategory.slug>/<slug> (fallback first category).
    let categorySlug = 'uncategorized';
    try {
        const p = await prisma.post.findUnique({
            where: { slug: post.slug },
            select: {
                primaryCategory: { select: { slug: true } },
                categories: { take: 1, select: { category: { select: { slug: true } } } },
            },
        });
        categorySlug = (p as any)?.primaryCategory?.slug || (p as any)?.categories?.[0]?.category?.slug || 'uncategorized';
    } catch { /* keep fallback */ }
    const url = `${SITE_URL}/${categorySlug}/${post.slug}`;
    const excerpt = post.excerpt ?? '';

    // ── Email ──────────────────────────────────────────────
    const emailSubs = subs.filter(s => s.wantsEmail && s.email);
    await Promise.all(emailSubs.map(s => deliverEmail(
        s.email,
        `New post: ${post.title}`,
        `We just published "${post.title}".\n\n${excerpt}\n\nRead it: ${url}`,
        `<h2 style="margin:0 0 8px">${post.title}</h2><p style="color:#555">${excerpt}</p><p><a href="${url}" style="display:inline-block;background:#5b4fcf;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Read the post →</a></p>`,
    ).catch(() => { /* per-recipient failure shouldn't block others */ })));

    // ── Browser push ───────────────────────────────────────
    const pushSubs = subs.filter(s => s.wantsPush && s.pushEndpoint && s.pushKeys);
    if (pushSubs.length > 0 && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        try {
            const webpush = (await import('web-push' as any)).default;
            webpush.setVapidDetails(
                process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
                process.env.VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY,
            );
            const payload = JSON.stringify({ title: post.title, body: excerpt || 'New post published', url });
            await Promise.all(pushSubs.map(async (s) => {
                try {
                    await webpush.sendNotification(
                        { endpoint: s.pushEndpoint as string, keys: JSON.parse(s.pushKeys as string) },
                        payload,
                    );
                } catch (err: any) {
                    // 404/410 → subscription is dead; clear it so we stop trying
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                        await prisma.subscriber.update({ where: { id: s.id }, data: { pushEndpoint: null, pushKeys: null } }).catch(() => {});
                    }
                }
            }));
        } catch (err) {
            console.error('[notifySubscribers] push error:', err);
        }
    }
}
