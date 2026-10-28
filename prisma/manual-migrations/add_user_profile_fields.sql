-- Adds profile fields (phone, bio, location) to the users table.
-- Run this ONLY if you are applying the change manually instead of using
-- `npx prisma migrate dev`. Safe to re-run? No — guard with IF NOT EXISTS
-- where your MySQL/MariaDB version supports it.

ALTER TABLE `users`
  ADD COLUMN `phone`    VARCHAR(20)  NULL AFTER `avatar_url`,
  ADD COLUMN `bio`      TEXT         NULL AFTER `phone`,
  ADD COLUMN `location` VARCHAR(120) NULL AFTER `bio`;
