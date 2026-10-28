-- CreateTable
CREATE TABLE `posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `excerpt` TEXT NULL,
    `featured_image` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `author_id` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `posts_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_seo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `post_id` INTEGER NOT NULL,
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
    `schema_type` VARCHAR(191) NULL,
    `schema_json` LONGTEXT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `post_seo_post_id_key`(`post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `site_key` VARCHAR(191) NOT NULL,
    `site_name` VARCHAR(191) NOT NULL,
    `tagline` VARCHAR(191) NULL,
    `email_address` VARCHAR(191) NULL,
    `website_url` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `default_meta_title` VARCHAR(191) NULL,
    `default_meta_description` TEXT NULL,
    `title_separator` VARCHAR(191) NULL DEFAULT '|',
    `default_robots_index` BOOLEAN NOT NULL DEFAULT true,
    `default_robots_follow` BOOLEAN NOT NULL DEFAULT true,
    `og_image` VARCHAR(191) NULL,
    `sitemap_enabled` BOOLEAN NOT NULL DEFAULT true,
    `notify_on_register` BOOLEAN NOT NULL DEFAULT true,
    `registration_enabled` BOOLEAN NOT NULL DEFAULT true,
    `direct_message_notify` BOOLEAN NOT NULL DEFAULT false,
    `membership_approval` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `site_settings_site_key_key`(`site_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `page_seo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `site_setting_id` INTEGER NOT NULL,
    `page_slug` VARCHAR(191) NOT NULL,
    `page_label` VARCHAR(191) NOT NULL,
    `meta_title` VARCHAR(191) NULL,
    `meta_description` TEXT NULL,
    `robots_index` BOOLEAN NOT NULL DEFAULT true,
    `robots_follow` BOOLEAN NOT NULL DEFAULT true,
    `canonical_url` VARCHAR(191) NULL,
    `og_title` VARCHAR(191) NULL,
    `og_description` TEXT NULL,
    `og_image` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `page_seo_site_setting_id_page_slug_key`(`site_setting_id`, `page_slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `post_seo` ADD CONSTRAINT `post_seo_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_seo` ADD CONSTRAINT `page_seo_site_setting_id_fkey` FOREIGN KEY (`site_setting_id`) REFERENCES `site_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
