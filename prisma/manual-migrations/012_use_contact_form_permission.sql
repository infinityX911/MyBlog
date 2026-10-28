-- 012_use_contact_form_permission.sql
-- Adds a `use-contact-form` permission. Logged-in users need it to use the
-- public /contact form. Remove it from a role to block that role.

INSERT INTO permissions (name, slug, created_at, updated_at)
SELECT 'Use Contact Form', 'use-contact-form', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE slug = 'use-contact-form');

-- Grant to all logged-in roles by default (everyone except guest)
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug = 'use-contact-form'
WHERE r.slug <> 'guest'
  AND NOT EXISTS (
    SELECT 1 FROM roles_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
