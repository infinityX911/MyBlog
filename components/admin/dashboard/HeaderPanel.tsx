'use client';

/**
 * HeaderPanel.tsx
 * Converted from: component/HeaderPanel/HeaderPanel.js
 *
 * Only change: `Link` from react-router-dom → `Link` from next/link
 * CSS is now imported in layout.tsx (admin.css already includes it)
 */

import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Link from 'next/link';

interface Breadcrumb {
    label: string;
    path: string;
}

interface HeaderPanelProps {
    title?: string;
    breadcrumbs?: Breadcrumb[];
}

const HeaderPanel = ({ title, breadcrumbs = [] }: HeaderPanelProps) => {
    const pageTitle = title || breadcrumbs[breadcrumbs.length - 1]?.label || 'Admin Panel';

    const renderBreadcrumbs = () => {
        if (!breadcrumbs.length) return null;

        return (
            <nav aria-label="breadcrumb">
                {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    return (
                        <span key={index}>
                            {isLast ? (
                                <span className="breadcrumb-current">{crumb.label}</span>
                            ) : (
                                <>
                                    {/* CHANGED: <Link to=...> → <Link href=...> */}
                                    <Link href={crumb.path} className="breadcrumb-link">
                                        {crumb.label}
                                    </Link>
                                    <span className="breadcrumb-separator"> / </span>
                                </>
                            )}
                        </span>
                    );
                })}
            </nav>
        );
    };

    return (
        <div className="card shadow border-0 p-3 mt-1">
            <Container fluid>
                <Row className="align-items-center">
                    <Col xs={12} md={6}>
                        <h3 className="hd mb-2 mb-md-0">{pageTitle}</h3>
                    </Col>
                    <Col xs={12} md={6} style={{ textAlign: 'right' }}>
                        {renderBreadcrumbs()}
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default HeaderPanel;
