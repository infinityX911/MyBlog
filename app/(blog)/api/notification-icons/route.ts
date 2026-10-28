/**
 * app/(blog)/api/notification-icons/route.ts
 *
 * GET   /api/notification-icons  → current type → {icon,color} map
 *                                  (DB rows merged over built-in defaults)
 * PUT   /api/notification-icons  → upsert one or many mappings
 *                                  (requires 'manage-notifications')
 *
 * The icon strings are validated against ICON_REGISTRY so a bad value can
 * never be stored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requirePermission } from '@/lib/rbac';
import { DEFAULT_ICON_CONFIG, ICON_REGISTRY } from '@/lib/notificationVisuals';

// Friendly labels for the known types (used when seeding the UI list).
const TYPE_LABELS: Record<string, string> = {
    comment: 'New comment',
    'comment.create': 'New comment (audit)',
    comment_reply: 'Comment reply',
    contact: 'Contact message',
    register: 'New registration',
    'user.register': 'New registration',
    'user.update': 'User updated',
    'user.status': 'User status changed',
    'auth.login': 'User logged in',
    'profile.update': 'Profile updated',
    'profile.password': 'Password changed',
    'post.create': 'Post created',
    'post.update': 'Post updated',
    'post.delete': 'Post deleted',
};

export async function GET() {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    try {
        const rows = await prisma.notificationIcon.findMany({ orderBy: { label: 'asc' } });
        const dbMap = new Map(rows.map((r) => [r.typeKey, r]));

        // Merge: every known type, DB value wins over the default.
        const types = new Set([...Object.keys(DEFAULT_ICON_CONFIG), ...dbMap.keys()]);
        const items = [...types].map((typeKey) => {
            const db = dbMap.get(typeKey);
            const def = DEFAULT_ICON_CONFIG[typeKey];
            return {
                typeKey,
                label: db?.label ?? TYPE_LABELS[typeKey] ?? typeKey,
                icon: db?.icon ?? def?.icon ?? 'bell',
                color: db?.color ?? def?.color ?? 'rgba(100,100,100,0.9)',
                customised: !!db,
            };
        }).sort((a, b) => a.label.localeCompare(b.label));

        return NextResponse.json({ items });
    } catch (err) {
        console.error('[GET /api/notification-icons]', err);
        return NextResponse.json({ error: 'Could not load notification icons.' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const auth = await requirePermission('manage-notifications');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const items: any[] = Array.isArray(body.items) ? body.items : [body];

        for (const it of items) {
            const typeKey = String(it.typeKey ?? '').trim();
            const icon = String(it.icon ?? '').trim();
            const color = String(it.color ?? '').trim();
            const label = String(it.label ?? typeKey).trim().slice(0, 120);

            if (!typeKey) continue;
            if (!ICON_REGISTRY[icon]) {
                return NextResponse.json({ error: `Unknown icon "${icon}".` }, { status: 422 });
            }
            if (!color || color.length > 40) {
                return NextResponse.json({ error: 'Invalid colour value.' }, { status: 422 });
            }

            await prisma.notificationIcon.upsert({
                where: { typeKey },
                create: { typeKey, label, icon, color },
                update: { label, icon, color },
            });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/notification-icons]', err);
        return NextResponse.json({ error: 'Could not save notification icons.' }, { status: 500 });
    }
}
