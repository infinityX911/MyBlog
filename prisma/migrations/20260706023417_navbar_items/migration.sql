-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- CreateTable
CREATE TABLE `nav_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `site_key` VARCHAR(50) NOT NULL DEFAULT 'blog',
    `label` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL DEFAULT '#',
    `icon` VARCHAR(16) NULL,
    `parent_id` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `nav_items_site_key_parent_id_sort_order_idx`(`site_key`, `parent_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `nav_items` ADD CONSTRAINT `nav_items_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `nav_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
