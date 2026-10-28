'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAdmin } from '@/context/AdminContext';

interface SubItem {
  label: string;
  href: string;
}

interface MenuItem {
  label: string;
  icon: string;
  href?: string;
  children?: SubItem[];
}

const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: 'bi-speedometer2',
    href: '/admin/dashboard',
  },
  {
    label: 'Permissions',
    icon: 'bi-shield-check',
    children: [
      { label: 'View Permissions', href: '/admin/permissions' },
      { label: 'Create Permission', href: '/admin/permissions/create' },
    ],
  },
  {
    label: 'Roles',
    icon: 'bi-person-badge',
    children: [
      { label: 'View Roles', href: '/admin/roles' },
      { label: 'Create Role', href: '/admin/roles/create' },
    ],
  },
  {
    label: 'Users',
    icon: 'bi-people',
    children: [
      { label: 'View Users', href: '/admin/users' },
      { label: 'Create User', href: '/admin/users/create' },
    ],
  },
  {
    label: 'Portfolio',
    icon: 'bi-briefcase',
    children: [
      { label: 'Projects', href: '/admin/portfolio/projects' },
      { label: 'Add Project', href: '/admin/portfolio/projects/create' },
      { label: 'Navbar Links', href: '/admin/portfolio/navbar' },
      { label: 'Header', href: '/admin/portfolio/headers' },
      { label: 'Testimonials', href: '/admin/portfolio/testimonials' },
      { label: 'Contact Messages', href: '/admin/portfolio/contact' },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { isToggleSidebar } = useAdmin();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => pathname === href;
  const isParentActive = (children: SubItem[]) =>
    children.some(c => pathname.startsWith(c.href));

  return (
    <div className={`sidebarWrapper ${isToggleSidebar ? 'toggle' : ''}`}>
      <div className="sidebar">
        <ul>
          {menuItems.map((item) => {
            if (item.href) {
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={`d-flex align-items-center ${isActive(item.href) ? 'active' : ''}`}
                    style={{
                      borderRadius: '10px',
                      padding: '12px 10px',
                      color: isActive(item.href) ? '#0858f7' : '#5e5d72',
                      background: isActive(item.href) ? '#ebf6ff' : 'transparent',
                      textDecoration: 'none',
                      fontWeight: 500,
                      fontSize: '15px',
                      display: 'flex',
                      width: '100%',
                      transition: 'all 0.3s ease-in-out',
                    }}
                  >
                    <span className="icon me-2">
                      <i className={`bi ${item.icon}`} style={{ fontSize: '20px' }}></i>
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            }

            const isOpen = openMenus.includes(item.label) || isParentActive(item.children || []);

            return (
              <li key={item.label}>
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={`d-flex align-items-center w-100 ${isParentActive(item.children || []) ? 'active' : ''} ${isOpen ? 'rotate' : ''}`}
                  style={{
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 10px',
                    background: isParentActive(item.children || []) ? '#ebf6ff' : 'transparent',
                    color: isParentActive(item.children || []) ? '#0858f7' : '#5e5d72',
                    fontWeight: 500,
                    fontSize: '15px',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <span className="icon me-2">
                    <i className={`bi ${item.icon}`} style={{ fontSize: '20px' }}></i>
                  </span>
                  {item.label}
                  <span className="arrow ms-auto">
                    <i className={`bi bi-chevron-right`} style={{
                      transition: 'transform 0.3s',
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      display: 'inline-block',
                    }}></i>
                  </span>
                </button>

                <div className={`submenuWrapper ${isOpen ? 'open' : ''}`}>
                  <ul className="submenu">
                    {item.children?.map(child => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={isActive(child.href) ? 'active' : ''}
                          style={{
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '6px 5px',
                            color: isActive(child.href) ? '#0858f7' : '#5e5d72',
                            fontWeight: isActive(child.href) ? 600 : 500,
                            fontSize: '14px',
                            background: isActive(child.href) ? '#ebf6ff' : 'transparent',
                            borderRadius: '4px',
                          }}
                        >
                          <span className="icon me-2">
                            <i className="bi bi-dot" style={{ fontSize: '20px' }}></i>
                          </span>
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Logout Box */}
        <div className="logoutWrapper mt-3">
          <div className="logoutBox">
            <Link
              href="/api/auth/signout"
              className="btn btn-primary btn-sm"
              style={{ zIndex: 1, position: 'relative' }}
            >
              <i className="bi bi-box-arrow-left me-1"></i>
              Logout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}