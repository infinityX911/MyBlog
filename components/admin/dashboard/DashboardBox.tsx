'use client';

/**
 * DashboardBox.tsx
 *
 * A single stat card. Self-fetches its own metric from
 * /api/admin/dashboard-stats?metric=&range= and lets the ⋮ menu switch the
 * time range (All Time / Last Day / Week / Month / Year) — so each card's
 * number is controlled by its own menu.
 */

import { HiDotsVertical } from 'react-icons/hi';
import Button from '@mui/material/Button';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { TrendingDown } from '@mui/icons-material';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import { IoIosTimer } from 'react-icons/io';
import React, { useEffect, useState } from 'react';

type Range = 'all' | 'day' | 'week' | 'month' | 'year';
type Metric = 'posts' | 'users' | 'views' | 'roles';

interface DashboardBoxProps {
    color?: string[];
    icon?: React.ReactNode;
    grow?: boolean;
    title?: string;
    /** Which stat to load. If omitted the card shows a static value/subtitle. */
    metric?: Metric;
    value?: string | number;
    subtitle?: string;
}

const RANGE_LABEL: Record<Range, string> = {
    all: 'All Time', day: 'Last Day', week: 'Last Week', month: 'Last Month', year: 'Last Year',
};
const RANGE_OPTS: Range[] = ['all', 'day', 'week', 'month', 'year'];

function DashboardBox({ color = ['#000', '#333'], icon, grow, title = 'Total', metric, value, subtitle }: DashboardBoxProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const ITEM_HEIGHT = 48;
    const open = Boolean(anchorEl);

    const [range, setRange] = useState<Range>('all');
    const [fetched, setFetched] = useState<number | null>(null);

    // Load this card's metric whenever the range changes.
    useEffect(() => {
        if (!metric) return;
        let alive = true;
        fetch(`/api/admin/dashboard-stats?metric=${metric}&range=${range}`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (alive && d && typeof d.value === 'number') setFetched(d.value); })
            .catch(() => { /* non-critical */ });
        return () => { alive = false; };
    }, [metric, range]);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    // Value: from the fetched metric, else a static prop, else placeholder.
    const rawValue = metric ? fetched : value;
    const displayValue = rawValue == null ? '—'
        : (typeof rawValue === 'number' ? rawValue.toLocaleString() : rawValue);
    // Bottom caption: reflects the chosen range for metric cards.
    const caption = metric ? RANGE_LABEL[range] : (subtitle ?? 'All Time');

    return (
        <Button
            className="dashboardBox"
            style={{ backgroundImage: `linear-gradient(to right, ${color[0]}, ${color[1]})` }}
        >
            {/* INTENTIONAL DESIGN ELEMENT — do not "fix" this.
                The watermark is a deliberate graphic flourish, not a trend
                readout: `.dashboardBox .chart` renders it at opacity 0.1
                behind the number, so it reads as texture rather than as a
                claim about direction. Falling through to TrendingDown when
                no `grow` prop is passed is the intended default. */}
            <span className="chart">
                {grow ? <TrendingUpIcon /> : <TrendingDown />}
            </span>

            <div className="d-flex w-100 justify-content-between">
                <div className="col1">
                    <h4 className="text-white mb-0">{title}</h4>
                    <span className="text-white">{displayValue}</span>
                </div>
                <div className="ml-auto">
                    {icon && <span className="icon">{icon}</span>}
                </div>
            </div>

            <div className="d-flex align-items-center w-100 bottomEle">
                <h6 className="text-white mb-0 mt-0">{caption}</h6>
                {/* ms-auto pins the menu button to the far right of the card. */}
                <div className="toggleIcon ms-auto">
                    <span onClick={handleClick}>
                        <HiDotsVertical />
                    </span>
                    <Menu
                        id="dropdown_menu"
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleClose}
                        slotProps={{
                            list: { 'aria-labelledby': 'long-button' },
                            paper: {
                                style: {
                                    maxHeight: ITEM_HEIGHT * 4.5,
                                    width: '20ch',
                                },
                            },
                        }}
                    >
                        {RANGE_OPTS.map((r) => (
                            <MenuItem key={r} selected={r === range} onClick={() => { setRange(r); handleClose(); }}>
                                <IoIosTimer className="menuIcon" /> {RANGE_LABEL[r]}
                            </MenuItem>
                        ))}
                    </Menu>
                </div>
            </div>
        </Button>
    );
}

export default DashboardBox;
