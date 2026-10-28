/**
 * backfill-primary-category.cjs
 * One-off: for every post that has no primaryCategoryId yet, set it to the
 * post's first assigned category. Run AFTER `prisma db push` + `generate`
 * (push-primary-category.bat does all three in order). Safe to re-run.
 */
const fs = require('fs');
const path = require('path');

(function loadEnv() {
    const p = path.join(__dirname, '.env');
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const v = m[2].replace(/^["']|["']$/g, '');
        if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
})();
function fromUrl() {
    const u = process.env.DATABASE_URL;
    if (!u) return {};
    const m = u.match(/^mysql:\/\/([^:]+):([^@]*)@([^:/]+):?(\d+)?\/([^?]+)/);
    return m ? { user: m[1], password: decodeURIComponent(m[2]), host: m[3], port: m[4], database: m[5] } : {};
}
const url = fromUrl();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST || url.host || 'localhost',
    port: Number(process.env.DB_PORT || url.port || 3306),
    user: process.env.DB_USER || url.user || 'root',
    password: process.env.DB_PASSWORD || url.password || '',
    database: process.env.DB_NAME || url.database || 'api',
    connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

(async () => {
    const posts = await prisma.post.findMany({
        where: { primaryCategoryId: null },
        include: { categories: true }, // PostCategory[] { postId, categoryId }
    });
    let updated = 0;
    for (const p of posts) {
        const firstCat = p.categories[0]?.categoryId;
        if (!firstCat) continue; // post has no categories → leave null (renders as "uncategorized")
        await prisma.post.update({ where: { id: p.id }, data: { primaryCategoryId: firstCat } });
        updated++;
    }
    console.log(`✅ Backfill complete. ${updated} post(s) got a primary category (${posts.length - updated} had none to set).`);
    await prisma.$disconnect();
})().catch((e) => { console.error('❌ Failed:', e.message || e); process.exit(1); });
