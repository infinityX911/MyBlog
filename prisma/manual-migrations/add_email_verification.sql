-- Email verification on signup. Prefer `npx prisma migrate dev`.

ALTER TABLE `users`
  ADD COLUMN `email_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_trusted`,
  ADD COLUMN `verify_token`   VARCHAR(255) NULL,
  ADD COLUMN `verify_expires` DATETIME(3)  NULL;

-- Existing users are considered already verified so they aren't locked out.
UPDATE `users` SET `email_verified` = 1;
