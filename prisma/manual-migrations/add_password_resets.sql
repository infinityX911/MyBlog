-- Password reset (email link + OTP). Prefer `npx prisma migrate dev`.

CREATE TABLE `password_resets` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `user_id`    INT NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `code_hash`  VARCHAR(255) NULL,
  `channel`    VARCHAR(20)  NOT NULL DEFAULT 'email',
  `expires_at` DATETIME(3) NOT NULL,
  `used_at`    DATETIME(3) NULL,
  `attempts`   INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `password_resets_user_id_idx` (`user_id`),
  CONSTRAINT `password_resets_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
