/**
 * POST /api/admin/community/provision   [manage-settings]
 *
 * One-time (idempotent) provisioning for the community features. The seed only
 * runs on a fresh DB, so on an existing live database the new permissions won't
 * exist yet. Hitting this once creates them and wires the default role grants:
 *   - view-members         → all roles (so members are visible by default;
 *                            remove it from a role/user to block them)
 *   - manage-announcements → staff roles (administrator/manager/editor)
 * It also makes sure the current admin holds both directly.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, userId } from '@/lib/rbac';

const PERMS = [
    { name: 'View Members', slug: 'view-members', roles: ['administrator', 'manager', 'editor', 'viewer', 'guest'] },
    { name: 'Manage Announcements', slug: 'manage-announcements', roles: ['administrator', 'manager', 'editor'] },
    { name: 'Oversee Messages', slug: 'oversee-messages', roles: ['administrator', 'manager'] },
];

export async function POST() {
    const auth = await requirePermission('manage-settings');
    if (auth.error) return auth.error;
    const me = userId(auth.session);

    const summary: Record<string, string> = {};
    for (const p of PERMS) {
        let perm = await prisma.permission.findFirst({ where: { slug: p.slug } });
        if (!perm) perm = await prisma.permission.create({ data: { name: p.name, slug: p.slug } });

        // Grant to the listed roles.
        for (const roleSlug of p.roles) {
            const role = await prisma.role.findFirst({ where: { slug: roleSlug } });
            if (!role) continue;
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
                create: { roleId: role.id, permissionId: perm.id },
                update: {},
            });
        }
        // Grant directly to the current admin so it works immediately.
        await prisma.userPermission.upsert({
            where: { userId_permissionId: { userId: me, permissionId: perm.id } },
            create: { userId: me, permissionId: perm.id },
            update: {},
        });
        summary[p.slug] = 'ready';
    }

    return NextResponse.json({ ok: true, provisioned: summary });
}
