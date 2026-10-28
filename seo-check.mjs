// seo-check.mjs — quick SEO audit of any rendered page (no dependencies).
//
// First, list your real post URLs:
//   node seo-check.mjs --list
// Then audit one of them:
//   node seo-check.mjs http://localhost:3000/posts/<real-slug>
//   node seo-check.mjs                # audits the homepage
//
// Throwaway dev tool — delete it whenever you like.

const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
const ok = (m) => console.log(`${C.g}✓${C.x} ${m}`);
const bad = (m) => console.log(`${C.r}✗${C.x} ${m}`);
const warn = (m) => console.log(`${C.y}⚠${C.x} ${m}`);
const head = (m) => console.log(`\n${C.b}${m}${C.x}`);

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3] ?? '') : null;
}
function metaByName(html, key, which = 'name') {
  const re = new RegExp(`<meta[^>]*${which}\\s*=\\s*["']${key}["'][^>]*>`, 'i');
  const m = html.match(re);
  return m ? attr(m[0], 'content') : null;
}

async function listUrls(base) {
  const sm = base.replace(/\/$/, '') + '/sitemap.xml';
  const res = await fetch(sm).catch(() => null);
  if (!res || !res.ok) {
    console.error(`${C.r}Could not read ${sm}${C.x} — is the dev server running?`);
    process.exitCode = 1;
    return;
  }
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const posts = locs.filter((u) => u.includes('/posts/'));
  console.log(`\n${C.b}Post URLs from sitemap${C.x} ${C.d}(${posts.length})${C.x}`);
  (posts.length ? posts : locs).forEach((u) => console.log('  ' + u));
  console.log(`\n${C.d}Audit one with:${C.x} node seo-check.mjs <url>\n`);
}

async function audit(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'seo-check/1.0' } }).catch((e) => {
    console.error(`${C.r}Could not fetch ${url}${C.x}\n${e.message}\nIs the dev server running?`);
    return null;
  });
  if (!res) { process.exitCode = 1; return; }
  if (!res.ok) {
    console.error(`${C.r}HTTP ${res.status} for ${url}${C.x}  — wrong slug? run: node seo-check.mjs --list`);
    process.exitCode = 1;
    return;
  }
  const html = await res.text();
  console.log(`\n${C.b}SEO check${C.x} ${C.d}${url}${C.x}  ${C.d}(HTTP ${res.status})${C.x}`);

  head('Core meta');
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim();
  title ? ok(`title: "${title}" ${title.length > 60 ? C.y + `(${title.length} chars — a bit long)` + C.x : C.d + `(${title.length})` + C.x}`)
        : bad('no <title>');

  const desc = metaByName(html, 'description');
  desc ? ok(`description: "${desc}" ${desc.length < 70 || desc.length > 160 ? C.y + `(${desc.length} — aim 70–160)` + C.x : C.d + `(${desc.length})` + C.x}`)
       : bad('no meta description');

  const robots = metaByName(html, 'robots');
  robots ? (/noindex/i.test(robots) ? warn(`robots: ${robots}  (this page is NOINDEX)`) : ok(`robots: ${robots}`))
         : console.log(`${C.d}· no robots meta (defaults to index,follow)${C.x}`);

  const canonical = (html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i) || [])[0];
  const canHref = canonical ? attr(canonical, 'href') : null;
  if (!canHref) bad('no canonical link');
  else if (canHref.includes('localhost')) warn(`canonical: ${canHref}  (localhost — set real domain in Admin → Settings before launch)`);
  else ok(`canonical: ${canHref}`);

  head('Open Graph / Twitter');
  for (const p of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image']) {
    const v = metaByName(html, p, 'property') || metaByName(html, p, 'name');
    v ? ok(`${p}: ${v}`) : (p === 'og:image' ? warn(`${p}: missing (no social preview image)`) : warn(`${p}: missing`));
  }
  for (const t of ['twitter:card', 'twitter:title']) {
    const v = metaByName(html, t) || metaByName(html, t, 'property');
    v ? ok(`${t}: ${v}`) : warn(`${t}: missing`);
  }

  head('Other signals');
  const lang = attr((html.match(/<html[^>]*>/i) || [''])[0], 'lang');
  lang ? ok(`<html lang="${lang}">`) : warn('no <html lang>');
  /name=["']viewport["']/i.test(html) ? ok('viewport meta present') : warn('no viewport meta');
  /application\/rss\+xml/i.test(html) ? ok('RSS alternate link present') : warn('no RSS alternate link');

  head('Headings');
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
  if (h1s.length === 0) bad('no <h1> on the page');
  else if (h1s.length === 1) ok(`exactly one <h1>: "${h1s[0]}"`);
  else warn(`${h1s.length} <h1> tags (ideally one): ${h1s.map((h) => `"${h}"`).join(', ')}`);

  head('Structured data (JSON-LD)');
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
  if (blocks.length === 0) bad('no JSON-LD found');
  for (const [i, raw] of blocks.entries()) {
    try {
      const json = JSON.parse(raw);
      const nodes = json['@graph'] || [json];
      const types = nodes.map((n) => n['@type']).filter(Boolean);
      ok(`block ${i + 1}: valid JSON — types: ${types.join(', ') || '(none)'}`);
      const article = nodes.find((n) => /Article|BlogPosting/i.test(n['@type'] || ''));
      if (article) {
        article.headline ? ok(`  · headline: "${article.headline}"`) : warn('  · missing headline');
        article.datePublished ? ok(`  · datePublished: ${article.datePublished}`) : warn('  · missing datePublished');
        article.dateModified ? ok(`  · dateModified: ${article.dateModified}`) : warn('  · missing dateModified');
        article.author ? ok(`  · author: ${article.author?.name || JSON.stringify(article.author)} (${article.author?.['@type'] || '?'})`) : warn('  · missing author');
        article.image ? ok(`  · image: ${Array.isArray(article.image) ? article.image[0] : article.image}`) : warn('  · missing image');
      }
    } catch {
      bad(`block ${i + 1}: INVALID JSON (Google will ignore this block)`);
    }
  }
  console.log('');
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--list') {
    await listUrls(process.argv[3] || 'http://localhost:3000');
  } else {
    await audit(arg || 'http://localhost:3000');
  }
}
await main();
