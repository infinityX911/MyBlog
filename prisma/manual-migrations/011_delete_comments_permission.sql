-- 011_delete_comments_permission.sql
-- Adds a `delete-comments` permission (moderation: delete ANY comment).
-- Comment owners can always delete their own comment regardless of this.
-- Admins already work via `access-admin-panel`; assign this to a Moderator/
-- Editor role to let non-admins moderate too.

INSERT INTO permissions (name, slug, created_at, updated_at)
SELECT 'Delete Comments', 'delete-comments', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE slug = 'delete-comments');

-- Assign to the Administrator role (change 'administrator' to any role slug you want)
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug = 'delete-comments'
WHERE r.slug = 'administrator'
  AND NOT EXISTS (
    SELECT 1 FROM roles_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
