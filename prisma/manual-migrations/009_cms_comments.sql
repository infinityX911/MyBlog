-- Allow comments on CMS pages (in addition to posts + downloads).
ALTER TABLE `comments` ADD COLUMN `cms_page_id` INT NULL;
ALTER TABLE `comments` ADD CONSTRAINT `comments_cms_page_id_fkey`
  FOREIGN KEY (`cms_page_id`) REFERENCES `cms_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX `comments_cms_page_id_status_idx` ON `comments`(`cms_page_id`, `status`);
