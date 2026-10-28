-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `posts` ADD COLUMN `view_count` INTEGER NOT NULL DEFAULT 0;
