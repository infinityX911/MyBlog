/**
 * app/api/categories/[id]/route.ts
 *
 * GET    /api/categories/[id]  -> fetch single category (public)
 * PATCH  /api/categories/[id]  -> update category (requires 'update-categories')
 * DELETE /api/categories/[id]  -> delete category (requires 'delete-categories')
 *
 * Next.js 16: params is a Promise — must be awaited
 *
 * SECURITY: PATCH/DELETE were previously unauthenticated — anyone could rename
 * or delete categories. Now permission-gated. (GET stays public: category
 * name/slug are already shown on the public blog.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

type Params = { params: Promise<{ id: string }> };

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const category = await prisma.category.findUnique({
            where: { id },
            include: { _count: { select: { posts: true } } },
        });
        if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        return NextResponse.json({
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            // Without this the edit form loads a blank emoji, falls back to the
            // default, and SAVES that back — quietly wiping whatever the
            // category actually had. A field the editor can write but not read
            // is worse than no field at all.
            emoji: category.emoji,
            postCount: category._count.posts,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
        });
    } catch (error) {
        console.error('[GET /api/categories/:id]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
    const auth = await requirePermission('update-categories');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const body = await req.json();
        const name: string = (body.name ?? '').trim();
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 422 });

        const slug = body.slug?.trim() ? toSlug(body.slug) : toSlug(name);
        const description: string | null = body.description?.trim() || null;

        // Same rule as create. Left untouched when the field is absent, so a
        // client that only sends name/slug does not silently wipe the emoji.
        const emoji: string | undefined =
            typeof body.emoji === 'string' && body.emoji.trim()
                ? [...body.emoji.trim()].slice(0, 8).join('')
                : undefined;

        const category = await prisma.category.update({
            where: { id },
            data: { name, slug, description, ...(emoji ? { emoji } : {}) },
        });

        return NextResponse.json(category);
    } catch (error: any) {
        console.error('[PATCH /api/categories/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (error?.code === 'P2002') return NextResponse.json({ error: 'A category with this slug already exists.' }, { status: 409 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('delete-categories');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        await prisma.category.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[DELETE /api/categories/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
