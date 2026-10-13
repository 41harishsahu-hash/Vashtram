import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/useTheme';
import { useCart } from '../../context/useCart';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  Users,
  Sparkles,
  Settings,
  LogOut,
  Sun,
  Moon,
  ExternalLink,
  Menu,
  X,
  MessageSquare,
  Award,
  BookOpen,
} from 'lucide-react';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useCart();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lock body scroll when mobile admin drawer is open
  useBodyScrollLock(sidebarOpen);

  const navItemStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 18px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.92rem',
    fontWeight: isActive ? 600 : 400,
    backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
    color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
    transition: 'all var(--transition-fast)',
    textDecoration: 'none',
  });

  return (
    <div
      className="admin-layout-root"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        position: 'relative',
      }}
    >
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="admin-mobile-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
            zIndex: 'var(--z-drawer, 3000)',
          }}
        />
      )}

      {/* Permanently Fixed Admin Sidebar */}
      <aside
        style={{
          width: '260px',
          minWidth: '260px',
          maxWidth: '260px',
          height: '100vh',
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 'var(--z-drawer, 3000)',
          overflow: 'hidden',
        }}
        className="admin-sidebar"
      >
        {/* Brand / Title (Fixed at top of sidebar) */}
        <div
          style={{
            padding: '20px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            height: '64px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.45rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              VASHTRAM
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent-color)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Admin
            </span>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px',
            }}
            className="admin-sidebar-close"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items (Internally scrollable if window height is short) */}
        <nav
          style={{
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <NavLink
            to="/admin/dashboard"
            style={navItemStyle}
            end
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/admin/hero"
            style={navItemStyle}
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <Sparkles size={18} />
            <span>Hero Section</span>
          </NavLink>

          <NavLink
            to="/admin/features"
            style={navItemStyle}
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <Award size={18} />
            <span>Why Choose Us</span>
          </NavLink>

          <NavLink
            to="/admin/about"
            style={navItemStyle}
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <BookOpen size={18} />
            <span>About Page</span>
          </NavLink>

          <NavLink
            to="/admin/products"
            style={navItemStyle}
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <Package size={18} />
            <span>Products</span>
          </NavLink>

          <NavLink
            to="/admin/categories"
            style={navItemStyle}
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <Layers size={18} />
            <span>Categories</span>
          </NavLink>

          <NavLink
            to="/admin/orders"
            style={navItemStyle}
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <ShoppingBag size={18} />
            <span>Orders</span>
          </NavLink>

          <NavLink
            to="/admin/customers"
            style={navItemStyle}
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <Users size={18} />
            <span>Customers</span>
          </NavLink>

          <NavLink
            to="/admin/inquiries"
            style={navItemStyle}
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <MessageSquare size={18} />
            <span>Inquiries</span>
          </NavLink>

          <NavLink
            to="/admin/settings"
            style={navItemStyle}
            onClick={() => window.innerWidth <= 860 && setSidebarOpen(false)}
          >
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer (Pinned at bottom of sidebar) */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0,
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '4px 0',
            }}
          >
            <ExternalLink size={15} /> View Storefront
          </Link>

          <button
            onClick={() => {
              logout();
              if (showToast) showToast('Signed out from all devices');
              navigate('/admin/login');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              color: '#C5221F',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 0',
              textAlign: 'left',
            }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area (Offset by sidebar width and independently scrollable) */}
      <div
        className="admin-main-wrapper"
        style={{
          marginLeft: '260px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Admin Header (Fixed at top of content area) */}
        <header
          className="admin-header"
          style={{
            height: '64px',
            minHeight: '64px',
            flexShrink: 0,
            backgroundColor: 'var(--header-bg)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            zIndex: 90,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="admin-hamburger"
              style={{
                display: 'none',
                minWidth: '44px',
                minHeight: '44px',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Toggle navigation"
            >
              <Menu size={22} />
            </button>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              VASHTRAM Admin Dashboard
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              title="Toggle Light / Dark mode"
            >
              {isDark ? <Sun size={17} style={{ color: '#FDD663' }} /> : <Moon size={17} />}
            </button>

            {/* Admin Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--text-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                A
              </div>
              <div className="admin-user-info">
                <span style={{ fontSize: '0.88rem', fontWeight: 600, display: 'block' }}>
                  {user?.name || 'Administrator'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                  {user?.email || 'vashtramclothsy.info@gmail.com'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Outlet - Independent Scroll Container */}
        <main
          className="admin-main-content"
          style={{
            flex: 1,
            padding: '28px',
            minWidth: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .admin-sidebar {
            left: ${sidebarOpen ? '0' : '-260px'} !important;
            transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: ${sidebarOpen ? 'var(--shadow-xl)' : 'none'};
          }
          .admin-main-wrapper {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .admin-sidebar-close {
            display: flex !important;
            min-width: 44px;
            min-height: 44px;
            align-items: center;
            justify-content: center;
          }
          .admin-hamburger {
            display: flex !important;
          }
          .admin-user-info {
            display: none !important;
          }
        }
        @media (max-width: 600px) {
          .admin-main-content {
            padding: 16px 12px !important;
          }
          .admin-header {
            padding: 0 14px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminLayout;
