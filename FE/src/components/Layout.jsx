import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PwaUpdateButton from './PwaUpdateButton';

const navLinkClass = ({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '');

const ROLE_LABEL = { admin: 'Admin', thu_kho: 'Thủ kho', nhan_vien: 'Nhân viên' };

// Icon dòng mảnh (phong cách Feather), tự vẽ trực tiếp -> không thêm thư viện ngoài.
// Mỗi "d" có thể gồm nhiều nét con (nhiều "M ... ") gộp trong cùng 1 <path>.
const ICON_PATHS = {
  edit: 'M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12',
  layers: 'M12 2 2 7l10 5 10-5-10-5Z M2 17l10 5 10-5 M2 12l10 5 10-5',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z M12 9v4 M12 17h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2',
  archive: 'M21 8v13H3V8 M1 3h22v5H1z M10 12h4',
  tag: 'M20.59 13.41 13.42 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z M7 7h.01',
  truck: 'M1 3h15v13H1z M16 8h4l3 3v5h-7V8Z M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  calendar: 'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18',
};

function Icon({ name }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Icon "ghim" (thumbtack) - nghiêng khi chưa ghim, thẳng đứng khi đã ghim (kiểu pin của Windows/Office).
function PinIcon({ pinned }) {
  return (
    <svg
      className={'sidebar-pin-icon' + (pinned ? ' is-pinned' : '')}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14 4h-4v6l-3 3v2h5v5l1 2 1-2v-5h5v-2l-3-3V4z" />
    </svg>
  );
}

// Danh mục điều hướng, có icon + nhãn, để dùng chung cho cả 2 trạng thái thu gọn/mở rộng.
const NAV_MAIN = [{ to: '/baocao/moi', icon: 'edit', label: 'Nhập mới' }];
const NAV_BAOCAO = [{ to: '/baocao', end: true, icon: 'file', label: 'Báo cáo xử lý hàng' }];
const NAV_DASHBOARD = [
  { to: '/dashboard/gio-lam-ngay', icon: 'calendar', label: 'Giờ làm trong ngày' },
  { to: '/dashboard/nhan-su', icon: 'users', label: 'Năng suất theo nhân sự' },
  { to: '/dashboard/vat-tu', icon: 'box', label: 'Năng suất theo vật tư' },
  { to: '/dashboard/lo', icon: 'layers', label: 'Tiến độ theo lô' },
  { to: '/dashboard/hu-bo', icon: 'alert', label: 'Thống kê hư bỏ' },
  { to: '/dashboard/bao-cong', icon: 'clock', label: 'Thống kê công xử lý' },
];
const NAV_DANHMUC = [
  { to: '/lo', icon: 'archive', label: 'Lô' },
  { to: '/loai-loi', icon: 'tag', label: 'Loại lỗi' },
];
const NAV_DANHMUC_ADMIN = [
  { to: '/vat-tu', icon: 'box', label: 'Vật tư' },
  { to: '/nhan-su', icon: 'users', label: 'Nhân sự' },
  { to: '/nha-cung-cap', icon: 'truck', label: 'Nhà cung cấp' },
];

function NavGroup({ items }) {
  return items.map((item) => (
    <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass} title={item.label}>
      <Icon name={item.icon} />
      <span className="sidebar-text">{item.label}</span>
    </NavLink>
  ));
}

export default function Layout() {
  const { user, logout, isAdmin, isStaff } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sidebar dạng mini-variant (desktop):
  //  - mặc định thu gọn, chỉ hiện icon
  //  - "pinned" = đã ghim mở rộng cố định (nhớ lại giữa các lần vào app)
  //  - "hovering" = đang rê chuột vào -> mở rộng TẠM THỜI (đè lên nội dung, không đẩy layout)
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem('sidebar-pinned') === 'true';
    } catch {
      return false;
    }
  });
  const [hovering, setHovering] = useState(false);
  const expanded = pinned || hovering;

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-pinned', pinned ? 'true' : 'false');
    } catch {
      // bỏ qua nếu trình duyệt chặn localStorage (chế độ ẩn danh...)
    }
  }, [pinned]);

  // Trễ 1 chút lúc rê chuột VÀO (không trễ lúc rê ra) - tránh mở ra khi chỉ lướt
  // chuột ngang qua sidebar (đi từ topbar xuống nội dung chẳng hạn), đỡ giật.
  const hoverTimer = useRef(null);
  function handleMouseEnter() {
    if (pinned) return;
    hoverTimer.current = setTimeout(() => setHovering(true), 80);
  }
  function handleMouseLeave() {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHovering(false);
  }

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

      <aside
        className={'sidebar' + (mobileOpen ? ' open' : '') + (pinned ? ' pinned' : '')}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={'sidebar-panel' + (expanded ? ' expanded' : '') + (pinned ? ' pinned' : '')}>
          <div className="sidebar-brand">
            <div className="sidebar-brand-row">
              <span className="sidebar-brand-mark" aria-hidden="true">SCC</span>
              <span className="sidebar-brand-text sidebar-text">
                SCC Bao Bi
                <small>Quản lý báo cáo lựa vật tư</small>
              </span>
            </div>
            <button
              type="button"
              className="sidebar-pin-btn"
              onClick={() => setPinned((v) => !v)}
              title={pinned ? 'Bỏ ghim (thu gọn khi rê chuột ra)' : 'Ghim mở rộng sidebar'}
              aria-pressed={pinned}
            >
              <PinIcon pinned={pinned} />
              <span className="sidebar-text">{pinned ? 'Bỏ ghim' : 'Ghim mở rộng'}</span>
            </button>
          </div>

          <nav className="sidebar-nav" onClick={closeMobile}>
            <div className="sidebar-section">
              <span className="sidebar-text">Nhập báo cáo</span>
            </div>
            <NavGroup items={NAV_MAIN} />

            <div className="sidebar-section">
              <span className="sidebar-text">Báo cáo</span>
            </div>
            <NavGroup items={NAV_BAOCAO} />

            {isStaff && (
              <>
                <NavGroup items={NAV_DASHBOARD} />

                <div className="sidebar-section">
                  <span className="sidebar-text">Quản trị danh mục</span>
                </div>
                <NavGroup items={NAV_DANHMUC} />
                {isAdmin && <NavGroup items={NAV_DANHMUC_ADMIN} />}
              </>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-avatar" aria-hidden="true">
              {(user?.ho_ten || '?').charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-text">
              <div className="sidebar-user">{user?.ho_ten}</div>
              <div className="sidebar-role">{ROLE_LABEL[user?.vai_tro] || 'Nhân viên'}</div>
            </div>
          </div>
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
