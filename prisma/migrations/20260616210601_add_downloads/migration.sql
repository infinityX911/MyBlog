-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- CreateTable
CREATE TABLE `downloads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `excerpt` TEXT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NOT NULL DEFAULT 'PDF',
    `file_size` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL DEFAULT '📄',
    `gradient` VARCHAR(191) NULL DEFAULT 'gradientPurple',
    `category` VARCHAR(191) NULL DEFAULT 'Tech',
    `tags` TEXT NULL,
    `download_count` INTEGER NOT NULL DEFAULT 0,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `free` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `author_id` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `downloads_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `download_seo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `download_id` INTEGER NOT NULL,
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

    UNIQUE INDEX `download_seo_download_id_key`(`download_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `download_seo` ADD CONSTRAINT `download_seo_download_id_fkey` FOREIGN KEY (`download_id`) REFERENCES `downloads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
