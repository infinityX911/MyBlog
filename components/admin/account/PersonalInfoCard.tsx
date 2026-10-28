/**
 * components/admin/account/PersonalInfoCard.tsx
 *
 * Server Component — no client state needed.
 * Data-driven: pass an array of info rows.
 * Reusable anywhere in the admin panel.
 */

interface InfoRow {
    icon: string;        // Bootstrap Icons class, e.g. 'bi-person-fill'
    label: string;
    value: string;
    isPrimary?: boolean; // blue text (e.g. role)
}

interface PersonalInfoCardProps {
    title?: string;
    rows: InfoRow[];
}

export default function PersonalInfoCard({
    title = 'Personal Information',
    rows,
}: PersonalInfoCardProps) {
    return (
        <aside className="info-card" aria-label={title}>
            <div className="info-card-header">
                <h5>
                    <i className="bi bi-person-lines-fill me-2" aria-hidden="true" />
                    {title}
                </h5>
            </div>

            <div className="info-card-body">
                {rows.map((row) => (
                    <dl key={row.label} className="info-row">
                        <dt className="visually-hidden">{row.label}</dt>

                        <div className="info-row-icon" aria-hidden="true">
                            <i className={`bi ${row.icon}`} />
                        </div>

                        <div className="info-row-text">
                            <span className="info-lbl">{row.label}</span>
                            <span className={`info-val${row.isPrimary ? ' primary' : ''}`}>
                                {row.value || '—'}
                            </span>
                        </div>
                    </dl>
                ))}
            </div>
        </aside>
    );
}
