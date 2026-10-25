import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[VASHTRAM Error Boundary Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-primary, #FAF9F5)',
            color: 'var(--text-primary, #1F1D1A)',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              border: '1px solid var(--border-color, #E8E2D8)',
              borderRadius: 'var(--radius-md, 10px)',
              padding: '36px 28px',
              boxShadow: 'var(--shadow-md, 0 4px 14px rgba(31, 29, 26, 0.08))',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif, Georgia, serif)',
                fontSize: '1.6rem',
                marginBottom: '12px',
                color: 'var(--text-primary, #1F1D1A)',
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                color: 'var(--text-secondary, #5C564D)',
                fontSize: '0.9rem',
                marginBottom: '24px',
                lineHeight: 1.5,
              }}
            >
              We encountered an unexpected error while displaying this section. Please refresh the page or return home.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                style={{
                  backgroundColor: 'var(--accent-color, #8B6239)',
                  color: '#FFFFFF',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Reload Page
              </button>
              <a
                href="/"
                style={{
                  backgroundColor: 'var(--bg-secondary, #F3EFEA)',
                  color: 'var(--text-primary, #1F1D1A)',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  display: 'inline-block',
                  border: '1px solid var(--border-color, #E8E2D8)',
                }}
              >
                Go to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
