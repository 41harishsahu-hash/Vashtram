import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveImageUrl } from '../../utils/imageUrl';

const HeroCarousel = ({ images = [], floatingCard = {} }) => {
  // Filter active images and sort by order
  const activeImages = images
    .filter((img) => img.isActive !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Fallback if no images are provided or active
  const displayImages = activeImages.length > 0 ? activeImages : [
    {
      _id: 'default-hero',
      url: '/img/HeroCrousel1.jpeg',
      altText: 'VASHTRAM Luxury Mattress Protector',
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const autoPlayTimer = useRef(null);

  // Derive active index safely without setState-in-effect
  const activeIndex = currentIndex >= displayImages.length ? 0 : currentIndex;

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % displayImages.length);
  }, [displayImages.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  }, [displayImages.length]);

  const goToSlide = (idx) => {
    setCurrentIndex(idx);
  };

  // Autoplay functionality: advances every 5 seconds unless hovered
  useEffect(() => {
    if (displayImages.length <= 1 || isHovered) {
      if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
      return;
    }

    autoPlayTimer.current = setInterval(() => {
      handleNext();
    }, 5000);

    return () => {
      if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    };
  }, [displayImages.length, isHovered, handleNext]);

  // Touch Swipe Handlers for Mobile and Tablet
  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 45) {
      // Swiped Left -> Next
      handleNext();
    } else if (diff < -45) {
      // Swiped Right -> Prev
      handlePrev();
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-roledescription="carousel"
      aria-label="Hero Image Showcase"
    >
      {/* Slides Track */}
      <div
        style={{
          display: 'flex',
          transform: `translateX(-${activeIndex * 100}%)`,
          transition: 'transform 0.55s cubic-bezier(0.25, 1, 0.5, 1)',
          width: '100%',
        }}
      >
        {displayImages.map((img, idx) => (
          <div
            key={img._id || `hero-img-${idx}`}
            style={{
              minWidth: '100%',
              width: '100%',
              height: 'clamp(220px, 55vw, 480px)',
              position: 'relative',
              flexShrink: 0,
            }}
            className="hero-slide"
          >
            <img
              src={resolveImageUrl(img.url)}
              alt={img.altText || `VASHTRAM Mattress Protector slide ${idx + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              loading={idx === 0 ? 'eager' : 'lazy'}
            />
            {/* Subtle Gradient Overlay for enhanced contrast */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows (shown if more than 1 image) */}
      {displayImages.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous slide"
            style={{
              position: 'absolute',
              top: '50%',
              left: '14px',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.88)',
              color: '#1F1D1A',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              transition: 'all var(--transition-fast)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
            className="hero-arrow-btn hero-arrow-left"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Next slide"
            style={{
              position: 'absolute',
              top: '50%',
              right: '14px',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.88)',
              color: '#1F1D1A',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              transition: 'all var(--transition-fast)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
            className="hero-arrow-btn hero-arrow-right"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Slide Indicators / Dots */}
      {displayImages.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 'clamp(10px, 2.5vw, 20px)',
            right: 'clamp(10px, 2.5vw, 20px)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          {displayImages.map((_, dotIdx) => (
            <button
              key={`dot-${dotIdx}`}
              type="button"
              onClick={() => goToSlide(dotIdx)}
              aria-label={`Go to slide ${dotIdx + 1}`}
              style={{
                width: activeIndex === dotIdx ? '20px' : '7px',
                height: '7px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: activeIndex === dotIdx ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Floating Trust Card */}
      {floatingCard?.show !== false && (
        <div
          style={{
            position: 'absolute',
            bottom: 'clamp(8px, 2vw, 20px)',
            left: 'clamp(8px, 2vw, 20px)',
            right: 'clamp(8px, 2vw, 20px)',
            backgroundColor: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 'var(--radius-md)',
            padding: 'clamp(8px, 1.8vw, 14px) clamp(10px, 2.2vw, 18px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            zIndex: 10,
          }}
          className="hero-floating-card"
        >
          <div style={{ marginRight: '8px', minWidth: 0 }}>
            <p
              style={{
                fontSize: 'clamp(0.64rem, 1.8vw, 0.74rem)',
                fontWeight: 700,
                color: '#8B6239',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {floatingCard?.title || 'Signature Heritage Weave'}
            </p>
            <p
              style={{
                fontSize: 'clamp(0.76rem, 2.1vw, 0.92rem)',
                fontWeight: 600,
                color: '#1F1D1A',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {floatingCard?.subtitle || '100% Combed Cotton • 300+ Thread Count'}
            </p>
          </div>
          <span
            style={{
              fontSize: 'clamp(0.7rem, 1.8vw, 0.82rem)',
              fontWeight: 600,
              color: '#137333',
              backgroundColor: '#E6F4EA',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {floatingCard?.badge || 'In Stock'}
          </span>
        </div>
      )}

      <style>{`
        .hero-arrow-btn:hover {
          background-color: #FFFFFF !important;
          transform: translateY(-50%) scale(1.08) !important;
          box-shadow: 0 6px 16px rgba(0,0,0,0.2) !important;
        }
        @media (max-width: 640px) {
          .hero-arrow-btn {
            width: 30px !important;
            height: 30px !important;
          }
          .hero-arrow-left {
            left: 6px !important;
          }
          .hero-arrow-right {
            right: 6px !important;
          }
        }
        @media (max-width: 480px) {
          .hero-arrow-btn {
            width: 26px !important;
            height: 26px !important;
            opacity: 0.85;
          }
        }
      `}</style>
    </div>
  );
};

export default HeroCarousel;
