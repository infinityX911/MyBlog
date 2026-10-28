-- 014_subscribers.sql
CREATE TABLE IF NOT EXISTS subscribers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE,
  email         VARCHAR(191) NOT NULL,
  wants_email   TINYINT(1) NOT NULL DEFAULT 1,
  wants_push    TINYINT(1) NOT NULL DEFAULT 1,
  push_endpoint TEXT NULL,
  push_keys     TEXT NULL,
  created_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscribers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
