-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `comments` ADD COLUMN `cms_page_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- CreateIndex
CREATE INDEX `comments_cms_page_id_status_idx` ON `comments`(`cms_page_id`, `status`);

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_cms_page_id_fkey` FOREIGN KEY (`cms_page_id`) REFERENCES `cms_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
