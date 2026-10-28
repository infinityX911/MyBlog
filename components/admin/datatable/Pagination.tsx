'use client';

import React from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface PaginationColors {
    activeBg?: string;
    activeText?: string;
    inactiveBg?: string;
    inactiveText?: string;
    hoverBg?: string;
    disabledBg?: string;
    disabledText?: string;
    ellipsisColor?: string;
}

interface PaginationProps {
    itemsPerPage: number;
    totalItems: number;
    paginate: (page: number) => void;
    currentPage: number;
    colors?: PaginationColors;
}

export function Pagination({
    itemsPerPage,
    totalItems,
    paginate,
    currentPage,
    colors = {},
}: PaginationProps) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const {
        activeBg = '#1a73e8',
        activeText = '#fff',
        inactiveBg = '#f1f1f1',
        inactiveText = '#444',
        hoverBg = '#e0e0e0',
        disabledBg = '#f9f9f9',
        disabledText = '#aaa',
        ellipsisColor = '#888',
    } = colors;

    const getPageNumbers = (): (number | string)[] => {
        let pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 3) {
                pages = [1, 2, 3, 4, '...', totalPages];
            } else if (currentPage >= totalPages - 2) {
                pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            } else {
                pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
            }
        }
        return pages;
    };

    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <Container fluid style={{ marginTop: '10px' }}>
            <Row className="d-flex align-items-center justify-content-between paginationResults">
                <Col xs={12} sm={6}>
                    <span style={{ fontSize: '14px' }}>
                        {endItem} of {totalItems} results
                    </span>
                </Col>
                <Col xs={12} sm={6}>
                    <nav>
                        <ul className="pagination m-0">
                            <li>
                                <button
                                    onClick={() => paginate(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    style={{
                                        background: currentPage === 1 ? disabledBg : inactiveBg,
                                        color: currentPage === 1 ? disabledText : inactiveText,
                                    }}
                                    onMouseOver={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.background = hoverBg; }}
                                    onMouseOut={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.background = inactiveBg; }}
                                >
                                    <FiChevronLeft size={18} />
                                </button>
                            </li>

                            {getPageNumbers().map((number, index) => (
                                <li key={index} className={number !== '...' && number === currentPage ? 'active' : ''}>
                                    {number === '...' ? (
                                        <span className="ellipsis" style={{ color: ellipsisColor, background: 'transparent' }}>
                                            {number}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => paginate(number as number)}
                                            style={{
                                                background: number === currentPage ? activeBg : inactiveBg,
                                                color: number === currentPage ? activeText : inactiveText,
                                                fontWeight: number === currentPage ? 'bold' : 'normal',
                                            }}
                                            onMouseOver={(e) => { if (number !== currentPage) e.currentTarget.style.background = hoverBg; }}
                                            onMouseOut={(e) => { if (number !== currentPage) e.currentTarget.style.background = inactiveBg; }}
                                        >
                                            {number}
                                        </button>
                                    )}
                                </li>
                            ))}

                            <li>
                                <button
                                    onClick={() => paginate(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    style={{
                                        background: currentPage === totalPages ? disabledBg : inactiveBg,
                                        color: currentPage === totalPages ? disabledText : inactiveText,
                                    }}
                                    onMouseOver={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.background = hoverBg; }}
                                    onMouseOut={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.background = inactiveBg; }}
                                >
                                    <FiChevronRight size={18} />
                                </button>
                            </li>
                        </ul>
                    </nav>
                </Col>
            </Row>
        </Container>
    );
}
