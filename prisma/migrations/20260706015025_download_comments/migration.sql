-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `comments` ADD COLUMN `download_id` INTEGER NULL,
    MODIFY `post_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- CreateIndex
CREATE INDEX `comments_download_id_status_idx` ON `comments`(`download_id`, `status`);

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_download_id_fkey` FOREIGN KEY (`download_id`) REFERENCES `downloads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
