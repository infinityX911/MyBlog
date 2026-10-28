'use client';

/**
 * DataTable.tsx
 * Converted from: component/DataTable/DataTable.js
 *
 * Changes:
 *  - 'use client' added
 *  - Link from react-router-dom -> Link from next/link (to= -> href=)
 *  - CSS import path removed (admin.css handles it globally)
 *  - TypeScript types added
 */

import { Col, Container, Row } from 'react-bootstrap';
import React, { useEffect, useRef, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { Pagination } from '@/components/admin/datatable/Pagination';
import Link from 'next/link'; // CHANGED: from react-router-dom

interface Column {
    key: string;
    label: string;
    render?: (value: any, row: any) => React.ReactNode;
}

interface Action {
    icon: React.ReactNode;
    to?: string | ((row: any) => string);
    onClick?: (row: any) => void;
    className?: string;
    label?: string;
}

interface DataTableProps {
    title?: string;
    data?: any[];
    columns?: Column[];
    filters?: Record<string, string[]>;
    rowsPerPageOptions?: number[];
    actions?: Action[];
    onBulkDelete?: (rows: any[]) => void | Promise<void>;
}

const DataTable = ({
    title = 'best selling products',
    data = [],
    columns = [],
    filters = {},
    rowsPerPageOptions = [10, 20, 30],
    actions = [],
    onBulkDelete,
}: DataTableProps) => {
    const tableRef = useRef<HTMLTableElement>(null);

    // Column resizer
    useEffect(() => {
        const table = tableRef.current;
        if (!table) return;

        const cols = table.querySelectorAll('th');
        cols.forEach((col) => {
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            col.appendChild(resizer);

            resizer.addEventListener('mousedown', initResize);

            function initResize(e: MouseEvent) {
                window.addEventListener('mousemove', resize);
                window.addEventListener('mouseup', stopResize);

                const startX = e.clientX;
                const startWidth = col.offsetWidth;

                function resize(e: MouseEvent) {
                    const minWidth = 100;
                    let newWidth = startWidth + (e.clientX - startX);
                    if (newWidth < minWidth) newWidth = minWidth;
                    col.style.width = newWidth + 'px';
                }

                function stopResize() {
                    window.removeEventListener('mousemove', resize);
                    window.removeEventListener('mouseup', stopResize);
                }
            }
        });
    }, [columns]);

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterState, setFilterState] = useState<Record<string, string>>(
        Object.keys(filters).reduce((acc, key) => ({ ...acc, [key]: '' }), {})
    );
    const [selectedRows, setSelectedRows] = useState<number[]>([]);

    const filteredData = data.filter((item) => {
        const matchesFilters = Object.keys(filterState).every((key) => {
            const filterVal = filterState[key];
            if (!filterVal) return true;
            const cellVal = (item[key] ?? '').toString().toLowerCase();
            return cellVal.includes(filterVal.toString().toLowerCase());
        });
        const matchesSearch = searchQuery
            ? Object.values(item).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
            : true;
        return matchesFilters && matchesSearch;
    });

    const indexOfLastItem = currentPage * rowsPerPage;
    const indexOfFirstItem = indexOfLastItem - rowsPerPage;
    const paginatedData = filteredData.slice(indexOfFirstItem, indexOfLastItem);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedRows(paginatedData.map((item) => item.id));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (id: number) => {
        setSelectedRows((prev) =>
            prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
        );
    };

    const isAllSelected = selectedRows.length === paginatedData.length;
    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    // ── Card-menu actions (self-contained, work for any table that uses this
    //    reusable component without the caller passing extra props) ────────────
    const exportCsv = () => {
        handleClose();
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const headerRow = ['ID', ...columns.map(c => c.label)].map(esc).join(',');
        const bodyRows = filteredData.map(row =>
            [esc(row.id), ...columns.map(c => esc(row[c.key]))].join(',')
        );
        const csv = [headerRow, ...bodyRows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const printTable = () => { handleClose(); window.print(); };
    const clearSelection = () => { handleClose(); setSelectedRows([]); };
    const handleBulkDelete = async () => {
        handleClose();
        if (!onBulkDelete || selectedRows.length === 0) return;
        if (!window.confirm(`Delete ${selectedRows.length} selected item(s)? This cannot be undone.`)) return;
        // selectedRows holds row IDs — resolve them to full row objects so the
        // caller can read row.id / row.slug etc.
        const rowsToDelete = (data ?? []).filter((r: any) => selectedRows.includes(r.id));
        await onBulkDelete(rowsToDelete);
        setSelectedRows([]);
    };

    useEffect(() => setCurrentPage(1), [filterState, searchQuery, rowsPerPage]);

    return (
        <Container fluid>
            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <Container fluid>
                            {/* Header */}
                            <Row>
                                <Col xs={6}>
                                    <h3 className="hd">{title}</h3>
                                </Col>
                                <Col xs={6} style={{ textAlign: 'right' }}>
                                    <IconButton onClick={handleClick} disableRipple style={{ padding: '5px', background: 'transparent' }} sx={{ '&:hover': { background: 'transparent' } }}>
                                        <MoreHorizIcon />
                                    </IconButton>
                                    <Menu
                                        anchorEl={anchorEl}
                                        open={open}
                                        onClose={handleClose}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                    >
                                        <MenuItem onClick={exportCsv}>
                                            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText>Export (CSV)</ListItemText>
                                        </MenuItem>
                                        <MenuItem onClick={printTable}>
                                            <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText>Print</ListItemText>
                                        </MenuItem>
                                        {onBulkDelete && selectedRows.length > 0 && (
                                            <MenuItem onClick={handleBulkDelete}>
                                                <ListItemIcon><DeleteForeverIcon fontSize="small" style={{ color: '#dc3545' }} /></ListItemIcon>
                                                <ListItemText style={{ color: '#dc3545' }}>Delete selected ({selectedRows.length})</ListItemText>
                                            </MenuItem>
                                        )}
                                        {selectedRows.length > 0 && (
                                            <MenuItem onClick={clearSelection}>
                                                <ListItemIcon><ClearAllIcon fontSize="small" /></ListItemIcon>
                                                <ListItemText>Clear selection ({selectedRows.length})</ListItemText>
                                            </MenuItem>
                                        )}
                                    </Menu>
                                </Col>
                            </Row>

                            {/* Filters */}
                            <Row>
                                <Col xs={12} sm={6} md={6} lg={6} xl={3}>
                                    <div className="mc-label-field-group label-col">
                                        <label className="mc-label-field-title para">show by</label>
                                        <select
                                            className="mc-label-field-select mb-4 w-100 h-md"
                                            onChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
                                            value={rowsPerPage}
                                        >
                                            {rowsPerPageOptions.map((opt) => (
                                                <option key={opt} value={opt}>{opt} row</option>
                                            ))}
                                        </select>
                                    </div>
                                </Col>

                                {Object.keys(filters).map((key) => (
                                    <Col xs={12} sm={6} md={6} lg={6} xl={3} key={key}>
                                        <div className="mc-label-field-group label-col">
                                            <label className="mc-label-field-title para">
                                                {key.replace(/_/g, ' ')} by
                                            </label>
                                            <select
                                                className="mc-label-field-select mb-4 w-100 h-md"
                                                onChange={(e) => setFilterState({ ...filterState, [key]: e.target.value })}
                                                value={filterState[key]}
                                            >
                                                <option value="">All {key.replace(/_/g, ' ')}</option>
                                                {filters[key].map((val) => (
                                                    <option key={val} value={val}>{val}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </Col>
                                ))}

                                <Col xs={12} sm={6} md={6} lg={6} xl={3}>
                                    <div className="mc-label-field-group label-col">
                                        <label className="mc-label-field-title para">search by</label>
                                        <input
                                            type="search"
                                            placeholder="search..."
                                            className="mc-label-field-input mb-4 w-100 h-md"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </Col>
                            </Row>

                            {/* Table */}
                            <Row>
                                <Col xs={12}>
                                    <div className="resizable-table-container">
                                        <table className="resizable-table" ref={tableRef}>
                                            <thead>
                                                <tr>
                                                    <th>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} />
                                                            <span>ID</span>
                                                        </div>
                                                    </th>
                                                    {columns.map((col) => (
                                                        <th key={col.key}>{col.label}</th>
                                                    ))}
                                                    {actions.length > 0 && <th>Action</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedData.map((item) => (
                                                    <tr key={item.id}>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedRows.includes(item.id)}
                                                                    onChange={() => handleSelectRow(item.id)}
                                                                />
                                                                <span>#{item.id}</span>
                                                            </div>
                                                        </td>
                                                        {columns.map((col) => (
                                                            <td key={col.key}>
                                                                {col.render ? col.render(item[col.key], item) : item[col.key]}
                                                            </td>
                                                        ))}
                                                        {actions.length > 0 && (
                                                            <td>
                                                                <div className="action-buttons">
                                                                    {actions.map((action, idx) => {
                                                                        const to = typeof action.to === 'function' ? action.to(item) : action.to;
                                                                        if (to) {
                                                                            return (
                                                                                <Link
                                                                                    key={action.className || idx}
                                                                                    href={to}
                                                                                    className={`btn-icon ${action.className || ''}`}
                                                                                    style={{ color: 'blue', textDecoration: 'none' }}
                                                                                >
                                                                                    {action.icon}
                                                                                    {action.label && <span>{action.label}</span>}
                                                                                </Link>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <button
                                                                                key={action.className || idx}
                                                                                className={`btn-icon ${action.className || ''}`}
                                                                                onClick={() => action.onClick && action.onClick(item)}
                                                                            >
                                                                                {action.icon}
                                                                                {action.label && <span>{action.label}</span>}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Col>
                                <Col xs={12}>
                                    <div className="pagination-container">
                                        <Pagination
                                            itemsPerPage={rowsPerPage}
                                            totalItems={filteredData.length}
                                            paginate={paginate}
                                            currentPage={currentPage}
                                        />
                                    </div>
                                </Col>
                            </Row>
                        </Container>
                    </div>
                </Col>
            </Row>
        </Container>
    );
};

export default DataTable;
