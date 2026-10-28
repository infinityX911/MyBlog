/**
 * prisma/seed-navbar.ts
 * Imports the blog's current (hardcoded) navbar into nav_items so the home
 * page keeps the same links — now fully editable from Admin → Blog → Navbar.
 * Idempotent: clears existing 'blog' nav items first. Run: npx ts-node prisma/seed-navbar.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    try { const u = new URL(process.env.DATABASE_URL);
      return { host: u.hostname||'localhost', port: u.port?parseInt(u.port,10):3306, user: u.username||'root', password: u.password||'', database: u.pathname.slice(1)||'' };
    } catch {}
  }
  return { host: process.env.DB_HOST||process.env.DATABASE_HOST||'localhost', port: Number(process.env.DB_PORT||process.env.DATABASE_PORT)||3306,
    user: process.env.DB_USER||process.env.DATABASE_USER||'root', password: process.env.DB_PASSWORD||process.env.DATABASE_PASSWORD||'', database: process.env.DB_NAME||process.env.DATABASE_NAME||'api' };
};
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(getDbConfig()) });

const NAV = [
  { label: 'Home', url: '/', children: [] as { label: string; url: string; icon?: string }[] },
  { label: 'Tutorials', url: '#', children: [
    { label: 'Tech', url: '/tag/tech', icon: '💻' },
    { label: 'Life', url: '/tag/life', icon: '🌿' },
    { label: 'Travel', url: '/tag/travel', icon: '✈️' },
    { label: 'Opinion', url: '/tag/opinion', icon: '💬' },
    { label: 'Science', url: '/tag/science', icon: '🔬' },
  ] },
  { label: 'Start Learning', url: '#', children: [
    { label: 'All Posts', url: '/#posts', icon: '📰' },
    { label: 'Tech', url: '/tag/tech', icon: '💻' },
    { label: 'Science', url: '/tag/science', icon: '🔬' },
    { label: 'Life', url: '/tag/life', icon: '🌿' },
  ] },
  { label: 'Trending', url: '/#posts', children: [] },
  { label: 'Downloads', url: '/downloads', children: [] },
  { label: 'Contact Us', url: '/#about', children: [] },
];

async function main() {
  await prisma.navItem.deleteMany({ where: { siteKey: 'blog' } });
  let order = 0;
  for (const top of NAV) {
    const parent = await prisma.navItem.create({
      data: { siteKey: 'blog', label: top.label, url: top.url, sortOrder: order++, visible: true },
    });
    let cOrder = 0;
    for (const c of top.children) {
      await prisma.navItem.create({
        data: { siteKey: 'blog', label: c.label, url: c.url, icon: c.icon ?? null, parentId: parent.id, sortOrder: cOrder++, visible: true },
      });
    }
  }
  console.log('Navbar seeded for site "blog".');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
