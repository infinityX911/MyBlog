-- Phase 2: account fields + activity log.
-- Use `npx prisma migrate dev` instead if possible; this is a manual fallback.

ALTER TABLE `users`
  ADD COLUMN `username`  VARCHAR(50)  NULL AFTER `password`,
  ADD COLUMN `status`    VARCHAR(20)  NOT NULL DEFAULT 'pending' AFTER `location`,
  ADD COLUMN `facebook`  VARCHAR(255) NULL,
  ADD COLUMN `twitter`   VARCHAR(255) NULL,
  ADD COLUMN `linkedin`  VARCHAR(255) NULL,
  ADD COLUMN `instagram` VARCHAR(255) NULL,
  ADD COLUMN `youtube`   VARCHAR(255) NULL,
  ADD COLUMN `pinterest` VARCHAR(255) NULL,
  ADD COLUMN `email_activity_connection` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `email_activity_message`    TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `email_product_connection`  TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `email_product_message`     TINYINT(1) NOT NULL DEFAULT 0,
  MODIFY COLUMN `location` VARCHAR(160) NULL;

ALTER TABLE `users`
  ADD UNIQUE INDEX `users_username_key` (`username`);

-- Branding / extra SEO fields on site_settings
ALTER TABLE `site_settings`
  ADD COLUMN `site_icon`      VARCHAR(255) NULL,
  ADD COLUMN `theme_color`    VARCHAR(40)  NULL DEFAULT '#5b4fcf',
  ADD COLUMN `meta_keywords`  TEXT         NULL,
  ADD COLUMN `twitter_handle` VARCHAR(120) NULL;

CREATE TABLE `notification_icons` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `type_key`   VARCHAR(60)  NOT NULL,
  `label`      VARCHAR(120) NOT NULL,
  `icon`       VARCHAR(60)  NOT NULL,
  `color`      VARCHAR(40)  NOT NULL,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `notification_icons_type_key_key` (`type_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `activities` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `user_id`       INT NULL,
  `actor_user_id` INT NULL,
  `type`          VARCHAR(60)  NOT NULL,
  `action`        VARCHAR(160) NOT NULL,
  `description`   TEXT NULL,
  `link`          VARCHAR(255) NULL,
  `meta`          LONGTEXT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `activities_user_id_idx` (`user_id`),
  INDEX `activities_actor_user_id_idx` (`actor_user_id`),
  INDEX `activities_created_at_idx` (`created_at`),
  CONSTRAINT `activities_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `activities_actor_user_id_fkey`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
