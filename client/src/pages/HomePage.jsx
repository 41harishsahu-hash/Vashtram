import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Hero from '../components/home/Hero';
import ValueProps from '../components/home/ValueProps';
import CategoryGrid from '../components/home/CategoryGrid';
import BannerPromo from '../components/home/BannerPromo';
import WhyChooseUs from '../components/home/WhyChooseUs';
import ProductCard from '../components/common/ProductCard';
import { ArrowRight, Sparkles } from 'lucide-react';

const HomePage = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await api.get('/products/featured');
        if (res.data?.success) {
          setFeaturedProducts(res.data.products);
        }
      } catch (err) {
        console.error('Failed to load featured products', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <Hero />

      {/* Value Propositions Strip */}
      <ValueProps />

      {/* Featured Products Section */}
      <section style={{ padding: 'clamp(28px, 4vw, 50px) 0 clamp(36px, 5vw, 60px)' }}>
        <div className="container">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: 'clamp(18px, 4vw, 32px)',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--accent-color)',
                  fontSize: 'clamp(0.72rem, 1.8vw, 0.8rem)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '4px',
                }}
              >
                <Sparkles size={14} />
                <span>Most Loved</span>
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(1.4rem, 4vw, 2.2rem)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Featured Products
              </h2>
            </div>

            <Link
              to="/shop"
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
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: 'var(--text-muted)' }}>Loading featured collections...</p>
            </div>
          ) : (
            <div className="responsive-product-grid">
              {featuredProducts.slice(0, 4).map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Shop by Category */}
      <CategoryGrid />

      {/* Promo Banner */}
      <BannerPromo />

      {/* Why Choose VASHTRAM */}
      <WhyChooseUs />
    </div>
  );
};

export default HomePage;
