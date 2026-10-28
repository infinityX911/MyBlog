-- Allow comments on downloads (in addition to posts).
ALTER TABLE `comments` MODIFY COLUMN `post_id` INT NULL;
ALTER TABLE `comments` ADD COLUMN `download_id` INT NULL;
ALTER TABLE `comments` ADD CONSTRAINT `comments_download_id_fkey`
  FOREIGN KEY (`download_id`) REFERENCES `downloads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX `comments_download_id_status_idx` ON `comments`(`download_id`, `status`);
