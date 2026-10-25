import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useSettings } from '../../context/useSettings';

// WhatsApp Official SVG Icon
export const WhatsAppIcon = ({ size = 22, color = 'currentColor', className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={color}
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

/**
 * Reusable standalone Bulk Order Contact Button
 * Opens WhatsApp with prefilled wholesale / bulk query
 */
export const BulkOrderButton = ({
  phone,
  message = 'Hello VASHTRAM team! I am interested in placing a Bulk / Wholesale Order for mattress protectors. Please share catalog, minimum order quantities, and wholesale pricing.',
  className = '',
  style = {},
  children,
}) => {
  const { getWhatsAppUrl } = useSettings();
  const url = getWhatsAppUrl(message, phone);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#25D366',
        color: '#FFFFFF',
        textDecoration: 'none',
        fontWeight: 600,
        borderRadius: 'var(--radius-sm, 6px)',
        padding: '10px 18px',
        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      <WhatsAppIcon size={18} color="#FFFFFF" />
      <span>{children || 'Inquire for Bulk Orders'}</span>
    </a>
  );
};

/**
 * Responsive Floating WhatsApp Button
 * - Desktop (>768px): Sleek pill button with WhatsApp icon + "Chat with us" label
 * - Mobile (<=768px): Circular Floating Action Button (FAB) with WhatsApp icon only (clean, space-saving)
 * - Safe area inset support for modern iOS & Android devices
 * - Hidden entirely on /checkout to never obstruct checkout form or Pay button
 */
const WhatsAppButton = ({
  phone,
  defaultMessage = 'Hello VASHTRAM team! I am browsing your collection and have a query. For retail & bulk orders, please assist.',
}) => {
  const location = useLocation();
  const { getWhatsAppUrl } = useSettings();
  const [showTooltip, setShowTooltip] = useState(false);

  // Automatically show brief tooltip hint on desktop after 3s, then auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(true);
      const hideTimer = setTimeout(() => setShowTooltip(false), 5000);
      return () => clearTimeout(hideTimer);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Suppress on checkout page so it never covers the Pay button or payment form
  if (location.pathname === '/checkout') {
    return null;
  }

  const chatUrl = getWhatsAppUrl(defaultMessage, phone);

  return (
    <div className="floating-whatsapp-container">
      {/* Quick Tooltip Hint (appears briefly on desktop only) */}
      {showTooltip && (
        <a
          href={chatUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-tooltip"
        >
          <Sparkles size={14} style={{ color: '#25D366', flexShrink: 0 }} />
          <span>Have a query? Chat with us!</span>
        </a>
      )}

      {/* Main WhatsApp Floating Action Button */}
      <a
        href={chatUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-float-btn"
        aria-label="Chat with VASHTRAM on WhatsApp"
        title="Chat with VASHTRAM on WhatsApp"
      >
        <div className="whatsapp-icon-wrapper">
          <WhatsAppIcon size={24} color="#FFFFFF" />
          <span className="whatsapp-status-dot" />
        </div>
        <span className="whatsapp-btn-text">Chat For Bulk Orders</span>
      </a>

      <style>{`
        .floating-whatsapp-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: var(--z-whatsapp, 900);
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          pointer-events: none;
        }
        .floating-whatsapp-container > * { pointer-events: auto; }
        .whatsapp-tooltip {
          background-color: var(--bg-card, #FFFFFF);
          color: var(--text-primary, #111827);
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
          border: 1px solid var(--border-color, #E5E7EB);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 6px;
          animation: bounceIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          white-space: nowrap;
          transition: transform 0.2s ease;
        }
        .whatsapp-tooltip:hover { transform: translateY(-2px); }
        .whatsapp-float-btn {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          background-color: #25D366;
          color: #FFFFFF;
          text-decoration: none;
          border-radius: 100px;
          padding: 12px 20px;
          box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4), 0 2px 6px rgba(0, 0, 0, 0.12);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
        .whatsapp-float-btn:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 8px 24px rgba(37, 211, 102, 0.55), 0 3px 8px rgba(0, 0, 0, 0.15);
          background-color: #20BA5A;
        }
        .whatsapp-float-btn:active { transform: translateY(0) scale(0.96); }
        .whatsapp-icon-wrapper { position: relative; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .whatsapp-status-dot { position: absolute; top: -1px; right: -1px; width: 8px; height: 8px; border-radius: 50%; }

        @media (max-width: 768px) {
          .floating-whatsapp-container {
            bottom: calc(16px + env(safe-area-inset-bottom, 0px));
            right: 16px;
          }
          .whatsapp-tooltip {
            display: none !important;
          }
          .whatsapp-btn-text {
            display: none !important;
          }
          .whatsapp-float-btn {
            width: 48px;
            height: 48px;
            padding: 0 !important;
            justify-content: center;
            border-radius: 50% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default WhatsAppButton;
