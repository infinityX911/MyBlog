-- Manual migration (fallback if you prefer raw SQL over `prisma migrate dev`).
-- Adds: cms_pages, cms_page_seo, download_logs. Safe/additive — no existing
-- table is touched. Run against the yt/blog database.

CREATE TABLE IF NOT EXISTS `cms_pages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `site_key` VARCHAR(50) NOT NULL DEFAULT 'yt',
  `slug` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `seo_score` INT NULL,
  `published_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `cms_pages_site_key_slug_key` (`site_key`, `slug`),
  INDEX `cms_pages_site_key_status_idx` (`site_key`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cms_page_seo` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cms_page_id` INT NOT NULL,
  `focus_keyword` VARCHAR(191) NULL,
  `meta_title` VARCHAR(191) NULL,
  `meta_description` TEXT NULL,
  `robots_index` BOOLEAN NOT NULL DEFAULT true,
  `robots_follow` BOOLEAN NOT NULL DEFAULT true,
  `canonical_url` VARCHAR(191) NULL,
  `og_title` VARCHAR(191) NULL,
  `og_description` TEXT NULL,
  `og_image` VARCHAR(191) NULL,
  `twitter_title` VARCHAR(191) NULL,
  `twitter_description` TEXT NULL,
  `schema_type` VARCHAR(191) NULL DEFAULT 'WebPage',
  `schema_json` LONGTEXT NULL,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `cms_page_seo_cms_page_id_key` (`cms_page_id`),
  CONSTRAINT `cms_page_seo_cms_page_id_fkey` FOREIGN KEY (`cms_page_id`)
    REFERENCES `cms_pages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `download_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `site_key` VARCHAR(50) NOT NULL DEFAULT 'yt',
  `video_id` VARCHAR(20) NOT NULL,
  `video_title` VARCHAR(191) NULL,
  `ext` VARCHAR(10) NOT NULL,
  `quality` VARCHAR(20) NOT NULL,
  `category` VARCHAR(10) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `download_logs_site_key_created_at_idx` (`site_key`, `created_at`),
  INDEX `download_logs_ext_idx` (`ext`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
