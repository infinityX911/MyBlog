/**
 * app/api/admin/notifications/route.ts
 *
 * Kept as a path purely for backward compatibility — useAdminNotifications.ts
 * and AdminContext.tsx already call this URL and don't need to change.
 *
 * All the actual logic (including the view-admin-notifications permission
 * scoping) now lives in /api/notifications, since visibility is
 * permission-based rather than path-based: a regular logged-in user
 * hitting this same path just transparently gets their own-only feed.
 */

export { GET, PATCH, DELETE } from '../../notifications/route';
