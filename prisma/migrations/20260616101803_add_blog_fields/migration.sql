-- AlterTable
ALTER TABLE `categories` ADD COLUMN `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `posts` ADD COLUMN `featured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `read_min` INTEGER NULL DEFAULT 5;
