/**
 * app/api/user/profile/route.ts
 *
 * GET   /api/user/profile  → own profile + roles, permissions, status, stats
 * PATCH /api/user/profile  → update own account (self-service)
 *
 * Editable by the user (self-service, no permission needed):
 *   name, username, phone, bio, location(address), avatarUrl,
 *   social links (facebook/twitter/linkedin/instagram/youtube/pinterest),
 *   email settings, password (requires current password).
 *
 * READ-ONLY here (admin-controlled — never settable from this endpoint):
 *   role, status. This guarantees a user cannot escalate privileges or
 *   self-approve their account.
 *
 * Every successful update is written to the Activity log and broadcast to
 * the admin notification feed via recordEvent().
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth, userId } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';

function clean(value: string): string {
    return value.replace(/<[^>]*>/g, '').trim();
}

// Validate optional social/profile URLs (empty allowed → clears the field).
function validUrl(value: string): boolean {
    if (value === '') return true;
    if (value.length > 255) return false;
    return /^https?:\/\/.+/i.test(value);
}

const PROFILE_SELECT = {
    id: true, name: true, username: true, email: true, avatarUrl: true,
    gender: true, phone: true, bio: true, location: true, status: true,
    facebook: true, twitter: true, linkedin: true, instagram: true,
    youtube: true, pinterest: true,
    emailActivityConnection: true, emailActivityMessage: true,
    emailProductConnection: true, emailProductMessage: true,
    createdAt: true,
} as const;

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const me = userId(auth.session);

    try {
        const user = await prisma.user.findUnique({
            where:  { id: me },
            select: {
                ...PROFILE_SELECT,
                roles: {
                    select: {
                        role: {
                            select: {
                                name: true, slug: true,
                                permissions: {
                                    select: { permission: { select: { name: true, slug: true } } },
                                },
                            },
                        },
                    },
                },
                permissions: {
                    select: { permission: { select: { name: true, slug: true } } },
                },
            },
        });

        if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

        const roles = user.roles.map((ur) => ({ name: ur.role.name, slug: ur.role.slug }));

        // The permissions this user has actually been GRANTED.
        //
        // A role is a POOL: it decides what MAY be ticked for someone holding
        // it. The ticked subset is what they hold, and it is what lib/auth.ts
        // puts in the session and lib/rbac.ts checks on every request.
        //
        // This used to fold the whole role pool in as well, so the account page
        // listed capabilities the person did not have and could not use — two
        // Managers with different grants were shown an identical list.
        const permMap = new Map<string, { name: string; slug: string }>();
        for (const up of user.permissions) permMap.set(up.permission.slug, up.permission);
        const permissions = [...permMap.values()].sort((a, b) => a.name.localeCompare(b.name));

        const [postCount, commentCount] = await Promise.all([
            prisma.post.count({ where: { authorId: me } }),
            prisma.comment.count({ where: { userId: me } }),
        ]);

        const { roles: _r, permissions: _p, ...base } = user;
        void _r; void _p;

        return NextResponse.json({
            user: base,
            roles,
            permissions,
            stats: {
                posts: postCount,
                comments: commentCount,
                roles: roles.length,
                permissions: permissions.length,
            },
        });
    } catch (err) {
        console.error('[GET /api/user/profile]', err);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const me = userId(auth.session);

    try {
        const body = await req.json();
        const update: Record<string, unknown> = {};
        const changed: string[] = [];

        // ── name ─────────────────────────────────────────────
        if (body.name !== undefined) {
            const name = clean(String(body.name));
            if (!name || name.length < 2 || name.length > 80) {
                return NextResponse.json({ error: 'Name must be between 2 and 80 characters.' }, { status: 422 });
            }
            update.name = name; changed.push('name');
        }

        // ── username ─────────────────────────────────────────
        if (body.username !== undefined) {
            let username = clean(String(body.username)).replace(/^@+/, '');
            if (username === '') {
                update.username = null; changed.push('username');
            } else {
                if (!/^[a-zA-Z0-9_.]{3,50}$/.test(username)) {
                    return NextResponse.json(
                        { error: 'Username must be 3–50 chars: letters, numbers, dot or underscore.' },
                        { status: 422 }
                    );
                }
                update.username = username; changed.push('username');
            }
        }

        // ── phone ─────────────────────────────────────────────
        if (body.phone !== undefined) {
            const phone = clean(String(body.phone));
            if (phone === '') { update.phone = null; }
            else if (!/^[0-9+\-()\s]{5,20}$/.test(phone)) {
                return NextResponse.json({ error: 'Please enter a valid phone number (5–20 digits).' }, { status: 422 });
            } else { update.phone = phone; }
            changed.push('phone');
        }

        // ── bio ───────────────────────────────────────────────
        if (body.bio !== undefined) {
            const bio = clean(String(body.bio));
            if (bio.length > 500) {
                return NextResponse.json({ error: 'Bio must be 500 characters or fewer.' }, { status: 422 });
            }
            update.bio = bio === '' ? null : bio; changed.push('bio');
        }

        // ── location / address ────────────────────────────────
        if (body.location !== undefined || body.address !== undefined) {
            const raw = body.location !== undefined ? body.location : body.address;
            const location = clean(String(raw ?? ''));
            if (location.length > 160) {
                return NextResponse.json({ error: 'Address must be 160 characters or fewer.' }, { status: 422 });
            }
            update.location = location === '' ? null : location; changed.push('address');
        }

        // ── social links ──────────────────────────────────────
        const socialFields = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'pinterest'] as const;
        for (const f of socialFields) {
            if (body[f] !== undefined) {
                const url = String(body[f]).trim();
                if (!validUrl(url)) {
                    return NextResponse.json({ error: `${f} must be a valid http(s) URL.` }, { status: 422 });
                }
                update[f] = url === '' ? null : url; changed.push(f);
            }
        }

        // ── email settings ────────────────────────────────────
        const boolFields = [
            'emailActivityConnection', 'emailActivityMessage',
            'emailProductConnection', 'emailProductMessage',
        ] as const;
        for (const f of boolFields) {
            if (body[f] !== undefined) { update[f] = Boolean(body[f]); changed.push('settings'); }
        }

        // ── avatarUrl ─────────────────────────────────────────
        if (body.avatarUrl !== undefined) {
            const url = String(body.avatarUrl).trim();
            if (url !== '') {
                if (!url.startsWith('/') && !url.startsWith('https://')) {
                    return NextResponse.json({ error: 'Avatar URL must start with / or https://.' }, { status: 422 });
                }
                if (url.length > 500) {
                    return NextResponse.json({ error: 'Avatar URL is too long.' }, { status: 422 });
                }
                update.avatarUrl = url;
            } else { update.avatarUrl = null; }
            changed.push('avatar');
        }

        // ── password (requires current password) ──────────────
        if (body.password !== undefined && body.password !== '') {
            const pw = String(body.password);
            if (pw.length < 8 || pw.length > 200) {
                return NextResponse.json({ error: 'Password must be between 8 and 200 characters.' }, { status: 422 });
            }
            const current = String(body.currentPassword ?? '');
            if (!current) {
                return NextResponse.json({ error: 'Please enter your current password.' }, { status: 422 });
            }
            const dbUser = await prisma.user.findUnique({ where: { id: me }, select: { password: true } });
            const ok = dbUser ? await bcrypt.compare(current, dbUser.password) : false;
            if (!ok) {
                return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 403 });
            }
            update.password = await bcrypt.hash(pw, 12);
            changed.push('password');
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'Nothing to update.' }, { status: 422 });
        }

        const user = await prisma.user.update({
            where:  { id: me },
            data:   update,
            select: PROFILE_SELECT,
        });

        // ── Audit + notify admins (one call) ──────────────────
        const uniqueChanged = [...new Set(changed)];
        const passwordChanged = uniqueChanged.includes('password');
        await recordEvent({
            type: passwordChanged ? 'profile.password' : 'profile.update',
            action: passwordChanged
                ? `${user.name} changed their password`
                : `${user.name} updated their profile`,
            description: passwordChanged ? undefined : `Updated: ${uniqueChanged.join(', ')}`,
            link: '/admin/account',
            actorUserId: me,
            notify: 'admins',
        });

        return NextResponse.json({ success: true, user });
    } catch (err: any) {
        if (err?.code === 'P2002') {
            return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
        }
        console.error('[PATCH /api/user/profile]', err);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}
