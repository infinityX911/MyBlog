// app/(blog)/downloads/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import DownloadsExplorer from '@/components/DownloadsExplorer'
import ReadingProgressBar from '@/components/ReadingProgressBar'
import { getSiteSetting, normalizeUrl } from '@/lib/siteSettings'
import styles from './Downloads.module.css'
import {
  getDownloads,
  getFeaturedDownload,
  getPopularDownloads,
  getDownloadCategories,
  buildDownloadsMetadata,
  type Download,
} from '@/lib/downloads'

export async function generateMetadata(): Promise<Metadata> {
  return buildDownloadsMetadata()
}

// ── Helper ────────────────────────────────────────────────────────
function formatDownloads(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── Download Card ─────────────────────────────────────────────────
// ── Featured Card ─────────────────────────────────────────────────
function FeaturedCard({ item }: { item: Download }) {
  return (
    <div className={styles.featuredCard}>
      <div className={styles.featuredThumb}>
        <span className={styles.featuredThumbIcon}>{item.icon}</span>
      </div>
      <div className={styles.featuredBody}>
        <div className={styles.featuredEyebrow}>⭐ Featured Resource</div>
        <h2 className={styles.featuredTitle}><Link href={`/downloads/${item.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</Link></h2>
        <p className={styles.featuredExcerpt}>{item.excerpt}</p>
        <div className={styles.featuredFooter}>
          <Link href={`/downloads/${item.slug}`} className={styles.downloadBtn}>
            Read More
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
            </svg>
          </Link>
          <div className={styles.featuredMeta}>
            <span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {formatDownloads(item.downloadCount)} downloads
            </span>
            <span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              {item.fileType} · {item.fileSize}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default async function DownloadsPage() {
  const [downloads, featured, popular, categories] = await Promise.all([
    getDownloads(),
    getFeaturedDownload(),
    getPopularDownloads(4),
    getDownloadCategories(),
  ])

  // Exclude only the ONE item shown in the Featured card — any other featured
  // items still appear in the grid, so nothing ever disappears. Filtering +
  // pagination now happen client-side inside <DownloadsExplorer/>.
  const rest         = downloads.filter(d => d.id !== featured?.id)
  const totalDL      = downloads.reduce((a, d) => a + d.downloadCount, 0)

  // JSON-LD structured data — domain + name from Admin → Settings (not hardcoded).
  const setting  = await getSiteSetting('blog')
  const baseUrl  = normalizeUrl(setting?.websiteUrl)
  const siteName = setting?.siteName || 'InkDrop'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Downloads — ${siteName}`,
    description: 'Free resources, templates, cheat sheets, and tools.',
    url: `${baseUrl}/downloads`,
    hasPart: downloads.map(d => ({
      '@type': 'DigitalDocument',
      name: d.title,
      description: d.excerpt,
      url: `${baseUrl}/api/downloads/${d.slug}/download`,
    })),
  }

  return (
    <>
      <Navbar />
      <ReadingProgressBar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className={styles.downloadsPage}>

        {/* Hero */}
        <div className={styles.hero}>
          <div className="container-fluid">
            <div className="row">
              <div className="col-12 col-md-10 col-lg-8 col-xl-7">
                <div className={styles.heroInner} data-hero-animate>
                  <div className={styles.heroEyebrow}>📥 Free Resources</div>
                  <h1 className={styles.heroTitle}>Downloads &amp; Resources</h1>
                  <p className={styles.heroSub}>
                    Free cheat sheets, templates, starter kits, and guides — everything you need to learn faster and build better.
                  </p>
                  <div className={styles.heroStats}>
                    <div className={styles.heroStat}>
                      <span className={styles.heroStatNum}>{downloads.length}+</span>
                      <span className={styles.heroStatLabel}>Resources</span>
                    </div>
                    <div className={styles.heroStat}>
                      <span className={styles.heroStatNum}>100%</span>
                      <span className={styles.heroStatLabel}>Free</span>
                    </div>
                    <div className={styles.heroStat}>
                      <span className={styles.heroStatNum}>{formatDownloads(totalDL)}</span>
                      <span className={styles.heroStatLabel}>Total Downloads</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar + grid + sidebar — functional client-side filtering.
            Featured card and sidebar are server-rendered and passed in as nodes. */}
        <DownloadsExplorer
          items={rest}
          categories={categories}
          featured={featured && (
            <>
              <div className={styles.sectionTitle}>
                ⭐ Featured <span>Editor&apos;s pick</span>
              </div>
              <FeaturedCard item={featured} />
            </>
          )}
          sidebar={
                <div className={styles.sidebar}>

                  {/* Most downloaded */}
                  {popular.length > 0 && (
                    <div className={styles.sideCard}>
                      <div className={styles.sideCardTitle}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                          <polyline points="17 6 23 6 23 12"/>
                        </svg>
                        Most Downloaded
                      </div>
                      {popular.map((item, i) => (
                        <Link key={item.id} href={`/downloads/${item.slug}`} className={styles.popularItem}>
                          <span className={styles.popularNum}>0{i + 1}</span>
                          <span className={styles.popularTitle}>{item.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Categories */}
                  <div className={styles.sideCard}>
                    <div className={styles.sideCardTitle}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 6h16M4 12h16M4 18h7"/>
                      </svg>
                      Categories
                    </div>
                    {categories.map(cat => (
                      <div key={cat.name} className={styles.catItem}>
                        <div className={styles.catLeft}>
                          <span>{cat.emoji}</span>
                          <span>{cat.name}</span>
                        </div>
                        <span className={styles.catCount}>{cat.count}</span>
                      </div>
                    ))}
                  </div>

                  {/* Newsletter */}
                  <div className={styles.sideCard}>
                    <div className={styles.sideCardTitle}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      Get Notified
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '12px', lineHeight: 1.55 }}>
                      New resources dropped every week. Be the first to know.
                    </p>
                    <Link href="/#about" className={styles.downloadBtn} style={{ width: '100%', justifyContent: 'center' }}>
                      Subscribe Free →
                    </Link>
                  </div>

                </div>
          }
        />

      </div>

      <Footer />
    </>
  )
}
