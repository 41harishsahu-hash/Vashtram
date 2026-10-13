import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const BannerPromo = () => {
  return (
    <section style={{ padding: 'clamp(24px, 4vw, 50px) 0 clamp(32px, 5vw, 60px)' }}>
      <div className="container">
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            minHeight: '320px',
            boxShadow: 'var(--shadow-md)',
          }}
          className="promo-banner"
        >
          {/* Background image overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '55%',
              backgroundImage: 'url("/img/HeroCrousel2.jpeg")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              maskImage: 'linear-gradient(to right, transparent, black 35%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 35%)',
            }}
            className="promo-banner-img"
          />

          {/* Text Content */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              padding: 'clamp(24px, 4vw, 48px)',
              maxWidth: '560px',
            }}
            className="promo-banner-content"
          >
            <span
              style={{
                fontSize: 'clamp(0.72rem, 1.8vw, 0.8rem)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 700,
                color: 'var(--accent-color)',
                display: 'block',
                marginBottom: '10px',
              }}
            >
              PREMIUM MATTRESS PROTECTORS
            </span>

            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.4rem, 4vw, 2.5rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.25,
                marginBottom: '12px',
              }}
            >
              The Perfect Blend of Comfort &amp; Elegance
            </h2>

            <p
              style={{
                fontSize: 'clamp(0.85rem, 2vw, 1rem)',
                color: 'var(--text-secondary)',
                marginBottom: 'clamp(18px, 3.5vw, 28px)',
                lineHeight: 1.55,
              }}
            >
              Experience the protection of premium-quality mattress protectors crafted to keep your sleeping space hygienic, fresh, and comfortable for years to come.
            </p>

            <Link
              to="/shop?category=premium-collection"
              className="btn btn-primary promo-btn"
              style={{
                padding: 'clamp(10px, 2vw, 12px) clamp(20px, 3vw, 28px)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Explore Collection <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .promo-banner {
            flex-direction: column;
            text-align: center;
          }
          .promo-banner-img {
            position: relative !important;
            width: 100% !important;
            height: clamp(160px, 45vw, 220px) !important;
            mask-image: none !important;
            -webkit-mask-image: none !important;
          }
          .promo-banner-content {
            padding: clamp(20px, 4vw, 32px) clamp(16px, 3.5vw, 24px) !important;
            max-width: 100% !important;
          }
        }
        @media (max-width: 480px) {
          .promo-btn {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </section>
  );
};

export default BannerPromo;
