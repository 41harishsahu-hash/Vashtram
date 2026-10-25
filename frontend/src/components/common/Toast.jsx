import React from 'react';
import { useCart } from '../../context/useCart';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const Toast = () => {
  const { notification, hideToast } = useCart();

  if (!notification) return null;

  const { message, type } = notification;

  const getIcon = () => {
    switch (type) {
      case 'warning':
      case 'error':
        return <AlertCircle size={18} style={{ color: '#C5221F', flexShrink: 0 }} />;
      case 'info':
        return <Info size={18} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
      default:
        return <CheckCircle size={18} style={{ color: '#137333', flexShrink: 0 }} />;
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="vashtram-toast-alert"
      style={{
        position: 'fixed',
        bottom: '92px',
        right: '24px',
        zIndex: 'var(--z-toast, 99999)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-primary)',
        padding: '14px 18px',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.22), 0 2px 6px rgba(0, 0, 0, 0.08)',
        border: '1px solid var(--border-color)',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '380px',
        pointerEvents: 'auto',
      }}
    >
      {getIcon()}
      <span style={{ fontSize: '0.9rem', fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
        {message}
      </span>
      {hideToast && (
        <button
          onClick={hideToast}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            marginLeft: '4px',
            transition: 'color var(--transition-fast)',
          }}
          aria-label="Dismiss notification"
          title="Dismiss"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};

export default Toast;
