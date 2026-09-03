import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PwaUpdateButton from './PwaUpdateButton';

const navLinkClass = ({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '');

const ROLE_LABEL = { admin: 'Admin', thu_kho: 'Thủ kho', nhan_vien: 'Nhân viên' };

export default function Layout() {
  const { user, logout, isAdmin, isStaff } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className="app-shell">
      {mobileOpen && <div className="sidebar-backdrop" onClick={closeMobile} />}

      <aside className={'sidebar' + (mobileOpen ? ' open' : '')}>
        <div className="sidebar-brand">
          SCC Bao Bi
          <small>Quản lý báo cáo lựa vật tư</small>
        </div>

        <nav className="sidebar-nav" onClick={closeMobile}>
          <div className="sidebar-section">Báo cáo</div>
          <NavLink to="/baocao" end className={navLinkClass}>
            Danh sách báo cáo
          </NavLink>
          <NavLink to="/baocao/moi" className={navLinkClass}>
            Nhập báo cáo mới
          </NavLink>

          {isStaff && (
            <>
              <div className="sidebar-section">Dashboard năng suất</div>
              <NavLink to="/dashboard/nhan-su" className={navLinkClass}>
                Theo nhân sự
              </NavLink>
              <NavLink to="/dashboard/vat-tu" className={navLinkClass}>
                Theo vật tư
              </NavLink>
              <NavLink to="/dashboard/lo" className={navLinkClass}>
                Theo lô
              </NavLink>
              <NavLink to="/dashboard/thoi-gian" className={navLinkClass}>
                Theo thời gian
              </NavLink>

              <div className="sidebar-section">Quản trị danh mục</div>
              {isAdmin && (
                <NavLink to="/vat-tu" className={navLinkClass}>
                  Vật tư
                </NavLink>
              )}
              <NavLink to="/lo" className={navLinkClass}>
                Lô
              </NavLink>
              <NavLink to="/loai-loi" className={navLinkClass}>
                Loại lỗi
              </NavLink>
              {isAdmin && (
                <>
                  <NavLink to="/nhan-su" className={navLinkClass}>
                    Nhân sự
                  </NavLink>
                  <NavLink to="/nha-cung-cap" className={navLinkClass}>
                    Nhà cung cấp
                  </NavLink>
                </>
              )}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">{user?.ho_ten}</div>
          <div className="sidebar-role">{ROLE_LABEL[user?.vai_tro] || 'Nhân viên'}</div>
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <button
            type="button"
            className="hamburger-btn"
            aria-label="Mở menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="btn-group">
            <PwaUpdateButton />
            <NavLink to="/doi-mat-khau" className="btn btn-sm">
              Đổi mật khẩu
            </NavLink>
            <button type="button" className="btn btn-sm" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
