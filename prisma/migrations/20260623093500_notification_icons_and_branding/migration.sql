/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `categories` MODIFY `emoji` VARCHAR(191) NULL DEFAULT '📝';

-- AlterTable
ALTER TABLE `downloads` MODIFY `icon` VARCHAR(191) NULL DEFAULT '📄';

-- AlterTable
ALTER TABLE `site_settings` ADD COLUMN `meta_keywords` TEXT NULL,
    ADD COLUMN `site_icon` VARCHAR(191) NULL,
    ADD COLUMN `theme_color` VARCHAR(191) NULL DEFAULT '#5b4fcf',
    ADD COLUMN `twitter_handle` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `email_activity_connection` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `email_activity_message` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `email_product_connection` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `email_product_message` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `facebook` VARCHAR(255) NULL,
    ADD COLUMN `instagram` VARCHAR(255) NULL,
    ADD COLUMN `linkedin` VARCHAR(255) NULL,
    ADD COLUMN `pinterest` VARCHAR(255) NULL,
    ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `twitter` VARCHAR(255) NULL,
    ADD COLUMN `username` VARCHAR(50) NULL,
    ADD COLUMN `youtube` VARCHAR(255) NULL,
    MODIFY `location` VARCHAR(160) NULL;

-- CreateTable
CREATE TABLE `activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `actor_user_id` INTEGER NULL,
    `type` VARCHAR(60) NOT NULL,
    `action` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `link` VARCHAR(255) NULL,
    `meta` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activities_user_id_idx`(`user_id`),
    INDEX `activities_actor_user_id_idx`(`actor_user_id`),
    INDEX `activities_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_icons` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_key` VARCHAR(60) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `icon` VARCHAR(60) NOT NULL,
    `color` VARCHAR(40) NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `notification_icons_type_key_key`(`type_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
