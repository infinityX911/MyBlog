-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- CreateTable
CREATE TABLE `redirects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `from_path` VARCHAR(255) NOT NULL,
    `to_path` VARCHAR(255) NOT NULL,
    `status_code` INTEGER NOT NULL DEFAULT 308,
    `hits` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `redirects_from_path_key`(`from_path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
