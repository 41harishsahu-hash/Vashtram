import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { renderFeatureIcon } from '../../utils/featureIcons';

const DEFAULT_REASONS = [
  {
    icon: 'Feather',
    title: 'Premium Fabric',
    description:
      'Soft & Breathable 100% pure combed cotton that feels gentle on sensitive skin all year round.',
  },
  {
    icon: 'Palette',
    title: 'Elegant Designs',
    description:
      'Sophisticated botanical and geometric patterns thoughtfully created to complement modern bedrooms.',
  },
  {
    icon: 'Clock',
    title: 'Long Lasting',
    description:
      'Durable quality weave and color-fast dyes that resist pilling and fading through dozens of washes.',
  },
  {
    icon: 'HeartHandshake',
    title: 'Customer First',
    description:
      'Dedicated support, 100% secure online checkout via Razorpay, and effortless 7-day returns for total peace of mind.',
  },
];

const WhyChooseUs = () => {
  const [reasons, setReasons] = useState(DEFAULT_REASONS);

  useEffect(() => {
    let isMounted = true;

    const fetchFeatures = async () => {
      try {
        const res = await api.get('/features');
        if (isMounted && res.data?.success && Array.isArray(res.data.features) && res.data.features.length > 0) {
          setReasons(res.data.features);
        }
      } catch (err) {
        // Graceful fallback to default reasons without breaking the page or exposing raw errors
        console.warn('[WhyChooseUs]: Using fallback feature cards:', err.message || err);
      }
    };

    fetchFeatures();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section style={{ padding: 'clamp(28px, 4vw, 50px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto clamp(24px, 4vw, 48px)' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(1.5rem, 4vw, 2.3rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '10px',
            }}
          >
            Why Choose VASHTRAM?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
            Choose VASHTRAM Mattress Protectors to help keep your bedroom clean, hygienic, comfortable, and protected every night.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: 'clamp(14px, 2.5vw, 24px)',
          }}
        >
          {reasons.map((item, index) => (
            <div
              key={item._id || index}
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: 'clamp(20px, 3.5vw, 32px) clamp(16px, 3vw, 24px)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'transform var(--transition-normal), box-shadow var(--transition-normal)',
              }}
              className="why-card"
            >
              <div
                style={{
                  width: 'clamp(44px, 6vw, 56px)',
                  height: 'clamp(44px, 6vw, 56px)',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'clamp(12px, 2.5vw, 20px)',
                  flexShrink: 0,
                }}
              >
                {renderFeatureIcon(item.icon, {
                  size: 26,
                  style: { color: 'var(--accent-color)' },
                })}
              </div>
              <h3
                style={{
                  fontSize: 'clamp(0.95rem, 2.2vw, 1.08rem)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: 'clamp(0.8rem, 1.8vw, 0.88rem)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}
              >
                {item.description || item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .why-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </section>
  );
};

export default WhyChooseUs;
