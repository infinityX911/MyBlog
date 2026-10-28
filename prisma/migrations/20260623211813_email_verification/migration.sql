-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `email_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `verify_expires` DATETIME(3) NULL,
    ADD COLUMN `verify_token` VARCHAR(255) NULL;
