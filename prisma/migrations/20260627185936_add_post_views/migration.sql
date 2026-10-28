-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- CreateTable
CREATE TABLE `post_views` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `post_id` INTEGER NOT NULL,
    `visitor_hash` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `post_views_post_id_idx`(`post_id`),
    INDEX `post_views_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `posts_status_published_at_idx` ON `posts`(`status`, `published_at`);

-- CreateIndex
CREATE INDEX `posts_view_count_idx` ON `posts`(`view_count`);

-- CreateIndex
CREATE INDEX `posts_featured_idx` ON `posts`(`featured`);

-- AddForeignKey
ALTER TABLE `post_views` ADD CONSTRAINT `post_views_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
