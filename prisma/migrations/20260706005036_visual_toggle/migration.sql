-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` ADD COLUMN `image` VARCHAR(500) NULL,
    MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- AlterTable
ALTER TABLE `posts` ADD COLUMN `gradient` VARCHAR(40) NULL;
