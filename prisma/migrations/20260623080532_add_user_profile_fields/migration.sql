-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `location` VARCHAR(120) NULL,
    ADD COLUMN `phone` VARCHAR(20) NULL;
