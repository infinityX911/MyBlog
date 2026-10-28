/**
 * components/admin/account/RolesPermissionsCard.tsx
 *
 * Read-only display of the signed-in user's actual roles and the
 * effective permissions granted to them (role-derived + direct, deduped
 * server-side in /api/user/profile).
 *
 * This is intentionally NON-editable: a user must never be able to change
 * their own access level from the self-service account page. Editing happens
 * only on the permission-gated Management pages.
 */

interface NamedSlug {
    name: string;
    slug: string;
}

interface RolesPermissionsCardProps {
    roles: NamedSlug[];
    permissions: NamedSlug[];
}

export default function RolesPermissionsCard({
    roles,
    permissions,
}: RolesPermissionsCardProps) {
    return (
        <section className="rbac-card" aria-label="Roles and permissions">
            <div className="rbac-card-header">
                <h5>
                    <i className="bi bi-shield-lock-fill me-2" aria-hidden="true" />
                    Roles &amp; Permissions
                </h5>
                <span className="rbac-readonly-tag">
                    <i className="bi bi-eye-fill me-1" aria-hidden="true" />
                    Read-only
                </span>
            </div>

            <div className="rbac-card-body">
                {/* ── Roles ─────────────────────────────────── */}
                <div className="rbac-group">
                    <h6 className="rbac-group-title">
                        Assigned Roles
                        <span className="rbac-count">{roles.length}</span>
                    </h6>
                    {roles.length === 0 ? (
                        <p className="rbac-empty">No roles assigned.</p>
                    ) : (
                        <ul className="rbac-chip-list" aria-label="Assigned roles">
                            {roles.map((r) => (
                                <li key={r.slug} className="rbac-chip rbac-chip-role">
                                    <i className="bi bi-person-badge-fill" aria-hidden="true" />
                                    {r.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* ── Permissions ───────────────────────────── */}
                <div className="rbac-group">
                    <h6 className="rbac-group-title">
                        Effective Permissions
                        <span className="rbac-count">{permissions.length}</span>
                    </h6>
                    {permissions.length === 0 ? (
                        <p className="rbac-empty">No permissions granted.</p>
                    ) : (
                        <ul className="rbac-chip-list" aria-label="Effective permissions">
                            {permissions.map((p) => (
                                <li key={p.slug} className="rbac-chip rbac-chip-perm">
                                    <i className="bi bi-check-circle-fill" aria-hidden="true" />
                                    {p.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}
