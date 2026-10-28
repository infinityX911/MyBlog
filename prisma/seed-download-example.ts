/**
 * prisma/seed-download-example.ts
 * Inserts one complete, published example download (with full content + SEO)
 * so you can see the download detail page working end-to-end. Idempotent
 * (upsert on slug). Run:  npx ts-node prisma/seed-download-example.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return { host: u.hostname || 'localhost', port: u.port ? parseInt(u.port, 10) : 3306,
        user: u.username || 'root', password: u.password || '', database: u.pathname.slice(1) || '' };
    } catch {}
  }
  return {
    host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.DATABASE_PORT) || 3306,
    user: process.env.DB_USER || process.env.DATABASE_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
    database: process.env.DB_NAME || process.env.DATABASE_NAME || 'api',
  };
};

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(getDbConfig()) });

const d = {
  "title": "SQL Backup Master 2026 Free Download",
  "slug": "sql-backup-master-2026",
  "excerpt": "A secure, easy-to-use backup tool for Microsoft SQL Server — schedule, compress, encrypt, and restore database backups locally or to the cloud.",
  "content": "<p>SQL Backup Master 2026 is a specialized backup tool designed for Microsoft SQL Server databases which can be used to create, schedule, compress, encrypt, and store database backups to protect valuable data from accidental loss, corruption, or hardware failure. It provides reliable restoration capabilities to help you retrieve backups from any storage location, decrypt them, and execute the restoration to your target SQL Server instance.</p>\n<h2>SQL Backup Master 2026 Overview</h2>\n<p>It is a versatile application that acts as a bridge between your local SQL instances and virtually any modern storage infrastructure. It is a highly secure tool that protects backup files with strong AES encryption to prevent unauthorized access. It can completely eliminate the need for expensive hardware or complex techniques to upload database backups to various cloud storage providers whether you need local backups for quick recovery or off-site cloud storage for disaster protection.</p>\n<p>It also supports scheduled backups allowing you to run regular database backups such as daily, weekly, or hourly. The program automatically generates email alerts indicating whether backup jobs completed successfully or failed. The interface is extremely simple-to-use that greatly simplifies the process of creating, scheduling, and managing SQL Server database backups.</p>\n<h2>Features of SQL Backup Master 2026</h2>\n<p>Below are some noticeable features which you will experience after SQL Backup Master 2026 free download:</p>\n<ul>\n<li>Create, schedule, compress, encrypt, and store database backups.</li>\n<li>Protect valuable data from accidental loss, corruption, or hardware failure.</li>\n<li>Retrieve backups from any storage location, decrypt them, and restore to your target SQL Server instance.</li>\n<li>Acts as a bridge between your local SQL instances and virtually any modern storage infrastructure.</li>\n<li>Protects backup files with strong AES encryption to prevent unauthorized access.</li>\n<li>Store backups locally, on network drives, or in cloud storage.</li>\n<li>Supports scheduled backups (daily, weekly, hourly).</li>\n<li>Automatic email alerts for successful or failed backup jobs.</li>\n</ul>\n<h2>System Requirements for SQL Backup Master 2026</h2>\n<ul>\n<li><strong>Operating System:</strong> Windows 7/8/10/11</li>\n<li><strong>RAM:</strong> 1 GB</li>\n<li><strong>Hard Disk:</strong> 500 MB</li>\n<li><strong>Processor:</strong> Intel Dual Core or higher processor</li>\n</ul>\n<p>Click the download button below to start the SQL Backup Master 2026 free download. This is a full offline installer standalone setup for Windows, compatible with both 32-bit and 64-bit systems.</p>",
  "fileUrl": "https://example.com/files/sql-backup-master-2026.zip",
  "fileType": "ZIP",
  "fileSize": "24.6 MB",
  "icon": "🗄️",
  "gradient": "",
  "image": "https://picsum.photos/seed/sqlbackup/1200/630",
  "category": "Development",
  "tags": "SQL,Backup,Database,Windows",
  "featured": true,
  "free": true,
  "seo": {
    "focusKeyword": "SQL Backup Master 2026",
    "metaTitle": "SQL Backup Master 2026 Free Download - Full Setup",
    "metaDescription": "Download SQL Backup Master 2026 free — a secure backup tool for Microsoft SQL Server. Create, schedule, compress, encrypt & restore database backups. Full offline installer.",
    "ogTitle": "SQL Backup Master 2026 Free Download",
    "ogDescription": "Secure SQL Server backup tool: schedule, compress, encrypt, and restore database backups locally or to the cloud.",
    "schemaType": "SoftwareApplication"
  }
};

async function main() {
  const { seo, ...download } = d;
  await prisma.download.upsert({
    where: { slug: download.slug },
    create: { ...download, status: 'published', publishedAt: new Date(), seo: { create: seo } },
    update: { ...download, status: 'published', seo: { upsert: { create: seo, update: seo } } },
  });
  console.log(`Seeded & published download: /downloads/${download.slug}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
