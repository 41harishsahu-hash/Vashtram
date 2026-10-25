import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useCart } from '../../context/useCart';
import { Shield, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { sanitizeRedirectUrl } from '../../utils/urlHelper';

const AdminLoginPage = () => {
  const { user, isAuthenticated, isAdmin, login, adminLogin } = useAuth();
  const { showToast } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect');
  const sessionExpired = searchParams.get('sessionExpired') === 'true';
  const [errorMsg, setErrorMsg] = useState(location.state?.error || '');

  // If already an authenticated admin, redirect straight to dashboard
  useEffect(() => {
    if (isAdmin) {
      const rawDest = redirectParam || location.state?.from?.pathname || location.state?.from;
      const destination = sanitizeRedirectUrl(rawDest, '/admin/dashboard');
      navigate(destination, { replace: true });
    }
  }, [isAdmin, navigate, location.state, redirectParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const authFn = adminLogin || login;
      const data = await authFn(email.trim(), password);
      if (data.user.role !== 'admin') {
        setErrorMsg('Access Denied: Your account does not have Administrator privileges.');
        return;
      }
      showToast('Admin access authorized. Welcome to VASHTRAM Admin Dashboard.');
      const rawDest = redirectParam || location.state?.from?.pathname || location.state?.from;
      const destination = sanitizeRedirectUrl(rawDest, '/admin/dashboard');
      navigate(destination, { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'Invalid administrator credentials');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div
      style={{
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          width: '440px',
          maxWidth: '100%',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Shield size={28} />
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            VASHTRAM Admin Portal
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '6px' }}>
            Sign in to access the VASHTRAM Admin Dashboard
          </p>
        </div>

        {/* Notice if currently logged in with customer role */}
        {isAuthenticated && !isAdmin && (
          <div
            style={{
              backgroundColor: 'var(--badge-warning-bg, #FEF3C7)',
              color: 'var(--badge-warning-text, #92400E)',
              border: '1px solid #FCD34D',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84rem',
              lineHeight: 1.5,
              marginBottom: '20px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Customer session detected:</strong> You are currently signed in as{' '}
              <span style={{ textDecoration: 'underline' }}>{user?.email}</span>. Please authenticate below with Administrator credentials to proceed to the Admin Dashboard.
            </div>
          </div>
        )}

        {sessionExpired && (
          <div
            style={{
              backgroundColor: 'var(--badge-warning-bg, #FEF3C7)',
              color: 'var(--badge-warning-text, #92400E)',
              border: '1px solid #FCD34D',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm, 6px)',
              fontSize: '0.84rem',
              lineHeight: 1.5,
              marginBottom: '16px',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            Your administrator session has expired. Please log in again to continue.
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              backgroundColor: 'var(--badge-danger-bg)',
              color: 'var(--badge-danger-text)',
              border: '1px solid var(--border-color)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84rem',
              marginBottom: '20px',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Admin Email
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '38px', width: '100%' }}
              />
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Admin Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '38px', width: '100%' }}
              />
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg btn-full"
            style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading ? 'Authenticating...' : (
              <>
                <span>Sign In to Admin Dashboard</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <Link
            to="/"
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            &larr; Return to Customer Storefront
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
