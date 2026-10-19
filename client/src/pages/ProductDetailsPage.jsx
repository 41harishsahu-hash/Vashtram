import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useCart } from '../context/useCart';
import ProductCard from '../components/common/ProductCard';
import { formatSizeLabel } from '../utils/sizeHelper';
import useBodyScrollLock from '../utils/useBodyScrollLock';
import {
  Star,
  ChevronLeft,
  Maximize2,
  ShoppingBag,
  Zap,
  Truck,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  Plus,
  Minus,
  X,
} from 'lucide-react';
import { WhatsAppIcon } from '../components/common/WhatsAppButton';
import { useSettings } from '../context/useSettings';
import { resolveImageUrl, PLACEHOLDER_IMAGE } from '../utils/imageUrl';

const ProductDetailsPage = () => {
  const { identifier } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { getWhatsAppUrl } = useSettings();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');

  // Lock background scroll when lightbox is open
  useBodyScrollLock(isLightboxOpen);

  // Close lightbox on Escape key and navigate with Left/Right Arrow keys
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        const imgList = product?.images && product.images.length > 0 ? product.images : [PLACEHOLDER_IMAGE];
        setSelectedImage((prev) => (prev > 0 ? prev - 1 : imgList.length - 1));
      } else if (e.key === 'ArrowRight') {
        const imgList = product?.images && product.images.length > 0 ? product.images : [PLACEHOLDER_IMAGE];
        setSelectedImage((prev) => (prev < imgList.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, product?.images]);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/products/${identifier}`);
        if (res.data?.success) {
          setProduct(res.data.product);
          setRelatedProducts(res.data.relatedProducts || []);
          setSelectedImage(0);
          setSelectedSizeIndex(0);
          setQuantity(1);
        }
      } catch (err) {
        setError(err.message || 'Product not found');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [identifier]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '120px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '16px' }}>Product Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          The product you are looking for might have been moved or is no longer available.
        </p>
        <Link to="/shop" className="btn btn-primary">
          Back to Shop
        </Link>
      </div>
    );
  }

  const {
    name,
    description,
    price,
    discountPrice,
    images = [],
    material,
    size,
    color,
    pattern,
    stock = 0,
    sku,
    rating = 4.8,
    numReviews = 24,
    threadCount = 300,
    dimensions,
    pillowCovers,
    careInstructions,
    category,
  } = product;

  const hasMultipleSizes = product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0;
  const currentSelectedSize = hasMultipleSizes ? product.sizes[selectedSizeIndex] || product.sizes[0] : null;

  const originalPrice = Number(price) || 0;
  const currentPrice = currentSelectedSize
    ? Number(currentSelectedSize.price)
    : (discountPrice && Number(discountPrice) > 0 && Number(discountPrice) < originalPrice
      ? Number(discountPrice)
      : originalPrice);

  const hasDiscount = originalPrice > currentPrice;
  const savingsAmount = hasDiscount ? originalPrice - currentPrice : 0;
  const discountPercent =
    hasDiscount && originalPrice > 0
      ? Math.round((savingsAmount / originalPrice) * 100)
      : 0;

  const currentSizeLabel = currentSelectedSize
    ? formatSizeLabel(currentSelectedSize)
    : (size || 'King Size');

  const isOutOfStock = stock <= 0;

  const handleAddToCart = () => {
    const chosenSize = hasMultipleSizes && currentSelectedSize ? currentSelectedSize : size;
    addToCart(product, quantity, chosenSize, color);
  };

  const handleBuyNow = () => {
    const chosenSize = hasMultipleSizes && currentSelectedSize ? currentSelectedSize : size;
    addToCart(product, quantity, chosenSize, color);
    navigate('/checkout');
  };

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container">
        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '28px',
            flexWrap: 'wrap',
          }}
        >
          <Link to="/" style={{ color: 'var(--text-muted)' }}>
            Home
          </Link>
          <ChevronRight size={14} />
          <Link to="/shop" style={{ color: 'var(--text-muted)' }}>
            Shop
          </Link>
          {category && (
            <>
              <ChevronRight size={14} />
              <Link to={`/shop?category=${category.slug}`} style={{ color: 'var(--text-muted)' }}>
                {category.name}
              </Link>
            </>
          )}
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{name}</span>
        </div>

        {/* Product Details Section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1.1fr) 1fr',
            gap: '48px',
            marginBottom: '64px',
          }}
          className="product-details-grid"
        >
          {/* Left Column: Horizontal Image Carousel & Gallery (Sticky on Desktop) */}
          <div className="product-gallery-sticky">
            {/* Main Carousel Viewport Frame */}
            <div
              style={{
                position: 'relative',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                marginBottom: '16px',
                aspectRatio: '16 / 11',
                boxShadow: 'var(--shadow-sm)',
              }}
              onTouchStart={(e) => setTouchStart(e.targetTouches[0].clientX)}
              onTouchEnd={(e) => {
                const touchEnd = e.changedTouches[0].clientX;
                const imgList = images.length > 0 ? images : [PLACEHOLDER_IMAGE];
                if (touchStart - touchEnd > 50) {
                  // Swipe Left -> Next Image
                  setSelectedImage((prev) => (prev < imgList.length - 1 ? prev + 1 : 0));
                } else if (touchEnd - touchStart > 50) {
                  // Swipe Right -> Prev Image
                  setSelectedImage((prev) => (prev > 0 ? prev - 1 : imgList.length - 1));
                }
              }}
            >
              {/* Horizontal Sliding Track */}
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  transform: `translateX(-${selectedImage * 100}%)`,
                  transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
                }}
              >
                {(images.length > 0 ? images : [PLACEHOLDER_IMAGE]).map((imgUrl, idx) => (
                  <div
                    key={idx}
                    onClick={() => setIsLightboxOpen(true)}
                    style={{
                      minWidth: '100%',
                      width: '100%',
                      height: '100%',
                      position: 'relative',
                      flexShrink: 0,
                      cursor: 'zoom-in',
                    }}
                    title="Click to view full screen"
                  >
                    <img
                      src={resolveImageUrl(imgUrl)}
                      alt={`${name} - Angle ${idx + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Discount Badge */}
              {discountPercent > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    backgroundColor: 'var(--badge-discount-bg, #C5A880)',
                    color: 'var(--badge-discount-text, #ffffff)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    letterSpacing: '0.04em',
                    zIndex: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  {discountPercent}% OFF
                </span>
              )}

              {/* Slide Counter Pill */}
              {images.length > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.88)',
                    backdropFilter: 'blur(8px)',
                    color: '#1a1a1a',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    zIndex: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                  }}
                >
                  <span>🖼️ {selectedImage + 1} / {images.length}</span>
                </div>
              )}

              {/* Zoom Button */}
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                title="Open fullscreen view"
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.88)',
                  backdropFilter: 'blur(6px)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1a1a1a',
                  cursor: 'pointer',
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <Maximize2 size={16} />
              </button>

              {/* Horizontal Navigation Arrows (shown when > 1 image) */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                    }}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      zIndex: 10,
                      boxShadow: '0 3px 10px rgba(0, 0, 0, 0.15)',
                      transition: 'all var(--transition-fast)',
                    }}
                    title="Previous Image (←)"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                    }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      zIndex: 10,
                      boxShadow: '0 3px 10px rgba(0, 0, 0, 0.15)',
                      transition: 'all var(--transition-fast)',
                    }}
                    title="Next Image (→)"
                  >
                    <ChevronRight size={20} />
                  </button>

                  {/* Horizontal Slide Indicator Dots */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '14px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      gap: '6px',
                      alignItems: 'center',
                      zIndex: 10,
                      backgroundColor: 'rgba(0, 0, 0, 0.35)',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {images.map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(dotIdx);
                        }}
                        style={{
                          width: selectedImage === dotIdx ? '20px' : '7px',
                          height: '7px',
                          borderRadius: '9999px',
                          backgroundColor: selectedImage === dotIdx ? 'var(--accent-color, #C5A880)' : 'rgba(255, 255, 255, 0.6)',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          transition: 'all 0.25s ease',
                        }}
                        title={`Slide ${dotIdx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Horizontal Thumbnail Gallery */}
            {images.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                  alignItems: 'center',
                }}
              >
                {images.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      border:
                        selectedImage === idx
                          ? '2px solid var(--accent-color, #C5A880)'
                          : '1px solid var(--border-color)',
                      flexShrink: 0,
                      padding: 0,
                      backgroundColor: 'var(--bg-secondary)',
                      position: 'relative',
                      cursor: 'pointer',
                      transform: selectedImage === idx ? 'scale(1.03)' : 'scale(1)',
                      transition: 'all var(--transition-fast)',
                      boxShadow: selectedImage === idx ? '0 3px 8px rgba(0,0,0,0.12)' : 'none',
                    }}
                    title={`View Image ${idx + 1}${idx === 0 ? ' (Primary)' : ''}`}
                  >
                    <img
                      src={resolveImageUrl(imgUrl)}
                      alt={`Thumbnail ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {idx === 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          backgroundColor: 'rgba(139, 98, 57, 0.85)',
                          color: '#fff',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          textAlign: 'center',
                          padding: '1px 0',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Primary
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Information & Purchase */}
          <div>
            <span
              style={{
                fontSize: '0.82rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                color: 'var(--accent-color)',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              {category?.name || 'Pure Luxury Cotton'} • SKU: {sku}
            </span>

            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.25,
                marginBottom: '12px',
              }}
            >
              {name}
            </h1>

            {/* Rating Stars & Reviews */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    fill={i < Math.floor(rating) ? '#E5A93C' : '#E0E0E0'}
                    stroke={i < Math.floor(rating) ? '#E5A93C' : '#E0E0E0'}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {rating.toFixed(1)}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ({numReviews} Verified Buyer Reviews)
              </span>
            </div>

            {/* Price Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '12px',
                padding: '16px 20px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '24px',
                border: '1px solid var(--border-color)',
              }}
            >
              <span
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                ₹{currentPrice.toLocaleString('en-IN')}
              </span>

              {hasDiscount && (
                <>
                  <span
                    style={{
                      fontSize: '1.1rem',
                      color: 'var(--text-muted)',
                      textDecoration: 'line-through',
                    }}
                  >
                    ₹{originalPrice.toLocaleString('en-IN')}
                  </span>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#137333',
                    }}
                  >
                    You Save ₹{savingsAmount.toLocaleString('en-IN')} ({discountPercent}%)
                  </span>
                </>
              )}
            </div>

            {/* Quick Specs Pills */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
                gap: 'clamp(8px, 2vw, 12px)',
                marginBottom: '28px',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                  Material
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {material}
                </span>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                  Size Option
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentSizeLabel}
                </span>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                  Thread Count
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {threadCount} TC
                </span>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                  Pattern
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {pattern}
                </span>
              </div>
            </div>

            {/* Multiple Size Options Selector */}
            {hasMultipleSizes && (
              <div
                style={{
                  marginBottom: '26px',
                  padding: '18px 20px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '14px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        letterSpacing: '0.02em',
                        marginBottom: '2px',
                      }}
                    >
                      Available Size & Measurement Options ({product.sizes.length})
                    </label>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Select a size option to view its individual price and dimensions
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--accent-color)',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-card)',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    Selected: {currentSizeLabel}
                  </span>
                </div>

                {/* Size Options Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))',
                    gap: '10px',
                  }}
                >
                  {product.sizes.map((s, idx) => {
                    const isSelected = selectedSizeIndex === idx;
                    const measurement = (s.measurement || '').toString().trim();
                    const sizeName = (s.name || '').toString().trim();
                    const optionPrice = Number(s.price);

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedSizeIndex(idx)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected
                            ? '2px solid var(--accent-color, #C5A880)'
                            : '1px solid var(--border-color)',
                          backgroundColor: isSelected
                            ? 'var(--bg-card)'
                            : 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                          boxShadow: isSelected
                            ? '0 3px 12px rgba(197, 168, 128, 0.25)'
                            : 'none',
                          transform: isSelected ? 'scale(1.02)' : 'none',
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: isSelected ? 700 : 600,
                              color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                            }}
                          >
                            {measurement && sizeName && measurement.toLowerCase() !== sizeName.toLowerCase()
                              ? `${measurement} (${sizeName})`
                              : (measurement || sizeName || 'Free Size')}
                          </span>
                          <span
                            style={{
                              fontSize: '0.74rem',
                              color: 'var(--text-muted)',
                              fontWeight: 500,
                            }}
                          >
                            {sizeName}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span
                            style={{
                              fontSize: '1rem',
                              fontWeight: 700,
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            }}
                          >
                            ₹{optionPrice.toLocaleString('en-IN')}
                          </span>
                          {isSelected && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                              ✓ Selected
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: isOutOfStock ? '#C5221F' : stock <= 5 ? '#B06000' : '#137333',
                }}
              />
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  color: isOutOfStock ? '#C5221F' : stock <= 5 ? '#B06000' : '#137333',
                }}
              >
                {isOutOfStock
                  ? 'Currently Out of Stock'
                  : stock <= 5
                    ? `Hurry, only ${stock} items left in stock!`
                    : 'In Stock & Ready to Dispatch'}
              </span>
            </div>

            {/* Quantity Selector and Action Buttons */}
            <div
              className="pdp-actions"
              style={{
                display: 'flex',
                gap: 'clamp(10px, 2.5vw, 16px)',
                alignItems: 'center',
                marginBottom: '32px',
                flexWrap: 'wrap',
              }}
            >
              {/* Quantity */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isOutOfStock}
                  style={{
                    padding: '10px 14px',
                    color: 'var(--text-primary)',
                  }}
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>
                <span
                  style={{
                    padding: '0 12px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    minWidth: '32px',
                    textAlign: 'center',
                  }}
                >
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                  disabled={quantity >= stock || isOutOfStock}
                  style={{
                    padding: '10px 14px',
                    color: 'var(--text-primary)',
                  }}
                  aria-label="Increase quantity"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Add to Cart */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="btn btn-secondary btn-lg"
                style={{ flex: 1, minWidth: '160px' }}
              >
                <ShoppingBag size={18} /> Add to Cart
              </button>

              {/* Buy Now */}
              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="btn btn-primary btn-lg"
                style={{ flex: 1, minWidth: '160px' }}
              >
                <Zap size={18} /> Buy Now
              </button>
            </div>

            {/* Bulk Order WhatsApp Contact Option */}
            <div style={{ marginTop: '12px' }}>
              <a
                href={getWhatsAppUrl(
                  `Hello VASHTRAM team! I am interested in placing a Bulk / Wholesale Order for "${product?.name || 'VASHTRAM products'}". Please share bulk pricing tiers and catalog.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-full"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px 16px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  color: '#075E54',
                  border: '1.5px solid #25D366',
                  borderRadius: 'var(--radius-sm, 6px)',
                  backgroundColor: 'rgba(37, 211, 102, 0.06)',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <WhatsAppIcon size={18} color="#25D366" />
                <span>Need Bulk or Hotel Quantities? Inquire via WhatsApp</span>
              </a>
            </div>

            {/* Reassurance Features */}
            <div
              style={{
                borderTop: '1px solid var(--border-color)',
                paddingTop: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <Truck size={17} style={{ color: 'var(--accent-color)' }} />
                <span>Free express doorstep delivery on orders above ₹999</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <ShieldCheck size={17} style={{ color: 'var(--accent-color)' }} />
                <span>100% Secure Online Payment via Razorpay (UPI, Cards, NetBanking)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <RefreshCw size={17} style={{ color: 'var(--accent-color)' }} />
                <span>Hassle-free 7-day doorstep return and replacement</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Product Details */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            marginBottom: '64px',
          }}
        >
          {/* Tab Navigation */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              overflowX: 'auto',
            }}
          >
            {[
              { id: 'description', label: 'Description' },
              { id: 'specifications', label: 'Specifications' },
              { id: 'care', label: 'Care & Wash Instructions' },
              { id: 'reviews', label: `Reviews (${numReviews})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px clamp(12px, 2.5vw, 24px)',
                  fontSize: 'clamp(0.82rem, 1.8vw, 0.92rem)',
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  color: activeTab === tab.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
                  backgroundColor: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ padding: 'clamp(16px, 3.5vw, 32px)' }}>
            {activeTab === 'description' && (
              <div style={{ maxWidth: '800px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                <p style={{ marginBottom: '16px' }}>{description}</p>
                <p>
                  At VASHTRAM, every mattress protector is crafted with uncompromised attention to waterproofing, breathability, and long-lasting durability. Designed to shield your mattress and provide a hygienic, comfortable sleep surface every night.
                </p>
              </div>
            )}

            {activeTab === 'specifications' && (
              <div style={{ maxWidth: '700px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: 'var(--text-primary)', width: '35%' }}>
                        Product Name
                      </td>
                      <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{name}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Material &amp; Weave
                      </td>
                      <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{material}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Protector Dimensions
                      </td>
                      <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{dimensions}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Pillow Covers Not Included
                      </td>
                      <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{pillowCovers}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Thread Count
                      </td>
                      <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{threadCount} TC</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Pattern &amp; Style
                      </td>
                      <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{pattern}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Country of Origin
                      </td>
                      <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>India</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'care' && (
              <div style={{ maxWidth: '750px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Caring for Your VASHTRAM Mattress Protector
                </h4>
                <p style={{ marginBottom: '16px' }}>{careInstructions}</p>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li>First wash: Wash separately in cold water with mild liquid detergent.</li>
                  <li>Do not use chlorinated bleach or harsh stain removers.</li>
                  <li>Dry in partial shade to retain fabric suppleness and radiant botanical dyes.</li>
                  <li>Iron on warm setting for a crisp hotel finish.</li>
                </ul>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div style={{ maxWidth: '800px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {rating.toFixed(1)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={18} fill="#E5A93C" stroke="#E5A93C" />
                      ))}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Based on {numReviews} customer reviews
                    </p>
                  </div>
                </div>

                {/* Sample Verified Reviews */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Pooja K. (Mumbai)</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>2 weeks ago</span>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', marginBottom: '6px' }}>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} fill="#E5A93C" stroke="#E5A93C" />
                      ))}
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      "The fabric quality is outstanding! It stays so cool at night and feels genuinely like 5-star hotel sheets. Delivery was prompt."
                    </p>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Vikram M. (Bengaluru)</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1 month ago</span>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', marginBottom: '6px' }}>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} fill="#E5A93C" stroke="#E5A93C" />
                      ))}
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      "Exact fit on my 10-inch King mattress. No slipping off corners. Highly recommend VASHTRAM."
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Products Grid */}
        {relatedProducts.length > 0 && (
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.3rem, 3vw, 1.6rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'clamp(16px, 3vw, 24px)',
              }}
            >
              You May Also Like
            </h3>
            <div className="responsive-product-grid">
              {relatedProducts.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal (Portal to body to ensure top-level stacking above all page elements) */}
      {isLightboxOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} Fullscreen Gallery`}
          onClick={() => setIsLightboxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(10, 10, 10, 0.94)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal, 50000)',
            padding: 'clamp(12px, 3vw, 24px)',
            boxSizing: 'border-box',
          }}
        >
          {/* Modal Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '1100px',
              maxHeight: '94vh',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Top-Right Floating Close Button */}
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              aria-label="Close fullscreen view"
              title="Close (Esc)"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 20,
                transition: 'all 0.2s ease',
              }}
            >
              <X size={20} />
            </button>

            {/* Main Centered Image Area */}
            <div
              style={{
                flex: 1,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <img
                src={resolveImageUrl((images.length > 0 ? images[selectedImage] : null) || PLACEHOLDER_IMAGE)}
                alt={`${name} Fullscreen`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '78vh',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                }}
              />
            </div>

            {/* Bottom Controls Bar */}
            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center',
                zIndex: 10,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const imgList = images.length > 0 ? images : [PLACEHOLDER_IMAGE];
                  setSelectedImage((prev) => (prev > 0 ? prev - 1 : imgList.length - 1));
                }}
                className="btn btn-secondary btn-sm"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                ← Previous
              </button>
              <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
                {selectedImage + 1} / {images.length || 1}
              </span>
              <button
                type="button"
                onClick={() => {
                  const imgList = images.length > 0 ? images : [PLACEHOLDER_IMAGE];
                  setSelectedImage((prev) => (prev < imgList.length - 1 ? prev + 1 : 0));
                }}
                className="btn btn-secondary btn-sm"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                Next →
              </button>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="btn btn-sm"
                style={{ marginLeft: '12px', color: '#fff', backgroundColor: 'rgba(200,50,50,0.85)' }}
              >
                Close ✕
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @media (min-width: 861px) {
          .product-gallery-sticky {
            position: -webkit-sticky !important;
            position: sticky !important;
            top: 92px !important;
            align-self: start !important;
            max-height: calc(100vh - 104px);
          }
        }
        @media (max-width: 860px) {
          .product-details-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
          .product-gallery-sticky {
            position: static !important;
            top: auto !important;
            align-self: auto !important;
            max-height: none !important;
          }
        }
        @media (max-width: 540px) {
          .pdp-actions {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .pdp-actions > div {
            width: 100% !important;
            justify-content: center !important;
          }
          .pdp-actions .btn {
            width: 100% !important;
            min-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ProductDetailsPage;
