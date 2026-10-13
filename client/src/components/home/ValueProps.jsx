import React from 'react';
import { Award, Truck, ShieldCheck, RefreshCw } from 'lucide-react';

const ValueProps = () => {
  const props = [
    {
      icon: <Award size={22} style={{ color: 'var(--accent-color)' }} />,
      title: 'Premium Quality',
      subtitle: '100% Pure Combed Cotton',
    },
    {
      icon: <Truck size={22} style={{ color: 'var(--accent-color)' }} />,
      title: 'Fast & Reliable',
      subtitle: 'Free Shipping Over ₹999',
    },
    {
      icon: <ShieldCheck size={22} style={{ color: 'var(--accent-color)' }} />,
      title: 'Secure Payments',
      subtitle: '100% Secure via Razorpay',
    },
    {
      icon: <RefreshCw size={22} style={{ color: 'var(--accent-color)' }} />,
      title: 'Easy Returns',
      subtitle: '7-Day Return Policy',
    },
  ];

  return (
    <section style={{ padding: 'clamp(16px, 3vw, 24px) 0 clamp(24px, 4vw, 40px)' }}>
      <div className="container">
        <div
          className="value-props-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'clamp(12px, 2.5vw, 20px)',
            backgroundColor: 'var(--bg-secondary)',
            padding: 'clamp(14px, 3vw, 24px) clamp(14px, 3.5vw, 28px)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          {props.map((item, index) => (
            <div
              key={index}
              className="value-prop-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(10px, 2vw, 14px)',
                minWidth: 0,
              }}
            >
              <div
                className="value-prop-icon"
                style={{
                  width: 'clamp(36px, 5vw, 44px)',
                  height: 'clamp(36px, 5vw, 44px)',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {item.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <h4
                  style={{
                    fontSize: 'clamp(0.8rem, 2vw, 0.92rem)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '2px',
                    lineHeight: 1.25,
                  }}
                >
                  {item.title}
                </h4>
                <p
                  style={{
                    fontSize: 'clamp(0.7rem, 1.8vw, 0.8rem)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.25,
                  }}
                >
                  {item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .value-props-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 360px) {
          .value-props-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
};

export default ValueProps;
