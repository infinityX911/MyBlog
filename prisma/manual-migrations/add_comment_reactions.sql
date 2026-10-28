-- Comment likes/hearts. Prefer `npx prisma migrate dev`.

CREATE TABLE `comment_reactions` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `comment_id` INT NOT NULL,
  `user_id`    INT NOT NULL,
  `type`       VARCHAR(10) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `comment_reactions_comment_id_user_id_type_key` (`comment_id`, `user_id`, `type`),
  INDEX `comment_reactions_comment_id_idx` (`comment_id`),
  CONSTRAINT `comment_reactions_comment_id_fkey`
    FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `comment_reactions_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
