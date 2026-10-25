import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';

import { PLACEHOLDER_IMAGE } from '../utils/imageUrl';

const CategoryShowcaseCard = ({ cat }) => {
  const rawImages =
    Array.isArray(cat.images) && cat.images.length > 0
      ? cat.images
      : cat.image
        ? [cat.image]
        : [];

  const images = rawImages.filter(Boolean);
  const defaultFallback = PLACEHOLDER_IMAGE;

  const [activeIdx, setActiveIdx] = useState(0);

  const handlePrev = (e) => {
    e.preventDefault();
    setActiveIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.preventDefault();
    setActiveIdx((prev) => (prev + 1) % images.length);
  };

  const currentImg = images[activeIdx] || defaultFallback;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg, 14px)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        alignItems: 'center',
        gap: '0',
      }}
      className="category-showcase-card"
    >
      {/* Left Column: 1-4 Image Carousel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 'clamp(220px, 55vw, 340px)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 'clamp(200px, 50vw, 300px)' }}>
          <img
            src={currentImg}
            alt={`${cat.name} image ${activeIdx + 1}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'opacity 0.35s ease',
            }}
          />

          {/* Carousel Slide Count Badge */}
          {images.length > 1 && (
            <div
              style={{
                position: 'absolute',
                top: '14px',
                left: '14px',
                backgroundColor: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(6px)',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                zIndex: 2,
              }}
            >
              <Layers size={13} /> {activeIdx + 1} of {images.length}
            </div>
          )}

          {/* Next / Prev Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                  border: 'none',
                  cursor: 'pointer',
                  zIndex: 3,
                  transition: 'background-color 0.2s, transform 0.2s',
                }}
                className="carousel-nav-btn"
                title="Previous slide"
              >
                <ChevronLeft size={20} />
              </button>

              <button
                type="button"
                onClick={handleNext}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                  border: 'none',
                  cursor: 'pointer',
                  zIndex: 3,
                  transition: 'background-color 0.2s, transform 0.2s',
                }}
                className="carousel-nav-btn"
                title="Next slide"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Slide Indicator Dots */}
          {images.length > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                zIndex: 3,
              }}
            >
              {images.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => setActiveIdx(dotIdx)}
                  style={{
                    width: activeIdx === dotIdx ? '22px' : '7px',
                    height: '7px',
                    borderRadius: '4px',
                    backgroundColor:
                      activeIdx === dotIdx ? 'var(--accent-color, #8B6239)' : 'rgba(255,255,255,0.7)',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }}
                  title={`Slide ${dotIdx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail Bar below image (if multiple images) */}
        {images.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-card)',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            {images.map((img, thumbIdx) => (
              <button
                key={thumbIdx}
                type="button"
                onClick={() => setActiveIdx(thumbIdx)}
                style={{
                  width: '54px',
                  height: '42px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border:
                    activeIdx === thumbIdx
                      ? '2px solid var(--accent-color)'
                      : '1px solid var(--border-color)',
                  opacity: activeIdx === thumbIdx ? 1 : 0.65,
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s, border-color 0.2s',
                  flexShrink: 0,
                }}
              >
                <img
                  src={img}
                  alt="thumbnail"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Category Description & Actions */}
      <div
        style={{
          padding: 'clamp(20px, 4vw, 36px) clamp(16px, 3.5vw, 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--accent-color)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Curated Collection
          </span>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(1.5rem, 2.5vw, 1.9rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.25,
            }}
          >
            {cat.name}
          </h2>
        </div>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.94rem',
            lineHeight: 1.6,
          }}
        >
          {cat.description ||
            `Experience handcrafted elegance in our ${cat.name} collection. Specially designed with skin-friendly fibers and tailored for all standard bed sizes.`}
        </p>

        {/* Feature Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.78rem',
              fontWeight: 500,
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <CheckCircle size={13} style={{ color: 'var(--accent-color)' }} />
            {cat.productCount ? `${cat.productCount} Designs Available` : 'Available in All Sizes'}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.78rem',
              fontWeight: 500,
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <ShieldCheck size={13} style={{ color: 'var(--accent-color)' }} />
            Color Fastness Guaranteed
          </span>
        </div>

        <div style={{ marginTop: '8px' }}>
          <Link
            to={`/shop?category=${cat.slug}`}
            className="btn btn-primary cat-showcase-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 22px' }}
          >
            Explore {cat.name} Range <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data?.success) {
          setCategories(res.data.categories);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return (
    <div style={{ padding: 'clamp(24px, 4vw, 36px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container">
        {/* Page Header */}
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto clamp(24px, 4vw, 48px)' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--accent-color)',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            <Sparkles size={14} /> #Top Catalogs
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(1.7rem, 3.8vw, 2.7rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '12px',
            }}
          >
            Mattress Protectors & Home Collections
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2vw, 1rem)', lineHeight: 1.6 }}>
            Explore our curated collections of waterproof, breathable, and hypoallergenic mattress protectors tailored for lasting protection and a comfortable night's sleep.
          </p>
        </div>

        {/* Categories Showcase List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Loading collections...
          </div>
        ) : categories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            No categories available at the moment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
            {categories.map((cat) => (
              <CategoryShowcaseCard key={cat._id} cat={cat} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 860px) {
          .category-showcase-card {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .cat-showcase-btn {
            width: 100% !important;
            justify-content: center !important;
          }
        }
        .carousel-nav-btn:hover {
          background-color: #fff !important;
          transform: translateY(-50%) scale(1.08) !important;
        }
      `}</style>
    </div>
  );
};

export default CategoriesPage;
