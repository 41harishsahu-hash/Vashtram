import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { ArrowRight, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { resolveImageUrl, PLACEHOLDER_IMAGE } from '../../utils/imageUrl';

// Single interactive category card with 1-4 image carousel
const CategoryCard = ({ cat }) => {
  const rawImages =
    Array.isArray(cat.images) && cat.images.length > 0
      ? cat.images
      : cat.image
      ? [cat.image]
      : [];

  const images = rawImages.filter(Boolean);
  const defaultFallback = PLACEHOLDER_IMAGE;

  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-cycle through images on hover if multiple exist
  useEffect(() => {
    if (!isHovered || images.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isHovered, images.length]);

  const handlePrev = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIdx((prev) => (prev + 1) % images.length);
  };

  const handleSelectDot = (e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIdx(idx);
  };

  const currentImg = resolveImageUrl(images[activeIdx] || defaultFallback, defaultFallback);

  return (
    <Link
      to={`/shop?category=${cat.slug}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setActiveIdx(0);
      }}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'transform var(--transition-normal), box-shadow var(--transition-normal)',
      }}
      className="category-card"
    >
      {/* Image Carousel Container */}
      <div
        style={{
          position: 'relative',
          paddingTop: '90%',
          backgroundColor: 'var(--bg-secondary)',
          overflow: 'hidden',
        }}
      >
        <img
          src={currentImg}
          alt={`${cat.name} slide ${activeIdx + 1}`}
          loading="lazy"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.4s ease, opacity 0.3s ease',
          }}
          className="cat-img"
        />

        {/* Multi-image Badge */}
        {images.length > 1 && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              backgroundColor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              color: '#fff',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 3,
            }}
          >
            <Layers size={11} /> {images.length}
          </div>
        )}

        {/* Carousel Navigation Arrows (Visible if > 1 image) */}
        {images.length > 1 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 6px',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
              transition: 'opacity 0.2s ease',
              zIndex: 4,
            }}
            className="carousel-controls"
          >
            <button
              type="button"
              onClick={handlePrev}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.92)',
                color: '#1F1D1A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Previous image"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={handleNext}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.92)',
                color: '#1F1D1A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Next image"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Carousel Dot Indicators */}
        {images.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: '4px',
              zIndex: 4,
            }}
          >
            {images.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={(e) => handleSelectDot(e, dotIdx)}
                style={{
                  width: activeIdx === dotIdx ? '14px' : '5px',
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor:
                    activeIdx === dotIdx ? 'var(--accent-color, #8B6239)' : 'rgba(255,255,255,0.7)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
                title={`Slide ${dotIdx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card Info */}
      <div
        style={{
          padding: '14px 12px',
          textAlign: 'center',
        }}
      >
        <h3
          style={{
            fontSize: '0.92rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '3px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cat.name}
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {cat.productCount ? `${cat.productCount} Designs` : 'Mattress Protectors'}
        </span>
      </div>
    </Link>
  );
};

const CategoryGrid = () => {
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

  if (loading) {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading categories...</p>
      </div>
    );
  }

  return (
    <section style={{ padding: 'clamp(28px, 5vw, 50px) 0' }}>
      <div className="container">
        {/* Section Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: 'clamp(18px, 4vw, 28px)',
          }}
        >
          <div style={{ maxWidth: '600px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.4rem, 4vw, 2.2rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Shop by Category
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.82rem, 2vw, 0.95rem)', marginTop: '4px' }}>
              Curated collections woven for every bed dimension and lifestyle
            </p>
          </div>

          <Link
            to="/categories"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'clamp(0.82rem, 2vw, 0.9rem)',
              fontWeight: 600,
              color: 'var(--accent-color)',
              whiteSpace: 'nowrap',
            }}
          >
            Explore All Collections <ArrowRight size={16} />
          </Link>
        </div>

        {/* Category Cards Grid with 1-4 Image Carousels */}
        <div className="responsive-category-grid">
          {categories.map((cat) => (
            <CategoryCard key={cat._id} cat={cat} />
          ))}
        </div>
      </div>

      <style>{`
        .category-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
        .category-card:hover .cat-img {
          transform: scale(1.05);
        }
      `}</style>
    </section>
  );
};

export default CategoryGrid;
