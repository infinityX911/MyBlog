-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- AlterTable
ALTER TABLE `site_settings` ADD COLUMN `site_type` VARCHAR(50) NULL DEFAULT 'custom';
