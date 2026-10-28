/**
 * app/api/permissions/route.ts
 *
 * GET  /api/permissions  -> list all permissions (requires 'view-permissions')
 * POST /api/permissions  -> create new permission(s) (requires 'create-permissions')
 *
 * SECURITY: previously unauthenticated — this is the most sensitive route
 * in the whole panel (it defines the permission catalog itself), and it
 * had zero protection. Now gated like everything else.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

// GET /api/permissions — list all permissions
export async function GET() {
    const auth = await requirePermission('view-permissions');
    if (auth.error) return auth.error;

    try {
        const permissions = await prisma.permission.findMany({
            orderBy: { id: 'asc' },
        });
        return NextResponse.json(permissions);
    } catch (error) {
        console.error('GET /api/permissions error:', error);
        return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
    }
}

// POST /api/permissions — create new permission(s)
export async function POST(req: NextRequest) {
    const auth = await requirePermission('create-permissions');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const { permissions } = body; // array of permission name strings

        if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
            return NextResponse.json({ error: 'No permissions provided' }, { status: 400 });
        }

        const generateSlug = (name: string) =>
            name.toLowerCase().replace(/[^\w\s]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/-$/, '').trim();

        const created = await Promise.all(
            permissions.map((name: string) =>
                prisma.permission.create({
                    data: {
                        name,
                        slug: generateSlug(name),
                    },
                })
            )
        );

        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        console.error('POST /api/permissions error:', error);
        return NextResponse.json({ error: 'Failed to create permissions' }, { status: 500 });
    }
}
