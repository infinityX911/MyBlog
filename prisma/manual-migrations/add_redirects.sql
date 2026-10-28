-- Slug-change 301/308 redirects. Use `npx prisma migrate dev` instead if possible.

CREATE TABLE `redirects` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `from_path`   VARCHAR(255) NOT NULL,
  `to_path`     VARCHAR(255) NOT NULL,
  `status_code` INT NOT NULL DEFAULT 308,
  `hits`        INT NOT NULL DEFAULT 0,
  `created_at`  DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `redirects_from_path_key` (`from_path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
