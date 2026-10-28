/**
 * prisma/seed-rbac-perms.ts
 *
 * Targeted, idempotent seed that ONLY:
 *   1. creates the new RBAC "view/manage" permissions (for tabs that had none),
 *   2. assigns each to the Administrator role (its pool) AND directly to the
 *      admin user (umairali2562@gmail.com) — because effective permissions in
 *      this app are the user's DIRECT assignments (see lib/auth.ts).
 *
 * It does NOT touch other roles/users, and does NOT re-run the full seed (which
 * would duplicate testimonials/navbar). Safe to run repeatedly.
 *
 * Run:  npx ts-node prisma/seed-rbac-perms.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return { host: u.hostname || 'localhost', port: u.port ? parseInt(u.port, 10) : 3306,
        user: u.username || 'root', password: u.password || '', database: u.pathname.slice(1) || 'api' };
    } catch {}
  }
  return { host: 'localhost', port: 3306, user: 'root', password: '', database: 'api' };
};

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(getDbConfig()) });

const ADMIN_EMAIL = 'umairali2562@gmail.com';
const NEW_PERMS = [
  'View Pages',
  'View YouTube Channels',
  'Manage Footer',
  'Manage YT Downloader',
  'View Orders',
  'View Messages',
  'View Notifications',
];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  const adminRole = await prisma.role.findFirst({ where: { slug: 'administrator' } });
  if (!admin) throw new Error(`Admin user ${ADMIN_EMAIL} not found — run the main seed first.`);

  let created = 0, grantedUser = 0, grantedRole = 0;

  for (const name of NEW_PERMS) {
    const slug = slugify(name);
    let perm = await prisma.permission.findFirst({ where: { slug } });
    if (!perm) { perm = await prisma.permission.create({ data: { name, slug } }); created++; }

    // Direct grant to the admin USER (this is what actually grants access).
    const hasUser = await prisma.userPermission.findUnique({
      where: { userId_permissionId: { userId: admin.id, permissionId: perm.id } },
    });
    if (!hasUser) { await prisma.userPermission.create({ data: { userId: admin.id, permissionId: perm.id } }); grantedUser++; }

    // Add to the Administrator role's pool too (so it's grantable to others).
    if (adminRole) {
      const hasRole = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      });
      if (!hasRole) { await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: perm.id } }); grantedRole++; }
    }
  }

  console.log(`✓ RBAC perms — created: ${created}, granted to admin user: ${grantedUser}, added to Administrator role: ${grantedRole}`);
  console.log('  ↳ Log out & back in (or refresh) so your session picks up the new permissions.');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
