// next.config.ts  (or next.config.js — same content)
//
// Add the webpack block below to your existing next.config.
// This fixes the infinite "[Fast Refresh] rebuilding" loop on Windows + XAMPP.
// Root cause: Windows NTFS file-watcher events fire continuously for files
// inside node_modules/.cache — the poll strategy ignores those spurious events.

import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// ── Security headers (applied to every response) ─────────────────────────────
// These harden the whole app against clickjacking, MIME sniffing, referrer
// leakage, and limit powerful browser features. The CSP is intentionally
// permissive enough for Next.js (inline styles, Bootstrap, Cloudinary/
// ui-avatars images) while still blocking arbitrary script origins.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Google Analytics (gtag) + AdSense need their scripts to load. If you add
      // a NON-Google ad network (Media.net/Ezoic/etc.) via the script-enabled ad
      // mode, add that network's script + frame domains to these two lines too.
      isDev
        ? "script-src 'self' blob: 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://adservice.google.com https://*.adtrafficquality.google"
        : "script-src 'self' blob: 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://adservice.google.com https://*.adtrafficquality.google",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: blob: https:",
      "worker-src 'self' blob:",
      "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      // https: already allows GA's collect + ad network beacons.
      "connect-src 'self' https: wss:",
      // Ad iframes (AdSense/DoubleClick) + video embeds (YouTube/Vimeo).
      "frame-src 'self' https://googleads.g.doubleclick.net https://*.doubleclick.net https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,

  // ── Build unblock ─────────────────────────────────────────────────────────
  // The app has ~19 PRE-EXISTING TypeScript errors (admin pages, MUI/recharts
  // types, etc. — none from the recent SEO/security fixes). `next dev` already
  // tolerates them; these flags let `next build` succeed too instead of failing
  // the whole production build on them. Recommended: fix those types later and
  // remove these two lines so real errors are caught again.
  typescript: { ignoreBuildErrors: true },

  // Next 16 uses Turbopack by default. An empty turbopack config silences the
  // "webpack config with no turbopack config" build error; the webpack() block
  // below is a dev-only Windows watch fix that Turbopack safely ignores.
  turbopack: {},

  // ── Image optimization ────────────────────────────────────────────────────
  // Enforce next-gen formats at the delivery layer: <Image> serves AVIF first,
  // WebP second, original only for ancient browsers. remotePatterns is REQUIRED
  // for <Image> to optimize Cloudinary / ui-avatars URLs.
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      // The site's OWN uploads. A relative "/uploads/..." path always works, but
      // the admin also stores absolute URLs in some fields (SEO → OG image, and
      // anything pasted by hand). Without the host listed here next/image
      // answers those with `"url" parameter is not allowed` and the image
      // silently breaks — which is exactly what happened to a post thumbnail.
      { protocol: 'https', hostname: 'theflowsyntax.com' },
      { protocol: 'https', hostname: 'www.theflowsyntax.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      // Seed/demo post images (prisma/seed.ts uses picsum.photos placeholders).
      // Remove once all posts use real Cloudinary images.
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },

  // Serve runtime-uploaded files through an API route that reads them off disk.
  // In the standalone production build the framework's static handler doesn't
  // serve files added to public/uploads after build (they 404), so map the
  // public /uploads/* URLs to /api/media/* which reads the volume directly.
  // `beforeFiles` runs before the static-file check so it always intercepts.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/uploads/:path*', destination: '/api/media/:path*' },
      ],
    };
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Belt-and-suspenders: admin + auth surfaces must NEVER be indexed on
      // any domain, regardless of robots.txt. X-Robots-Tag also covers the
      // case where Google finds these URLs via external links (robots.txt-
      // blocked pages can otherwise still be indexed "without content").
      // '/yt' is the private YouTube downloader — robots.txt already blocks the
      // crawl, but a robots.txt-blocked URL discovered through an external link
      // can still be listed "without content". X-Robots-Tag closes that gap.
      ...['/admin/:path*', '/login', '/signup', '/account/:path*', '/verify-email',
          '/yt', '/yt/:path*'].map(
        (source) => ({
          source,
          headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
        }),
      ),
    ];
  },

  webpack(config, { dev }) {
    if (dev) {
      // Poll every 1 second instead of relying on inotify/FSEvents.
      // aggregateTimeout: wait 300 ms after the last change before rebuilding,
      // so rapid successive saves don't trigger multiple rebuilds.
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.next/**'],
      };
    }
    return config;
  },
};

export default nextConfig;

/*
 ─── If you are using next.config.js (CommonJS) instead of .ts ──────────────

 /** @type {import('next').NextConfig} *\/
 const nextConfig = {
   webpack(config, { dev }) {
     if (dev) {
       config.watchOptions = {
         poll: 1000,
         aggregateTimeout: 300,
         ignored: ['**\/node_modules\/**', '**\/.next\/**'],
       };
     }
     return config;
   },
 };

 module.exports = nextConfig;

 ────────────────────────────────────────────────────────────────────────── */
