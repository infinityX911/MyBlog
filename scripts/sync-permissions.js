/**
 * scripts/sync-permissions.js
 *
 * Makes sure every permission the application CODE checks for actually exists
 * as a row in the database. Runs from docker-entrypoint.sh on every boot, right
 * after `prisma db push`.
 *
 * WHY THIS EXISTS: the real seed (prisma/seed.ts) is TypeScript and runs
 * through ts-node, which is a dev dependency — the production image installs
 * with `npm ci --omit=dev`, so `prisma db seed` fails there with
 * "spawn ts-node ENOENT". That is correct for the seed, which also creates demo
 * content and should never run against a live site. But it left a gap: adding a
 * new permission in code shipped a check for a row that did not exist, so the
 * permission could not be granted from the admin panel and the feature stayed
 * unreachable.
 *
 * This script is deliberately narrow. It ONLY creates missing permission rows.
 * It never deletes one, never touches role or user assignments, and never
 * changes anything that already exists — who gets a permission stays entirely
 * the admin's decision, made in the UI.
 *
 * ES MODULE SYNTAX, not CommonJS: package.json sets "type": "module", so a
 * `.js` file here is an ES module and `require` does not exist in it.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Permissions the code enforces. Adding a `requirePermission('x')` anywhere?
 * Add the matching entry here too, or the grant will be impossible to make.
 * Slugs follow the same rule as seed.ts: lowercase, non-alphanumerics to dashes.
 */
const REQUIRED = [
    // Media library (Management → Media)
    { name: 'View Media', slug: 'view-media' },
    { name: 'Upload Media', slug: 'upload-media' },
    { name: 'Delete Media', slug: 'delete-media' },

    // Using the downloader tool itself, at /yt.
    //
    // Named "Use Downloader Tool", not "Use YT Downloader": the admin tab for
    // this feature is "Manage YT Downloader", and those two titles sat a glance
    // apart in the same corner of the permissions list. The first person to use
    // it granted the wrong one — a naming problem, not a user error. The slug
    // matches what seed.ts would derive from this name, and what
    // lib/yt/allowlist.ts checks.
    { name: 'Use Downloader Tool', slug: 'use-downloader-tool' },
];

const prisma = new PrismaClient();

try {
    let created = 0;

    for (const { name, slug } of REQUIRED) {
        const existing = await prisma.permission.findFirst({ where: { slug } });
        if (existing) continue;
        await prisma.permission.create({ data: { name, slug } });
        created++;
        console.log(`[permissions] created "${name}" (${slug})`);
    }

    console.log(
        created === 0
            ? '[permissions] all present — nothing to do.'
            : `[permissions] added ${created}.`,
    );
} catch (err) {
    // A missing permission must not stop the site from booting: the app still
    // works, the feature simply cannot be granted until this succeeds.
    console.error('[permissions] sync failed (continuing anyway):', err?.message ?? err);
} finally {
    await prisma.$disconnect();
}
