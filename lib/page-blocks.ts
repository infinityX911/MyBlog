/**
 * lib/page-blocks.ts — shared block types for the CMS page builder.
 * A page's `blocks` column stores JSON: Block[].
 */

export type ContactMethod = { color?: string; icon?: string; label: string; value: string; href?: string; note?: string };
export type SocialLink = { icon?: string; label: string; url: string };
export type FaqItem = { q: string; a: string };
export type LinkCard = { image?: string; gradient?: string; title: string; description?: string; href: string; badge?: string; cta?: string };

export type Block =
  | { id: string; type: 'text'; html: string }
  | { id: string; type: 'posts'; heading?: string; category?: string; count?: number }
  | { id: string; type: 'downloads'; heading?: string; category?: string; count?: number; featuredOnly?: boolean }
  | { id: string; type: 'hero'; heading?: string; badge?: string; subtext?: string; image?: string; gradient?: string; showStats?: boolean; statArticles?: boolean; statCategories?: boolean; statViews?: boolean; fullWidth?: boolean }
  | { id: string; type: 'newsletter'; heading?: string; subtext?: string; buttonLabel?: string; buttonUrl?: string; fullWidth?: boolean }
  | { id: string; type: 'filter' }
  | { id: string; type: 'featured'; downloadSlug?: string }
  | { id: string; type: 'sidebar' }
  | { id: string; type: 'author' }
  | { id: string; type: 'categories'; heading?: string }
  | { id: string; type: 'trending'; heading?: string; count?: number }
  | { id: string; type: 'tags'; heading?: string }
  | { id: string; type: 'related'; heading?: string; category?: string; count?: number }
  | { id: string; type: 'ad'; code?: string }
  | { id: string; type: 'contact'; heading?: string; methods?: ContactMethod[] }
  | { id: string; type: 'social'; heading?: string; subtext?: string; links?: SocialLink[] }
  | { id: string; type: 'faq'; heading?: string; items?: FaqItem[] }
  | { id: string; type: 'youtube'; heading?: string }
  | { id: string; type: 'cards'; heading?: string; perPage?: number; items?: LinkCard[] };

export const BLOCK_LABELS: Record<Block['type'], string> = {
  text: '📝 Text / Rich content',
  posts: '📰 Posts grid',
  downloads: '📥 Downloads grid',
  hero: '🖼️ Top hero (gradient/image banner)',
  newsletter: '✉️ Newsletter / Subscribe',
  filter: '🏷️ Category filter bar',
  featured: '⭐ Featured resource card',
  sidebar: '📌 Sidebar (author + categories + trending)',
  author: '👤 Author card',
  categories: '🗂️ Categories list',
  trending: '🔥 Trending posts',
  tags: '🏷️ Tags',
  related: '🔗 Related posts',
  ad: '💰 Ad (AdSense unit)',
  contact: '📇 Contact info card',
  social: '🔗 Follow / social links',
  faq: '❓ Quick answers (FAQ)',
  youtube: '▶️ Our YouTube channels',
  cards: '🎴 Cards grid (link cards → pages)',
};

/** Parse the DB `blocks` JSON safely into an array. */
export function parseBlocks(raw: string | null | undefined): Block[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Plain-ish HTML of a page's text content, for the SEO panel to score. */
export function blocksToSeoText(blocks: Block[]): string {
  return blocks.map((b) => {
    switch (b.type) {
      case 'text': return b.html || '';
      case 'hero': return `<h2>${b.heading ?? ''}</h2><p>${b.subtext ?? ''}</p>`;
      case 'posts':
      case 'downloads': return b.heading ? `<h2>${b.heading}</h2>` : '';
      case 'newsletter': return `<p>${b.subtext ?? ''}</p>`;
      case 'faq': return (b.items ?? []).map(i => `<h3>${i.q}</h3><p>${i.a}</p>`).join('\n');
      case 'cards': return (b.heading ? `<h2>${b.heading}</h2>` : '') + (b.items ?? []).map(c => `<h3>${c.title}</h3><p>${c.description ?? ''}</p>`).join('\n');
      case 'contact': case 'social': case 'youtube': case 'filter': case 'featured': case 'sidebar': return '';
      default: return '';
    }
  }).join('\n');
}
