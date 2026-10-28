/**
 * app/api/categories/route.ts
 *
 * GET  /api/categories  -> list all categories (with post count)
 * POST /api/categories  -> create a new category
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, userId } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
    try {
        const categories = await prisma.category.findMany({
            include: { _count: { select: { posts: true } } },
            orderBy: { name: 'asc' },
        });

        const mapped = categories.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            emoji: c.emoji,
            postCount: c._count.posts,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        }));

        return NextResponse.json(mapped);
    } catch (error) {
        console.error('[GET /api/categories]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const auth = await requirePermission('create-categories');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const name: string = (body.name ?? '').trim();
        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 422 });
        }

        const slug = body.slug?.trim() ? toSlug(body.slug) : toSlug(name);
        const description: string | null = body.description?.trim() || null;

        // The emoji is shown on the home page chips, the /tag hero, the sidebar
        // and every post thumbnail — but there was no way to set it, so every
        // category was stuck on the schema default. Capped at 8 characters:
        // enough for a flag or a skin-toned emoji (which are several code
        // points), short enough that nobody can paste a sentence into it.
        const emoji: string | undefined =
            typeof body.emoji === 'string' && body.emoji.trim()
                ? [...body.emoji.trim()].slice(0, 8).join('')
                : undefined;

        const category = await prisma.category.create({
            data: { name, slug, description, ...(emoji ? { emoji } : {}) },
        });

        await recordEvent({
            type: 'category.create',
            action: `${(auth.session.user as any)?.name ?? 'Someone'} created a category`,
            description: `"${category.name}"`,
            link: '/admin/myprojects/blog/categories',
            actorUserId: userId(auth.session),
            notify: 'admins',
        });

        return NextResponse.json(category, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/categories]', error);
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'A category with this slug already exists.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
