-- 010_site_type.sql
-- Adds a `site_type` column to site_settings so each site can be tagged
-- (portfolio | blog | downloader | custom). Used by the Settings > Sites tab.
ALTER TABLE site_settings
    ADD COLUMN site_type VARCHAR(50) NULL DEFAULT 'custom';

-- Backfill the two built-in sites
UPDATE site_settings SET site_type = 'portfolio' WHERE site_key = 'portfolio';
UPDATE site_settings SET site_type = 'blog'      WHERE site_key = 'blog';
