import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import api from '../../services/api';
import HeroCarousel from './HeroCarousel';

const Hero = () => {
  const [heroData, setHeroData] = useState({
    smallLabel: 'Handcrafted Luxury Living',
    heading: 'Bring Comfort & Elegance Home',
    description:
      'Premium mattress protectors designed for everyday protection. Crafted with waterproof, breathable materials for lasting comfort and hygiene.',
    button1: {
      text: 'Shop Now',
      link: '/shop',
    },
    button2: {
      text: 'Explore Cotton',
      link: '/shop?category=cotton',
    },
    floatingCard: {
      title: 'Signature Heritage Weave',
      subtitle: '100% Combed Cotton • 300+ Thread Count',
      badge: 'In Stock',
      show: true,
    },
    images: [
      {
        url: '/img/HeroCrousel1.jpeg',
        altText: 'VASHTRAM Luxury Mattress Protector',
        isActive: true,
        order: 1,
      },
    ],
  });

  useEffect(() => {
    let isMounted = true;
    const fetchHeroContent = async () => {
      try {
        const res = await api.get('/hero');
        if (res.data?.success && res.data?.hero && isMounted) {
          setHeroData(res.data.hero);
        }
      } catch (err) {
        // Gracefully fallback to default state
        console.warn('Using default hero content:', err.message);
      }
    };

    fetchHeroContent();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section
      style={{
        position: 'relative',
        padding: 'clamp(24px, 5vw, 50px) 0 clamp(32px, 6vw, 60px)',
        overflow: 'hidden',
      }}
      className="hero-section"
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            alignItems: 'center',
            gap: 'clamp(24px, 4.5vw, 48px)',
          }}
          className="hero-grid"
        >
          {/* Left Text Content */}
          <div style={{ maxWidth: '540px', width: '100%' }} className="hero-text-container">
            {heroData.smallLabel && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent-color)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                }}
              >
                <Sparkles size={13} />
                <span>{heroData.smallLabel}</span>
              </div>
            )}

            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.75rem, 5vw, 3.4rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.18,
                marginBottom: '16px',
                letterSpacing: '-0.01em',
              }}
            >
              {heroData.heading}
            </h1>

            <p
              style={{
                fontSize: 'clamp(0.92rem, 2.2vw, 1.08rem)',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: '28px',
              }}
            >
              {heroData.description}
            </p>

            <div className="hero-btn-group">
              {heroData.button1?.text && (
                <Link
                  to={heroData.button1.link || '/shop'}
                  className="btn btn-primary btn-lg"
                  style={{
                    padding: '12px 28px',
                    borderRadius: 'var(--radius-sm)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {heroData.button1.text} <ArrowRight size={18} />
                </Link>
              )}

              {heroData.button2?.text && (
                <Link
                  to={heroData.button2.link || '/shop?category=cotton'}
                  className="btn btn-secondary btn-lg"
                  style={{
                    padding: '12px 24px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {heroData.button2.text}
                </Link>
              )}
            </div>
          </div>

          {/* Right Image Carousel Showcase */}
          <div className="hero-carousel-container" style={{ width: '100%', minWidth: 0 }}>
            <HeroCarousel
              images={heroData.images || []}
              floatingCard={heroData.floatingCard}
            />
          </div>
        </div>
      </div>

      <style>{`
        .hero-btn-group {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        @media (max-width: 640px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
          .hero-text-container {
            max-width: 100% !important;
          }
        }
        @media (max-width: 480px) {
          .hero-btn-group {
            flex-direction: column;
            width: 100%;
            gap: 10px;
          }
          .hero-btn-group a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
};

export default Hero;
