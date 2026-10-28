'use client';
import { useAdmin } from '@/context/AdminContext';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';

export default function AdminNavbar() {
  const { isToggleSidebar, setIsToggleSidebar, themeMode, setThemeMode } = useAdmin();
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <div className="container-fluid navbar-Container">
      <div className="row align-items-center h-100">

        {/* Col 1: Logo */}
        <div className="col-4 col-sm-3 col-md-3 col-lg-3 col-xl-2">
          <div className="logo-div d-flex align-items-center gap-2">
            <i className="bi bi-lightning-charge-fill text-primary fs-4"></i>
            <span>Umair</span>
          </div>
        </div>

        {/* Col 2: Toggle + Search */}
        <div className="col-3 col-sm-3 col-md-3 col-lg-3 col-xl-3">
          <div className="d-flex align-items-center gap-2">
            <button
              className="rounded-circle btn"
              onClick={() => setIsToggleSidebar(!isToggleSidebar)}
              title="Toggle Sidebar"
            >
              <i className={`bi ${isToggleSidebar ? 'bi-layout-sidebar' : 'bi-layout-sidebar-inset'} fs-5`}></i>
            </button>
            <div className="searchBox d-none d-lg-flex align-items-center gap-2">
              <i className="bi bi-search"></i>
              <input type="text" placeholder="Search here..." />
            </div>
          </div>
        </div>

        {/* Col 3: spacer */}
        <div className="col-1 d-none d-lg-block"></div>

        {/* Col 4: Icons */}
        <div className="col-5 col-sm-6 col-md-6 col-lg-5 col-xl-6">
          <div className="d-flex justify-content-end align-items-center gap-2">

            {/* Dark Mode */}
            <button
              className="rounded-circle btn darkMode"
              onClick={() => setThemeMode(!themeMode)}
              title="Toggle Theme"
            >
              <i className={`bi ${themeMode ? 'bi-sun' : 'bi-moon-stars'} fs-5`}></i>
            </button>

            {/* Language */}
            <button className="rounded-circle btn Translator d-none d-md-flex" title="Language">
              <i className="bi bi-globe fs-5"></i>
            </button>

            {/* Notifications */}
            <div className="position-relative d-none d-md-flex">
              <button className="rounded-circle btn notificationNumbers">
                <i className="bi bi-bell fs-5"></i>
                <sup className="primary">3</sup>
              </button>
            </div>

            {/* Messages */}
            <div className="position-relative d-none d-md-flex">
              <button className="rounded-circle btn messageNumbers">
                <i className="bi bi-envelope fs-5"></i>
                <sup className="primary">5</sup>
              </button>
            </div>

            {/* User Account */}
            <div className="myAccWrapper position-relative">
              <button
                className="myAcc btn d-flex align-items-center"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="userImg">
                  <span className="rounded-circle">
                    <img
                      src="https://ui-avatars.com/api/?name=Admin&background=8858f7&color=fff"
                      alt="user"
                    />
                  </span>
                </div>
                <div className="userInfo d-none d-md-block ms-2">
                  <h4 className="mb-0">{session?.user?.name || 'Admin'}</h4>
                  <p className="mb-0">{session?.user?.email}</p>
                </div>
              </button>

              {showUserMenu && (
                <div
                  className="position-absolute end-0 bg-white shadow rounded"
                  style={{ top: '110%', minWidth: '180px', zIndex: 999 }}
                >
                  <ul className="list-unstyled mb-0 py-2">
                    <li>
                      <a href="#" className="dropdown-item d-flex align-items-center gap-2 px-3 py-2">
                        <i className="bi bi-person"></i> My Account
                      </a>
                    </li>
                    <li>
                      <a href="#" className="dropdown-item d-flex align-items-center gap-2 px-3 py-2">
                        <i className="bi bi-shield-lock"></i> Reset Password
                      </a>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button
                        className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 text-danger w-100"
                        onClick={() => signOut({ callbackUrl: '/admin/login' })}
                      >
                        <i className="bi bi-box-arrow-right"></i> Logout
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}