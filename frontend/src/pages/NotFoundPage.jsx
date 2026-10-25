import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div style={{ padding: '100px 0', textAlign: 'center' }}>
      <div className="container" style={{ maxWidth: '500px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '5rem',
            fontWeight: 700,
            color: 'var(--accent-color)',
            lineHeight: 1,
            marginBottom: '16px',
          }}
        >
          404
        </h1>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
          The page or product you are looking for doesn't exist or may have been moved.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link to="/" className="btn btn-primary">
            <Home size={16} /> Return to Home
          </Link>
          <Link to="/shop" className="btn btn-secondary">
            Browse All Products
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
