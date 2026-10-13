import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';
import { useSettings } from '../../context/useSettings';

const Footer = () => {
  const { settings, storeName, supportEmail, supportPhone, storeAddress } = useSettings();
  const phone = supportPhone || settings?.supportPhone || settings?.whatsappNumber || '+91 7691841583';
  const email = supportEmail || settings?.supportEmail || 'vashtramclothsy.info@gmail.com';
  const address = storeAddress || settings?.storeAddress || 'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021';
  const storeTitle = storeName || settings?.storeName || 'VASHTRAM Mattress Protectors';

  const socialLinks = [
    {
      name: 'Instagram',
      url: settings?.instagramUrl || settings?.social?.instagram || '',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      ),
    },
    {
      name: 'Facebook',
      url: settings?.facebookUrl || settings?.social?.facebook || '',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      ),
    },
    {
      name: 'Twitter',
      url: settings?.twitterUrl || settings?.xUrl || settings?.social?.twitter || '',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
        </svg>
      ),
    },
  ];

  return (
    <footer
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        paddingTop: 'clamp(36px, 5vw, 64px)',
        paddingBottom: 'clamp(20px, 3vw, 32px)',
        marginTop: 'clamp(40px, 6vw, 80px)',
        transition: 'background-color var(--transition-normal)',
      }}
    >
      <div className="container">
        <div
          className="footer-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 'clamp(24px, 4vw, 40px)',
            marginBottom: 'clamp(28px, 4vw, 48px)',
          }}
        >
          {/* Brand Info */}
          <div style={{ maxWidth: '340px' }} className="footer-brand">
            <Link
              to="/"
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1.35rem, 3.5vw, 1.6rem)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--text-primary)',
                display: 'inline-block',
                marginBottom: '12px',
              }}
            >
              VASHTRAM
            </Link>
            <p
              style={{
                fontSize: 'clamp(0.82rem, 2vw, 0.9rem)',
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                marginBottom: '16px',
              }}
            >
              At VASHTRAM, we believe home textiles should do more than just look elegant. They should provide comfort, durability, and peace of mind every night.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              {socialLinks.map((item) =>
                item.url ? (
                  <a
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      transition: 'color var(--transition-fast), border-color var(--transition-fast)',
                    }}
                    aria-label={item.name}
                  >
                    {item.icon}
                  </a>
                ) : (
                  <span
                    key={item.name}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      cursor: 'default',
                      opacity: 0.55,
                    }}
                    aria-label={`${item.name} (Coming soon)`}
                    title={`${item.name} — Coming soon`}
                  >
                    {item.icon}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-links-col">
            <h4
              style={{
                fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '14px',
                color: 'var(--text-primary)',
              }}
            >
              Quick Links
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <Link to="/" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/shop" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Shop All Mattress Protectors
                </Link>
              </li>
              <li>
                <Link to="/categories" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  All Categories
                </Link>
              </li>
              <li>
                <Link to="/shop?category=cotton" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  100% WaterProof
                </Link>
              </li>
              <li>
                <Link to="/about" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Our Heritage & Story
                </Link>
              </li>
              <li>
                <Link to="/contact" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Support */}
          <div className="footer-links-col">
            <h4
              style={{
                fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '14px',
                color: 'var(--text-primary)',
              }}
            >
              Customer Support
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <Link to="/contact" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Help Center & FAQs
                </Link>
              </li>
              <li>
                <Link to="/orders" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Track Order
                </Link>
              </li>
              <li>
                <Link to="/shipping-policy" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Shipping & Delivery Info
                </Link>
              </li>
              <li>
                <Link to="/return-policy" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  7-Day Return Policy
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="footer-contact-col">
            <h4
              style={{
                fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '14px',
                color: 'var(--text-primary)',
              }}
            >
              Contact Us
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                <Phone size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                <a href={`tel:${phone.replace(/\s+/g, '')}`} style={{ color: 'inherit', textDecoration: 'none' }}>{phone}</a>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.88rem', wordBreak: 'break-all' }}>
                <Mail size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                <a href={`mailto:${email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{email}</a>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                <MapPin size={15} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '3px' }} />
                <span>{address}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: 'clamp(0.75rem, 1.8vw, 0.85rem)',
            color: 'var(--text-muted)',
          }}
        >
          <p>© {new Date().getFullYear()} {storeTitle}. All rights reserved.</p>
          <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Premium Mattress Protectors. Everyday Peace of Mind
          </p>
        </div>
      </div>
      <style>{`
        @media (max-width: 580px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 24px 16px !important;
          }
          .footer-brand {
            grid-column: 1 / -1;
            max-width: 100% !important;
          }
          .footer-contact-col {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
