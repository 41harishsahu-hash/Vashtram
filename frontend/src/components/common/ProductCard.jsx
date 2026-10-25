import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/useCart';
import { Star, ShoppingBag } from 'lucide-react';
import { resolveImageUrl, PLACEHOLDER_IMAGE } from '../../utils/imageUrl';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();

  if (!product) return null;

  const {
    _id,
    name,
    slug,
    price,
    discountPrice,
    images,
    rating = 4.8,
    numReviews = 24,
    stock = 10,
    size = 'King',
    material = '100% Pure Cotton',
  } = product;

  const defaultImg = PLACEHOLDER_IMAGE;
  const rawPrimary = images && images.length > 0 ? images[0] : defaultImg;
  const primaryImage = resolveImageUrl(rawPrimary, defaultImg);

  const hasMultipleSizes = product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0;
  const prices = hasMultipleSizes
    ? product.sizes.map((s) => Number(s.price)).filter((p) => !isNaN(p) && p >= 0)
    : [];
  const hasDiscount = Boolean(
    discountPrice && Number(discountPrice) > 0 && Number(discountPrice) < Number(price)
  );
  const minPrice =
    prices.length > 0
      ? Math.min(...prices)
      : hasDiscount
      ? Number(discountPrice)
      : price;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : minPrice;
  const isPriceRange = hasMultipleSizes && minPrice !== maxPrice;

  const currentPrice = minPrice;
  const discountPercent =
    hasDiscount && !hasMultipleSizes
      ? Math.round(((price - Number(discountPrice)) / price) * 100)
      : 0;

  const isOutOfStock = stock <= 0;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        transition: 'transform var(--transition-normal), box-shadow var(--transition-normal)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      className="product-card"
    >
      {/* Image Container */}
      <Link
        to={`/product/${slug || _id}`}
        style={{
          display: 'block',
          position: 'relative',
          paddingTop: '80%', // ~4:3 aspect ratio
          overflow: 'hidden',
          backgroundColor: 'var(--bg-secondary)',
        }}
        className="image-wrap"
      >
        <img
          src={primaryImage}
          alt={name}
          loading="lazy"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.5s ease',
          }}
          className="product-img"
        />

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              backgroundColor: 'var(--badge-discount-bg)',
              color: 'var(--badge-discount-text)',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              letterSpacing: '0.04em',
              zIndex: 2,
            }}
          >
            {discountPercent}% OFF
          </span>
        )}

        {/* Stock status overlay if out of stock */}
        {isOutOfStock && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3,
            }}
          >
            <span
              style={{
                backgroundColor: '#C5221F',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Out of Stock
            </span>
          </div>
        )}
      </Link>

      {/* Card Body */}
      <div
        style={{
          padding: 'clamp(10px, 2.5vw, 16px)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'space-between',
          gap: 'clamp(8px, 1.8vw, 12px)',
        }}
      >
        <div>
          {/* Category / Material / Size meta */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px',
              flexWrap: 'wrap',
              gap: '4px',
            }}
          >
            <span
              style={{
                fontSize: 'clamp(0.68rem, 1.6vw, 0.75rem)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              {hasMultipleSizes ? `${product.sizes.length} Sizes` : size} • {material.split(' ')[0]}
            </span>

            {/* Rating */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: 'clamp(0.72rem, 1.6vw, 0.78rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              <Star size={12} fill="#E5A93C" stroke="#E5A93C" />
              <span>{rating.toFixed(1)}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({numReviews})</span>
            </div>
          </div>

          {/* Product Title */}
          <Link
            to={`/product/${slug || _id}`}
            style={{
              fontSize: 'clamp(0.85rem, 2vw, 1rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3,
            }}
            title={name}
          >
            {name}
          </Link>
        </div>

        {/* Pricing and Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 'clamp(0.95rem, 2.2vw, 1.15rem)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {isPriceRange ? `From ₹${currentPrice.toLocaleString('en-IN')}` : `₹${currentPrice.toLocaleString('en-IN')}`}
              </span>
              {hasDiscount && !hasMultipleSizes && (
                <span
                  style={{
                    fontSize: 'clamp(0.72rem, 1.8vw, 0.85rem)',
                    color: 'var(--text-muted)',
                    textDecoration: 'line-through',
                  }}
                >
                  ₹{price.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              const defaultSize = hasMultipleSizes && product.sizes?.length > 0 ? product.sizes[0] : null;
              addToCart(product, 1, defaultSize, product.color || null);
            }}
            disabled={isOutOfStock}
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: 'clamp(0.72rem, 1.6vw, 0.8rem)',
              padding: 'clamp(4px, 1vw, 6px) clamp(8px, 1.8vw, 12px)',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Add to Cart"
          >
            <ShoppingBag size={13} /> Add
          </button>
        </div>
      </div>

      <style>{`
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
        .product-card:hover .product-img {
          transform: scale(1.04);
        }
      `}</style>
    </div>
  );
};

export default ProductCard;
