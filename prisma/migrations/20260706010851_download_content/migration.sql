-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` ADD COLUMN `content` LONGTEXT NULL,
    MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';
