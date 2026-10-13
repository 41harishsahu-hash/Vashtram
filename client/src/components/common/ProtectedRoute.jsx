import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

export const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-color)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading VASHTRAM...</p>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Admin protected route verification
  if (requireAdmin) {
    if (!isAuthenticated) {
      return (
        <Navigate
          to="/admin/login"
          state={{ from: location }}
          replace
        />
      );
    }

    if (!isAdmin) {
      return (
        <Navigate
          to="/admin/login"
          state={{
            from: location,
            error: 'Administrator credentials required to access the Admin Panel. Please sign in with an admin account.',
            currentEmail: user?.email,
          }}
          replace
        />
      );
    }

    return children;
  }

  // Customer protected route verification
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
