'use client';

/**
 * PopularClients.tsx
 * Converted from: component/RecentActivitiesAndPopularClients/PopularClients.js
 *
 * Only change: `import Profile1 from "../../assets/profile1.webp"`
 *           → src="/assets/profile1.webp"  (Next.js /public/assets/ folder)
 * Everything else — JSX, MUI, classNames — identical
 */

import React, { useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import IconButton from '@mui/material/IconButton';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import EditIcon from '@mui/icons-material/Edit';
import ListItemText from '@mui/material/ListItemText';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ChatIcon from '@mui/icons-material/Chat';
import VisibilityIcon from '@mui/icons-material/Visibility';

function PopularClients() {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    // Reusable client row — avoids repeating JSX 7 times
    const ClientRow = () => (
        <Row>
            <Col xs={3} sm={3} md={3} lg={3} xl={3} className="PoppulartableData">
                <div className="mc-table-profile">
                    {/* CHANGED: import Profile1 → /assets/profile1.webp */}
                    <img src="/assets/profile1.webp" alt="img" />
                    <p className="para">UMAIR ALI</p>
                </div>
            </Col>
            <Col xs={3} sm={3} md={3} lg={3} xl={3} className="PoppulartableData para">648</Col>
            <Col xs={3} sm={3} md={3} lg={3} xl={3} className="PoppulartableData para">$5500</Col>
            <Col xs={3} sm={3} md={3} lg={3} xl={3} className="PoppulartableData">
                <div className="mc-table-action">
                    <IconButton className="chat" style={{ background: '#ddfbe9', color: '#1a9f53' }} title="Chat">
                        <ChatIcon fontSize="small" />
                    </IconButton>
                    <IconButton className="view" title="View" style={{ background: '#fbe5ff', color: '#be0ee1' }}>
                        <VisibilityIcon fontSize="small" />
                    </IconButton>
                </div>
            </Col>
        </Row>
    );

    return (
        <Container fluid className="activity-scroll-container" style={{ height: '452px' }}>
            <Row style={{ marginBottom: '5px' }}>
                <Col xs={6} sm={6} md={6} lg={6} xl={6}>
                    <h4 className="hd">Popular Clients</h4>
                </Col>
                <Col xs={6} sm={6} md={6} lg={6} xl={6}>
                    <div className="text-lg-end text-md-end text-sm-end text-xl-end" style={{ textAlign: 'right' }}>
                        <IconButton onClick={handleClick} className="OptionClick" style={{ padding: '5px' }}>
                            <MoreHorizIcon />
                        </IconButton>
                        <Menu
                            anchorEl={anchorEl}
                            open={open}
                            onClose={handleClose}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        >
                            <MenuItem onClick={handleClose}>
                                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Edit</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={handleClose}>
                                <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Delete</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={handleClose}>
                                <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Downloads</ListItemText>
                            </MenuItem>
                        </Menu>
                    </div>
                </Col>
            </Row>

            {/* Scroll horizontally on narrow screens instead of wrapping cols. */}
            <div className="pc-table-scroll">
                <div className="pc-table-inner">
                    {/* Table headings */}
                    <Row>
                        <Col xs={3} sm={3} md={3} lg={3} xl={3} className="PoppulartableHeading">clients</Col>
                        <Col xs={3} sm={3} md={3} lg={3} xl={3} className="PoppulartableHeading">Orders</Col>
                        <Col xs={3} sm={3} md={3} lg={3} xl={3} className="PoppulartableHeading">amount</Col>
                        <Col xs={3} sm={3} md={3} lg={3} xl={3} className="PoppulartableHeading">action</Col>
                    </Row>

                    {/* 7 client rows — identical to original */}
                    <ClientRow />
                    <ClientRow />
                    <ClientRow />
                    <ClientRow />
                    <ClientRow />
                    <ClientRow />
                    <ClientRow />
                </div>
            </div>
        </Container>
    );
}

export default PopularClients;
