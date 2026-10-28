// components/DownloadCard.tsx — shared download card (used by the Downloads
// listing page AND the CMS "Downloads grid" block, so both look identical).
import Link from 'next/link';
import type { Download } from '@/lib/downloads';
import styles from '../app/(blog)/downloads/Downloads.module.css';

function formatDownloads(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n ?? 0);
}

export default function DownloadCard({ item }: { item: Download }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardThumb}>
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className={`${styles.cardThumbGradient} ${styles[item.gradient as keyof typeof styles] ?? ''}`} />
        )}
        <span className={styles.cardThumbIcon}>{item.icon}</span>
        <span className={styles.cardBadge}>{item.fileType}</span>
        {item.free && <span className={styles.cardFreeTag}>Free</span>}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {formatDownloads(item.downloadCount)}
          </span>
          <span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            {item.fileSize}
          </span>
          <span>{item.category}</span>
          {item.date && (
            <span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {item.date}
            </span>
          )}
        </div>

        <h3 className={styles.cardTitle}><Link href={`/downloads/${item.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</Link></h3>
        <p className={styles.cardExcerpt}>{item.excerpt}</p>

        <div className={styles.cardFooter}>
          <div className={styles.cardTags}>
            {item.tags.map(t => <span key={t} className={styles.cardTag}>{t}</span>)}
          </div>
          <Link href={`/downloads/${item.slug}`} className={styles.downloadBtn}>
            Read More
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
