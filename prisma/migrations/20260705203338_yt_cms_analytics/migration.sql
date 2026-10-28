-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- CreateTable
CREATE TABLE `cms_pages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `site_key` VARCHAR(50) NOT NULL DEFAULT 'yt',
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `seo_score` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `cms_pages_site_key_status_idx`(`site_key`, `status`),
    UNIQUE INDEX `cms_pages_site_key_slug_key`(`site_key`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cms_page_seo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cms_page_id` INTEGER NOT NULL,
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

    UNIQUE INDEX `cms_page_seo_cms_page_id_key`(`cms_page_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `download_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `site_key` VARCHAR(50) NOT NULL DEFAULT 'yt',
    `video_id` VARCHAR(20) NOT NULL,
    `video_title` VARCHAR(191) NULL,
    `ext` VARCHAR(10) NOT NULL,
    `quality` VARCHAR(20) NOT NULL,
    `category` VARCHAR(10) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `download_logs_site_key_created_at_idx`(`site_key`, `created_at`),
    INDEX `download_logs_ext_idx`(`ext`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cms_page_seo` ADD CONSTRAINT `cms_page_seo_cms_page_id_fkey` FOREIGN KEY (`cms_page_id`) REFERENCES `cms_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
