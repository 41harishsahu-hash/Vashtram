import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useCart } from '../context/useCart';
import { Lock, Mail } from 'lucide-react';
import { sanitizeRedirectUrl } from '../utils/urlHelper';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();
  const { showToast } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect');
  const sessionExpired = searchParams.get('sessionExpired') === 'true';
  const rawFrom = redirectParam || location.state?.from?.pathname || location.state?.from;
  const from = sanitizeRedirectUrl(rawFrom, '/');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const data = await login(email.trim(), password);
      showToast(`Welcome back, ${data.user.name}!`);
      if (data.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={{ padding: 'clamp(28px, 5vw, 60px) 0 clamp(40px, 8vw, 100px)' }}>
      <div className="container" style={{ maxWidth: '440px' }}>
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: 'clamp(20px, 4vw, 36px) clamp(16px, 3.5vw, 32px)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <Link
              to="/"
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.8rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                display: 'inline-block',
                marginBottom: '8px',
              }}
            >
              VASHTRAM
            </Link>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Sign In to Your Account
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
              Access your orders, saved addresses, and bag
            </p>
          </div>

          {sessionExpired && (
            <div
              style={{
                backgroundColor: 'var(--badge-warning-bg, #FEF3C7)',
                color: 'var(--badge-warning-text, #92400E)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: '0.85rem',
                marginBottom: '16px',
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              Your session has expired. Please log in again to continue.
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                backgroundColor: 'var(--badge-danger-bg)',
                color: 'var(--badge-danger-text)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '36px' }}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Password</label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '36px' }}
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

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full" style={{ marginTop: '8px' }}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>



          {/* Register Link */}
          <p
            style={{
              textAlign: 'center',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              marginTop: '24px',
            }}
          >
            Don't have an account yet?{' '}
            <Link to="/register" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
