-- Dynamic navbar items (nested — supports dropdowns).
CREATE TABLE IF NOT EXISTS `nav_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `site_key` VARCHAR(50) NOT NULL DEFAULT 'blog',
  `label` VARCHAR(191) NOT NULL,
  `url` VARCHAR(191) NOT NULL DEFAULT '#',
  `icon` VARCHAR(16) NULL,
  `parent_id` INT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `visible` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `nav_items_site_key_parent_id_sort_order_idx` (`site_key`, `parent_id`, `sort_order`),
  CONSTRAINT `nav_items_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `nav_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
