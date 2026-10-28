# DRAFT POST — paste these into your "Create Post" form

> The block below is for the **SEO panel** fields. The article body starts under
> "── ARTICLE BODY ──". Delete this file after you've added the post.

**Title:** Next.js Security Checklist: 10 Fixes Before You Ship (2026)
**Slug:** nextjs-security-checklist
**Category:** Tech
**Focus keyword:** Next.js security checklist
**Tags:** Next.js, Security, Web Development, Node.js
**Meta title:** Next.js Security Checklist: 10 Fixes Before You Ship (2026)
**Meta description:** A practical Next.js security checklist — secure your API routes, headers, auth, file uploads and realtime layer. 10 must-do fixes to harden your app before launch.
**Excerpt:** Ten practical, battle-tested fixes to harden a Next.js app before production — from per-route authorization and security headers to file uploads and your WebSocket layer.

---

## ── ARTICLE BODY ──

Shipping a Next.js app is easy. Shipping a *secure* one takes a few deliberate checks that are easy to skip under deadline pressure. This Next.js security checklist walks through ten fixes that catch the most common — and most damaging — mistakes, with concrete examples you can apply today.

Work through it before every launch. None of these take long; missing any one of them can undo all the others.

## 1. Never hardcode secrets

Database passwords, `NEXTAUTH_SECRET`, API keys, and SMTP credentials belong in environment variables — never in source code, and never committed to git.

Two rules that prevent most leaks:

- Keep a committed `.env.example` with empty placeholders, and add `.env` to `.gitignore`.
- Use a long, random `NEXTAUTH_SECRET`. A guessable one lets an attacker forge session tokens and impersonate any user.

```bash
# generate a strong secret
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

If a real key ever lands in your repo or a screenshot, rotate it. Assume it's compromised.

## 2. Authorize every API route — not just the middleware

Middleware is a convenient first gate, but it's easy to forget that it only matches the paths in its `matcher`. Any route outside that list is wide open unless the handler checks for itself.

Treat **every** state-changing route as if it has no middleware in front of it:

```ts
export async function POST(req: NextRequest) {
  const auth = await requirePermission('manage-settings')
  if (auth.error) return auth.error
  // ...safe to proceed
}
```

A settings endpoint with no auth check is all it takes for someone to flip your site to `noindex` and disappear from Google overnight.

## 3. Send real security headers

Add a Content-Security-Policy and the standard hardening headers to every response. In `next.config.ts`:

```ts
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; object-src 'none'; frame-ancestors 'self'" },
    ],
  }]
}
```

Also set `poweredByHeader: false` so you're not advertising your framework.

## 4. Sanitize user-generated HTML

If you render any user or editor content with `dangerouslySetInnerHTML`, you have a stored-XSS risk. Run the HTML through an allowlist sanitizer **on write and on render**:

```ts
import sanitizeHtml from 'sanitize-html'

export function clean(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ['p','h2','h3','strong','em','ul','ol','li','a','img','pre','code'],
    allowedAttributes: { a: ['href','rel','target'], img: ['src','alt'] },
    allowedSchemes: ['http','https','mailto'],
  })
}
```

Strip `<script>`, `onerror=`, and `javascript:` URLs — never trust that the editor already did.

## 5. Lock down file uploads

Uploads are a classic foothold. A safe upload endpoint should:

- Require an authenticated, authorized user.
- Whitelist MIME types — and **reject SVG**, which can carry script.
- Cap the file size and the decoded pixel count (to block decompression bombs).
- Re-encode the image (e.g. with `sharp`) to strip metadata and guarantee it's a real raster, then save it under a random filename.

Re-encoding is the key step: it turns "a file the user named `.png`" into "an image you generated."

## 6. Add a CSRF / same-origin guard

For cookie-authenticated, state-changing routes, reject requests whose `Origin`/`Referer` host doesn't match yours:

```ts
export function isSameOrigin(req: NextRequest) {
  const host = req.headers.get('host')
  const origin = req.headers.get('origin')
  if (origin) try { return new URL(origin).host === host } catch { return false }
  return false // no Origin on a sensitive route → reject
}
```

It's a cheap second wall against forged cross-site requests.

## 7. Rate-limit auth and expensive endpoints

Brute-force protection and cost control both come down to rate limiting. Cap login attempts, signups, comments, and anything that calls a paid third-party API (image processing, AI):

```ts
const rl = rateLimit(`login:${ip}`, 10, 10 * 60 * 1000) // 10 / 10 min
if (!rl.ok) return tooMany()
```

A single in-memory limiter is enough for one Node process; swap in Redis when you scale horizontally.

## 8. Secure your realtime layer

A WebSocket/Socket.io server is still an API — it needs auth too. Verify the session on the handshake, and never trust a client-supplied user ID:

- Bind each socket to its **own** authenticated user, not the ID it claims.
- Check membership before letting a socket join a private or group room. Sequential room IDs are guessable; without a check, anyone can listen in.

## 9. Use parameterized queries

An ORM like Prisma parameterizes for you, which kills most SQL injection. If you ever drop to raw SQL, keep values **bound**, never concatenated:

```ts
// safe — value is parameterised
await prisma.$queryRaw`SELECT id FROM posts WHERE slug = ${slug}`
```

Never build a query by string-joining user input.

## 10. Least privilege and good hygiene

Finish with the boring, high-impact basics:

- Give your app a **non-root** database user with only the grants it needs — not `root` with an empty password.
- Keep dependencies patched (`npm audit`), and delete dead/backup files so they don't widen your attack surface.
- Don't leak stack traces or internal paths in production error responses.

## The 30-second recap

Before you ship, confirm you've: moved secrets to env, authorized every route, set security headers, sanitized HTML, hardened uploads, added CSRF + rate limits, secured realtime, parameterized queries, and dropped to a least-privilege DB user.

None of these are exotic. They're just easy to forget — which is exactly why a checklist beats good intentions. Bookmark this one and run it on every release.
