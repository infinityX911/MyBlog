-- Downloads get a rich content body (for a full detail page + better SEO).
ALTER TABLE `downloads` ADD COLUMN `content` LONGTEXT NULL;
