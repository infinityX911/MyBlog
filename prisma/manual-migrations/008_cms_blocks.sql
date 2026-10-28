-- Block-based pages: store an ordered JSON array of blocks per CMS page.
ALTER TABLE `cms_pages` ADD COLUMN `blocks` LONGTEXT NULL;
