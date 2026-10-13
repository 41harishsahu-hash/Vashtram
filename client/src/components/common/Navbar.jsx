import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/useTheme';
import { useCart } from '../../context/useCart';
import { useAuth } from '../../context/useAuth';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import {
  Sun,
  Moon,
  ShoppingBag,
  User,
  Search,
  Menu,
  X,
  LogOut,
  Package,
} from 'lucide-react';

const Navbar = () => {
  const { isDark, toggleTheme } = useTheme();
  const { cartCount, showToast } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lock background body scroll when mobile navigation drawer is open
  useBodyScrollLock(mobileMenuOpen);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click or Esc key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setUserDropdownOpen(false);
        setSearchOpen(false);
      }
    };

    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userDropdownOpen]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navLinkStyle = ({ isActive }) => ({
    fontSize: '0.92rem',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
    transition: 'color var(--transition-fast)',
    letterSpacing: '0.02em',
    padding: '6px 0',
    borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
  });

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          backgroundColor: 'var(--header-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color)',
          transition: 'all var(--transition-normal)',
        }}
      >
        <div className="container">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '72px',
            }}
          >
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              style={{
                display: 'none',
                color: 'var(--text-primary)',
                padding: '6px',
              }}
              className="mobile-toggle"
              aria-label="Open Navigation Menu"
            >
              <Menu size={24} />
            </button>

            {/* Brand Logo */}
            <Link
              to="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(1.25rem, 4vw, 1.65rem)',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--text-primary)',
                }}
              >
                VASHTRAM
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '32px',
              }}
              className="desktop-nav"
            >
              <NavLink to="/" style={navLinkStyle}>
                Home
              </NavLink>
              <NavLink to="/shop" style={navLinkStyle}>
                Shop
              </NavLink>
              <NavLink to="/categories" style={navLinkStyle}>
                Categories
              </NavLink>
              <NavLink to="/about" style={navLinkStyle}>
                About
              </NavLink>
              <NavLink to="/contact" style={navLinkStyle}>
                Contact
              </NavLink>
            </nav>

            {/* Right Action Icons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(4px, 2vw, 16px)',
              }}
              className="nav-actions"
            >
              {/* Search Toggle */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                style={{
                  color: 'var(--text-primary)',
                  padding: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Search"
                title="Search products"
              >
                <Search size={20} />
              </button>

              {/* Theme Toggle (Light / Dark Mode) */}
              <button
                onClick={toggleTheme}
                style={{
                  color: 'var(--text-primary)',
                  padding: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
                aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? (
                  <Sun size={18} style={{ color: '#FDD663' }} />
                ) : (
                  <Moon size={18} style={{ color: 'var(--text-secondary)' }} />
                )}
              </button>

              {/* Cart Button */}
              <Link
                to="/cart"
                style={{
                  position: 'relative',
                  color: 'var(--text-primary)',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label={`Cart with ${cartCount} items`}
              >
                <ShoppingBag size={21} />
                {cartCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '0px',
                      backgroundColor: 'var(--accent-color)',
                      color: 'var(--text-light)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>

              {/* User Account Dropdown */}
              <div ref={userDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  style={{
                    color: 'var(--text-primary)',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  aria-label="Account Menu"
                >
                  <User size={20} />
                  {isAuthenticated && (
                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        maxWidth: '100px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      className="desktop-user-name"
                    >
                      {user?.name?.split(' ')[0]}
                    </span>
                  )}
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div
                    onClick={() => setUserDropdownOpen(false)}
                    style={{
                      position: 'absolute',
                      top: '45px',
                      right: 0,
                      width: '210px',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 0',
                      zIndex: 1050,
                    }}
                  >
                    {isAuthenticated ? (
                      <>
                        <div
                          style={{
                            padding: '10px 16px',
                            borderBottom: '1px solid var(--border-color)',
                          }}
                        >
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {user?.name}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {user?.email}
                          </p>
                        </div>

                        <Link
                          to="/account"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 16px',
                            fontSize: '0.88rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <User size={16} /> My Account
                        </Link>

                        <Link
                          to="/orders"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 16px',
                            fontSize: '0.88rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <Package size={16} /> My Orders
                        </Link>

                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '4px' }}>
                          <button
                            onClick={() => {
                              logout();
                              if (showToast) showToast('Signed out from all devices');
                              navigate('/');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              width: '100%',
                              padding: '10px 16px',
                              fontSize: '0.88rem',
                              color: '#C5221F',
                              textAlign: 'left',
                            }}
                          >
                            <LogOut size={16} /> Sign Out
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          style={{
                            display: 'block',
                            padding: '10px 16px',
                            fontSize: '0.88rem',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                          }}
                        >
                          Sign In
                        </Link>
                        <Link
                          to="/register"
                          style={{
                            display: 'block',
                            padding: '10px 16px',
                            fontSize: '0.88rem',
                            color: 'var(--accent-color)',
                            fontWeight: 500,
                          }}
                        >
                          Create Account
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Search Drawer / Bar */}
          {searchOpen && (
            <div
              style={{
                padding: '12px 0 16px',
                borderTop: '1px solid var(--border-color)',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search by protector name, size, material, or feature..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    style={{
                      paddingLeft: '38px',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                  <Search
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm">
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  <X size={16} />
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-drawer, 3000)',
            display: 'flex',
          }}
        >
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(3px)',
            }}
          />

          <div
            style={{
              position: 'relative',
              width: '280px',
              maxWidth: '80%',
              backgroundColor: 'var(--bg-primary)',
              height: '100%',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1,
              padding: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '32px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.4rem',
                  fontWeight: 700,
                }}
              >
                VASHTRAM
              </span>
              <button
                type="button"
                aria-label="Close mobile navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  color: 'var(--text-primary)',
                  padding: '10px',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <X size={22} />
              </button>
            </div>

            <nav
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                fontSize: '1.05rem',
              }}
            >
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: 'var(--text-primary)', fontWeight: 500 }}
              >
                Home
              </Link>
              <Link
                to="/shop"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: 'var(--text-primary)', fontWeight: 500 }}
              >
                All Mattress Protectors
              </Link>
              <Link
                to="/categories"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: 'var(--text-primary)', fontWeight: 500 }}
              >
                Categories
              </Link>
              <Link
                to="/shop?category=cotton"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: 'var(--text-primary)', fontWeight: 500 }}
              >
                100% WaterProof
              </Link>
              <Link
                to="/shop?category=king-size"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: 'var(--text-primary)', fontWeight: 500 }}
              >
                King Size Collection
              </Link>
              <Link
                to="/about"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: 'var(--text-primary)', fontWeight: 500 }}
              >
                About VASHTRAM
              </Link>
              <Link
                to="/contact"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: 'var(--text-primary)', fontWeight: 500 }}
              >
                Contact Us
              </Link>
            </nav>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: '24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {isAuthenticated ? (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Signed in as <strong>{user?.name}</strong>
                  </p>
                  <Link
                    to="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    My Account
                  </Link>
                  <Link
                    to="/orders"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    My Orders
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      if (showToast) showToast('Signed out from all devices');
                      setMobileMenuOpen(false);
                      navigate('/');
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Responsive media styles */}
      <style>{`
        @media (max-width: 860px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: flex !important; }
          .desktop-user-name { display: none !important; }
        }
        @media (max-width: 480px) {
          .nav-actions button, .nav-actions a {
            padding: 5px !important;
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;
