/**
 * prisma/seed-demo-posts.ts
 *
 * Seeds 15 published demo blog posts (tech-tutorial style) so pagination is
 * visible. Idempotent: skips a post if its slug already exists.
 *
 * Run:  npx ts-node prisma/seed-demo-posts.ts
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

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

const TITLES = [
  'Getting Started with Next.js 16',
  'Understanding React Server Components',
  'CSS Grid vs Flexbox: When to Use Which',
  'A Practical Guide to TypeScript Generics',
  'Building a REST API with Node.js',
  'Tailwind CSS Tips You Should Know',
  'Mastering Async/Await in JavaScript',
  'Prisma ORM: A Beginner’s Guide',
  'Debugging Like a Pro in VS Code',
  'Git Workflows for Small Teams',
  'Optimizing Web Performance in 2026',
  'Introduction to Blender for Developers',
  'After Effects Basics for Web Devs',
  'Deploying Next.js on a VPS',
  'Clean Code Principles Every Dev Should Follow',
];

const EXCERPTS = [
  'A hands-on walkthrough to get your first project up and running fast.',
  'What they are, why they matter, and how to use them the right way.',
  'A clear, practical comparison with real-world layout examples.',
  'Write safer, reusable code by mastering this core TypeScript feature.',
  'From zero to a working API with routes, validation, and error handling.',
  'Small utilities and patterns that make you far more productive.',
  'Stop fighting promises — write clean asynchronous code with confidence.',
  'Model your data and query it type-safely with almost no boilerplate.',
  'Breakpoints, watch expressions, and the tricks that save real time.',
  'A simple branching strategy that keeps a small team fast and sane.',
  'Core Web Vitals, caching, and the wins that actually move the needle.',
  'A developer-friendly path into 3D without the usual overwhelm.',
  'Add motion to your projects with the essentials, minus the fluff.',
  'Ship your app to a cheap VPS with a clean, repeatable setup.',
  'Timeless habits that make your code readable, testable, and kind.',
];

function body(title: string, excerpt: string): string {
  return `<p>${excerpt}</p>
<h2>Overview</h2>
<p>In this tutorial we’ll walk through <strong>${title}</strong> step by step, with practical examples you can follow along at your own pace. No prior deep expertise required — just curiosity.</p>
<h2>What you’ll learn</h2>
<ul><li>The core idea and why it matters</li><li>A working example, explained line by line</li><li>Common mistakes and how to avoid them</li></ul>
<h2>Wrapping up</h2>
<p>That’s the essentials. Try it in a small project, and you’ll internalise it faster than by reading alone. Happy building!</p>`;
}

async function main() {
  // Ensure a category exists to attach the posts to.
  let cat = await prisma.category.findFirst({ where: { slug: 'tech' } });
  if (!cat) cat = await prisma.category.findFirst();
  if (!cat) {
    cat = await prisma.category.create({ data: { name: 'Tech', slug: 'tech', emoji: '💻' } });
  }

  const now = Date.now();
  let created = 0, skipped = 0;

  for (let i = 0; i < TITLES.length; i++) {
    const title = TITLES[i];
    const slug = slugify(title);
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) { skipped++; continue; }

    const publishedAt = new Date(now - i * 36 * 60 * 60 * 1000); // ~1.5 days apart
    await prisma.post.create({
      data: {
        title,
        slug,
        excerpt: EXCERPTS[i],
        content: body(title, EXCERPTS[i]),
        status: 'published',
        readMin: 4 + (i % 6),
        viewCount: 40 + Math.floor(Math.random() * 900),
        featured: i === 0,
        gradient: ['sunset', 'ocean', 'purple', 'forest'][i % 4],
        publishedAt,
        createdAt: publishedAt,
        categories: { create: [{ category: { connect: { id: cat.id } } }] },
      },
    });
    created++;
  }

  console.log(`✓ Demo posts done — created: ${created}, skipped (already existed): ${skipped}, category: ${cat.name}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
