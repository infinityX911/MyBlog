/**
 * app/api/search/route.ts
 *
 * GET /api/search?q=...  → global search over published content.
 *
 * Posts, pages and downloads are public: they are published material and the
 * select lists carry nothing that is not already on the page.
 *
 * PEOPLE ARE NOT. Member results are returned only to a signed-in caller.
 * Anonymous callers used to be able to enumerate accounts by name a letter at
 * a time - guessing "a", "b", "c" walks out the whole member list, together
 * with each person's real name, username and avatar. Rate limiting does not
 * help: 60 requests a minute is far more than an alphabet needs. The navbar
 * search still links to profiles for anyone logged in; a logged-out visitor
 * simply gets an empty list, and the response shape is unchanged so no client
 * needs to care.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    if (q.length < 2) {
        return NextResponse.json({ posts: [], users: [] });
    }

    const rl = rateLimit(`search:${getClientIp(req.headers)}`, 60, 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json({ posts: [], users: [], error: 'Too many searches.' }, { status: 429 });
    }

    /* Decides whether people are searchable at all for this caller. A failure
       here is treated as "not signed in", never as "allowed". */
    let signedIn = false;
    try {
        signedIn = !!(await getServerSession(authOptions))?.user;
    } catch {
        signedIn = false;
    }

    try {
        const [posts, users, pages, downloads] = await Promise.all([
            prisma.post.findMany({
                where: { status: 'published', title: { contains: q } },
                orderBy: { publishedAt: 'desc' },
                take: 5,
                select: {
                    id: true, title: true, slug: true,
                    primaryCategory: { select: { slug: true } },
                    categories: { take: 1, select: { category: { select: { slug: true } } } },
                },
            }),
            signedIn
                ? prisma.user.findMany({
                    where: {
                        status: { not: 'blocked' },
                        OR: [{ name: { contains: q } }, { username: { contains: q } }],
                    },
                    take: 5,
                    select: { id: true, name: true, username: true, avatarUrl: true },
                })
                : Promise.resolve([]),
            prisma.cmsPage.findMany({
                where: { siteKey: 'blog', status: 'published', title: { contains: q } },
                take: 5,
                select: { id: true, title: true, slug: true },
            }),
            prisma.download.findMany({
                where: { status: 'published', title: { contains: q } },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, title: true, slug: true },
            }).catch(() => [] as any),
        ]);

        // Flatten each post's category-siloed URL segment for the clients.
        const postsOut = posts.map((p: any) => ({
            id: p.id, title: p.title, slug: p.slug,
            category: p.primaryCategory?.slug || p.categories?.[0]?.category?.slug || 'uncategorized',
        }));

        return NextResponse.json({ posts: postsOut, users, pages, downloads });
    } catch (error) {
        console.error('[GET /api/search]', error);
        return NextResponse.json({ posts: [], users: [], pages: [], downloads: [], error: 'Search failed.' }, { status: 500 });
    }
}
