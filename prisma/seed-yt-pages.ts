/**
 * prisma/seed-yt-pages.ts
 *
 * Seeds the YouTube-downloader CMS pages (About / Privacy / Contact / Disclaimer)
 * into `cms_pages` (+ `cms_page_seo`). Idempotent via upsert on (siteKey, slug),
 * so it is safe to re-run. Content preserved from the original static pages.
 *
 * Run:  npm run seed:yt      (after adding the script — see below)
 *   or: npx ts-node prisma/seed-yt-pages.ts
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
const SITE_KEY = 'yt';

interface SeedPage { slug: string; title: string; metaTitle: string; metaDescription: string; content: string; }

const pages: SeedPage[] = [
  {
    "slug": "privacy",
    "title": "Privacy Policy",
    "metaTitle": "Privacy Policy – My Tube Downloader",
    "metaDescription": "How My Tube Downloader collects, uses, and protects your data. Minimal data, no tracking, URLs deleted within 1 hour.",
    "content": "<p>We are committed to transparency about how we handle your data. <strong>Summary:</strong> My Tube Downloader collects minimal data. We don’t store your videos, don’t require registration, don’t sell your data, and don’t run advertising trackers. Submitted YouTube URLs are deleted within 1 hour.</p><h2>1. Information We Collect</h2><p>When you use My Tube Downloader, we may collect the following limited technical information necessary for the operation of the service:</p><p><strong>Usage Data:</strong> We collect anonymised, aggregated data about how users interact with our service, including which formats are most popular and general traffic volumes. This data is never linked to individual users.</p><p><strong>Log Data:</strong> Our servers automatically record standard web server logs, including your IP address, browser type, operating system, referring URL, and the date/time of your request. These logs are retained for a maximum of 30 days for security purposes and then permanently deleted.</p><p><strong>YouTube URLs:</strong> When you submit a YouTube URL for processing, we temporarily store the URL on our servers solely to perform the conversion. This URL is automatically deleted within 1 hour of processing completion.</p><p><strong>Contact Form Data:</strong> If you contact us through our Contact page, we retain your name, email address, and message so that we may respond to your inquiry.</p><p>We do not collect: names, email addresses (except via contact form), payment information, cookies for tracking, or any personal information to identify individual users of the download tool.</p><h2>2. How We Use Your Information</h2><p>We use the limited information we collect for the following purposes only:</p><ul><li><strong>Service Operation:</strong> Processing your YouTube URL conversion requests</li><li><strong>Security &amp; Abuse Prevention:</strong> Detecting and preventing automated abuse, rate-limiting, and protecting our servers</li><li><strong>Service Improvement:</strong> Understanding aggregate usage patterns to improve performance and add features</li><li><strong>Customer Support:</strong> Responding to inquiries submitted through our Contact form</li><li><strong>Legal Compliance:</strong> Complying with applicable laws and regulations</li></ul><p>We do not use your information for: advertising, marketing, profiling, selling to third parties, or any commercial purpose beyond operating this free service.</p><h2>3. Cookies &amp; Tracking</h2><p>My Tube Downloader uses minimal cookies:</p><p><strong>Essential Cookies:</strong> We use a single session cookie to maintain your preferences (such as dark/light mode) during your visit. This cookie contains no personal information and expires when you close your browser.</p><p><strong>No Analytics Cookies:</strong> We do not use Google Analytics, Facebook Pixel, or any other third-party tracking cookies.</p><p><strong>No Advertising Cookies:</strong> We do not serve targeted advertisements and therefore use no advertising cookies.</p><p>You can disable cookies entirely in your browser settings without affecting core functionality of our tool.</p><h2>4. Data Sharing &amp; Third Parties</h2><p>We do not sell, rent, or trade your personal information to any third parties.</p><p><strong>Service Providers:</strong> We use trusted infrastructure providers (cloud hosting, CDN) who process data on our behalf under strict data processing agreements. These providers are contractually prohibited from using your data for any purpose other than providing services to us.</p><p><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or governmental authority. We will notify you of such requirements where legally permitted.</p><p><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, user data would be transferred under the same privacy protections described in this policy.</p><h2>5. Data Retention</h2><p>We retain data for the shortest period necessary:</p><ul><li><strong>YouTube URLs submitted:</strong> Deleted within 1 hour of processing</li><li><strong>Converted files:</strong> Deleted immediately after your download completes (never stored longer than 2 hours)</li><li><strong>Server logs:</strong> Deleted after 30 days</li><li><strong>Contact form submissions:</strong> Retained for 12 months, then deleted</li><li><strong>Anonymised aggregate statistics:</strong> Retained indefinitely (no personal data involved)</li></ul><h2>6. Your Rights (GDPR &amp; CCPA)</h2><p>Depending on your jurisdiction, you may have the following rights:</p><p><strong>Right to Access:</strong> Request a copy of any personal data we hold about you.</p><p><strong>Right to Deletion:</strong> Request that we delete any personal data we hold about you.</p><p><strong>Right to Correction:</strong> Request correction of inaccurate personal data.</p><p><strong>Right to Object:</strong> Object to the processing of your personal data.</p><p><strong>CCPA Rights (California):</strong> California residents have the right to know what personal information is collected, the right to delete it, and the right to opt-out of its sale (we do not sell personal information).</p><p>To exercise any of these rights, please contact us at privacy@mytubedownloader.com. We will respond within 30 days.</p><h2>7. Children's Privacy</h2><p>My Tube Downloader is not directed at children under the age of 13 (or 16 in the European Union). We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately and we will delete it promptly.</p><h2>8. Security</h2><p>We implement industry-standard security measures to protect the limited data we process, including HTTPS encryption for all data transmission, regular security audits, and access controls. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p><h2>9. Changes to This Policy</h2><p>We may update this Privacy Policy from time to time to reflect changes in our practices or applicable law. We will post the updated policy on this page with a new \"Last Updated\" date. For significant changes, we will display a notice on our homepage. Continued use of My Tube Downloader after changes constitutes acceptance of the updated policy.</p>"
  },
  {
    "slug": "disclaimer",
    "title": "Disclaimer",
    "metaTitle": "Disclaimer – My Tube Downloader",
    "metaDescription": "Important legal information about using My Tube Downloader, copyright law, and your responsibilities.",
    "content": "<p><strong>Important Legal Notice:</strong> Downloading YouTube videos may violate YouTube’s Terms of Service and copyright laws. This tool is provided for legitimate personal use only. Always ensure you have the right to download any content before doing so.</p><h2>General Disclaimer</h2><p>My Tube Downloader (\"the Service,\" \"we,\" \"us,\" or \"our\") is a free online tool that facilitates the downloading and conversion of publicly available YouTube videos. By using this Service, you acknowledge that you have read, understood, and agree to this Disclaimer in full.</p><p>This tool is provided \"as is\" without warranties of any kind, either express or implied. We make no representations about the accuracy, reliability, completeness, or timeliness of this service for any purpose.</p><h2>Copyright &amp; Intellectual Property</h2><p>The vast majority of YouTube videos are protected by copyright law. Downloading or converting such videos without the explicit permission of the copyright holder may constitute copyright infringement under the laws of your country.</p><p><strong>My Tube Downloader does not host, store, or distribute copyrighted content.</strong> We provide a technical tool only. Users are solely responsible for ensuring they have the legal right to download any content they process through this Service.</p><p>Permitted uses may include: - Downloading your own YouTube uploads for backup purposes - Downloading videos explicitly licensed under Creative Commons - Downloading public domain content - Downloading content where the copyright holder has explicitly granted permission for offline download</p><p>You should NOT use this tool to download: - Commercial music videos without license - Movies, TV shows, or documentaries - Any content where you do not have explicit permission from the rights holder</p><h2>YouTube Terms of Service</h2><p>Using this tool may violate YouTube's Terms of Service (Section 5.H), which prohibit downloading content from YouTube \"unless YouTube's streaming interface is used\" or unless \"you have been given explicit permission to do so by YouTube or the respective rights owners.\"</p><p>We strongly encourage all users to review YouTube's Terms of Service at https://www.youtube.com/t/terms before using this tool.</p><p>My Tube Downloader is not affiliated with, endorsed by, sponsored by, or connected to YouTube, Google, or Alphabet Inc. in any way.</p><h2>Limitation of Liability</h2><p>To the maximum extent permitted by applicable law, My Tube Downloader, its operators, employees, and affiliates shall not be liable for:</p><ul><li>Any direct, indirect, incidental, special, or consequential damages arising from your use of this Service</li><li>Legal consequences you face as a result of copyright infringement through use of this tool</li><li>Loss of data, revenue, profits, or goodwill</li><li>Any damages resulting from service interruptions, errors, or technical failures</li><li>Actions taken by YouTube, Google, or rights holders in response to your use of this tool</li></ul><p>Your use of this Service is entirely at your own risk. You assume full responsibility for compliance with all applicable laws.</p><h2>No Endorsement</h2><p>References to any third-party products, services, websites, or trademarks on this site are for informational purposes only and do not constitute or imply endorsement, sponsorship, or recommendation by My Tube Downloader. YouTube™ and the YouTube logo are trademarks of Google LLC.</p><h2>Changes to This Disclaimer</h2><p>We reserve the right to modify this Disclaimer at any time. Changes will be effective immediately upon posting to this page with an updated date. Your continued use of the Service following any changes constitutes acceptance of the updated Disclaimer.</p>"
  },
  {
    "slug": "about",
    "title": "About Us",
    "metaTitle": "About Us – My Tube Downloader",
    "metaDescription": "My Tube Downloader gives everyone the freedom to access YouTube content offline, in any format, for free.",
    "content": "<p>My Tube Downloader was built with one goal: give everyone the freedom to access YouTube content offline, in any format they choose — for free.</p><h2>Our Story</h2><p>My Tube Downloader started in 2020 as a simple side project. The founders — a small team of web developers and media enthusiasts — were frustrated with the existing YouTube downloaders: slow, cluttered with ads, requiring installations, or charging subscription fees for basic features.</p><p>We built the first version in a weekend. It was fast, clean, and free. We shared it with friends — within a month, 10,000 people were using it.</p><p>Today, <strong>My Tube Downloader</strong> is used by over 50 million people across 190 countries. We’ve expanded to support 12 formats, 4K quality, and 6 audio formats — and we remain 100% free with no sign-up required.</p><h2>Our Values</h2><ul><li><strong>Our Mission:</strong> The world’s most accessible, fast, and reliable YouTube downloader — free, forever.</li><li><strong>Speed First:</strong> Every conversion should complete in seconds, not minutes.</li><li><strong>Privacy by Design:</strong> We never store your videos, log your URLs, or sell your data.</li><li><strong>Built for Everyone:</strong> Simple for all skill levels.</li></ul>"
  },
  {
    "slug": "contact",
    "title": "Contact Us",
    "metaTitle": "Contact Us – My Tube Downloader",
    "metaDescription": "Get in touch with the My Tube Downloader team for support, bug reports, or collaboration.",
    "content": "<p>Have a question, found a bug, or want to collaborate? We’re here to help.</p><h2>Email Support</h2><p>General support: <a href=\"mailto:support@mytubedownloader.com\">support@mytubedownloader.com</a></p><h2>Bug Reports</h2><p>Email us with the subject “Report a Bug” and steps to reproduce.</p><h2>Response Time</h2><p>We typically reply within 24–48 hours.</p>"
  }
];

async function main() {
  for (const p of pages) {
    const seoData = { metaTitle: p.metaTitle, metaDescription: p.metaDescription, robotsIndex: true, robotsFollow: true, schemaType: 'WebPage' };
    await prisma.cmsPage.upsert({
      where: { siteKey_slug: { siteKey: SITE_KEY, slug: p.slug } },
      create: { siteKey: SITE_KEY, slug: p.slug, title: p.title, content: p.content, status: 'published', publishedAt: new Date(), seo: { create: seoData } },
      update: { title: p.title, content: p.content, status: 'published', seo: { upsert: { create: seoData, update: seoData } } },
    });
    console.log(`  seeded /${p.slug}`);
  }
  console.log(`Done. ${pages.length} YT CMS pages seeded.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
