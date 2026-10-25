import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/common/ProductCard';
import { Search, SlidersHorizontal, X, ChevronRight, ChevronLeft } from 'lucide-react';

const ShopPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [selectedSize, setSelectedSize] = useState(searchParams.get('size') || 'all');
  const [maxPrice, setMaxPrice] = useState(Number(searchParams.get('maxPrice')) || 5000);
  const [selectedColor, setSelectedColor] = useState(searchParams.get('color') || 'all');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('inStock') === 'true');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'popular');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  // Data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Sync state from URL parameters
  useEffect(() => {
    const timer = setTimeout(() => {
      const cat = searchParams.get('category') || 'all';
      const q = searchParams.get('search') || '';
      const sz = searchParams.get('size') || 'all';
      const srt = searchParams.get('sort') || 'popular';
      const pg = Number(searchParams.get('page')) || 1;

      setSelectedCategory(cat);
      setSearchQuery(q);
      setSelectedSize(sz);
      setSortBy(srt);
      setPage(pg);
    }, 0);

    return () => clearTimeout(timer);
  }, [searchParams]);

  // Fetch Categories
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data?.success) {
          setCategories(res.data.categories);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCats();
  }, []);

  // Fetch Products based on current filters
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: 9,
          sort: sortBy,
        };

        if (searchQuery.trim()) params.search = searchQuery.trim();
        if (selectedCategory !== 'all') params.category = selectedCategory;
        if (selectedSize !== 'all') params.size = selectedSize;
        if (selectedColor !== 'all') params.color = selectedColor;
        if (maxPrice < 5000) params.maxPrice = maxPrice;
        if (inStockOnly) params.inStock = 'true';

        const res = await api.get('/products', { params });
        if (res.data?.success) {
          setProducts(res.data.products);
          setTotal(res.data.total);
          setTotalPages(res.data.pages);
        }
      } catch (err) {
        console.error('Failed to fetch products', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory, selectedSize, maxPrice, selectedColor, inStockOnly, sortBy, page, searchQuery]);

  const updateFilters = (newParams) => {
    const current = Object.fromEntries(searchParams.entries());
    const merged = { ...current, ...newParams, page: 1 };
    // Remove default or empty keys
    Object.keys(merged).forEach((key) => {
      if (merged[key] === 'all' || merged[key] === '' || merged[key] === false) {
        delete merged[key];
      }
    });
    setSearchParams(merged);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedSize('all');
    setSelectedColor('all');
    setMaxPrice(5000);
    setInStockOnly(false);
    setSearchQuery('');
    setSortBy('popular');
    setSearchParams({});
    setPage(1);
  };

  const colors = [
    { name: 'all', label: 'All Colors', hex: 'transparent' },
    { name: 'Ivory', label: 'Ivory / White', hex: '#FDFBF7' },
    { name: 'Beige', label: 'Warm Beige', hex: '#D8C3A5' },
    { name: 'Blue', label: 'Blue / Navy', hex: '#23395B' },
    { name: 'Charcoal', label: 'Charcoal / Slate', hex: '#3D3D3D' },
    { name: 'Green', label: 'Sage Green', hex: '#7D8C75' },
    { name: 'Pink', label: 'Blush Pink', hex: '#E2B1B1' },
  ];

  return (
    <div style={{ padding: 'clamp(20px, 3.5vw, 32px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container">
        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          <Link to="/" style={{ color: 'var(--text-muted)' }}>
            Home
          </Link>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Shop</span>
          {selectedCategory !== 'all' && (
            <>
              <ChevronRight size={14} />
              <span style={{ color: 'var(--accent-color)', fontWeight: 500 }}>
                {categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}
              </span>
            </>
          )}
        </div>

        {/* Page Title & Mobile Filter Trigger */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'clamp(20px, 3.5vw, 32px)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              All Mattress Protectors
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
              Showing {products.length} of {total} luxury designs
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="btn btn-secondary btn-sm mobile-filter-btn"
              style={{ display: 'none' }}
            >
              <SlidersHorizontal size={16} /> Filters
            </button>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                Sort by:
              </span>
              <select
                value={sortBy}
                onChange={(e) => updateFilters({ sort: e.target.value })}
                style={{
                  width: 'auto',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.88rem',
                }}
              >
                <option value="popular">Popular (Rating &amp; Reviews)</option>
                <option value="newest">Newest Arrivals</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Shop Content: Sidebar + Products Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '270px 1fr',
            gap: '36px',
            alignItems: 'start',
          }}
          className="shop-layout"
        >
          {/* Desktop Left Sidebar Filters */}
          <aside
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              position: 'sticky',
              top: '90px',
            }}
            className="desktop-filter-sidebar"
          >
            {/* Search Input */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '8px',
                  color: 'var(--text-primary)',
                }}
              >
                Search
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') updateFilters({ search: searchQuery });
                  }}
                  style={{
                    paddingLeft: '34px',
                    fontSize: '0.88rem',
                  }}
                />
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
              </div>
            </div>

            {/* Categories */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '12px',
                  color: 'var(--text-primary)',
                }}
              >
                Categories
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.88rem',
                    color: selectedCategory === 'all' ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontWeight: selectedCategory === 'all' ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === 'all'}
                      onChange={() => updateFilters({ category: 'all' })}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    All Categories
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({total})</span>
                </label>

                {categories.map((cat) => (
                  <label
                    key={cat._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.88rem',
                      color: selectedCategory === cat.slug ? 'var(--accent-color)' : 'var(--text-secondary)',
                      fontWeight: selectedCategory === cat.slug ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        name="category"
                        checked={selectedCategory === cat.slug}
                        onChange={() => updateFilters({ category: cat.slug })}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      {cat.name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      ({cat.productCount || 0})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range Slider */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <label
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-primary)',
                  }}
                >
                  Price Range
                </label>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                  Up to ₹{maxPrice.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min="800"
                max="5000"
                step="100"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                onMouseUp={() => updateFilters({ maxPrice })}
                onTouchEnd={() => updateFilters({ maxPrice })}
                style={{ width: '100%', accentColor: 'var(--accent-color)' }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                }}
              >
                <span>₹800</span>
                <span>₹5,000</span>
              </div>
            </div>

            {/* Size Filter */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '10px',
                  color: 'var(--text-primary)',
                }}
              >
                Size
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['all', 'King', 'Queen', 'Double', 'Single', 'Free Size'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateFilters({ size: s })}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem',
                      fontWeight: selectedSize.toLowerCase() === s.toLowerCase() ? 600 : 400,
                      backgroundColor:
                        selectedSize.toLowerCase() === s.toLowerCase()
                          ? 'var(--accent-color)'
                          : 'var(--bg-secondary)',
                      color:
                        selectedSize.toLowerCase() === s.toLowerCase()
                          ? 'var(--text-light)'
                          : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '10px',
                  color: 'var(--text-primary)',
                }}
              >
                Color
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => updateFilters({ color: c.name })}
                    title={c.label}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: c.name === 'all' ? 'transparent' : c.hex,
                      border:
                        selectedColor.toLowerCase() === c.name.toLowerCase()
                          ? '2px solid var(--accent-color)'
                          : '1px solid var(--border-color)',
                      boxShadow:
                        selectedColor.toLowerCase() === c.name.toLowerCase()
                          ? '0 0 0 2px var(--accent-light)'
                          : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {c.name === 'all' && 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* In Stock Toggle */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.88rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    setInStockOnly(e.target.checked);
                    updateFilters({ inStock: e.target.checked });
                  }}
                  style={{ width: 'auto', margin: 0 }}
                />
                In Stock Only
              </label>
            </div>

            {/* Reset Button */}
            <button
              onClick={handleResetFilters}
              className="btn btn-secondary btn-sm btn-full"
              style={{ fontSize: '0.85rem' }}
            >
              Reset Filters
            </button>
          </aside>

          {/* Product Grid Area */}
          <main>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <p style={{ color: 'var(--text-muted)' }}>Loading Mattress Protectors...</p>
              </div>
            ) : products.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '60px 24px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                }}
              >
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Mattress Protectors found</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Try relaxing your search keywords or adjusting your filters.
                </p>
                <button onClick={handleResetFilters} className="btn btn-primary btn-sm">
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="responsive-product-grid">
                  {products.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginTop: 'clamp(28px, 4vw, 48px)',
                    }}
                  >
                    <button
                      disabled={page <= 1}
                      onClick={() => {
                        const newPage = page - 1;
                        setPage(newPage);
                        setSearchParams({ ...Object.fromEntries(searchParams.entries()), page: newPage });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '8px 12px' }}
                      aria-label="Previous Page"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setPage(p);
                          setSearchParams({ ...Object.fromEntries(searchParams.entries()), page: p });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.9rem',
                          fontWeight: page === p ? 700 : 500,
                          backgroundColor:
                            page === p ? 'var(--accent-color)' : 'var(--bg-card)',
                          color: page === p ? 'var(--text-light)' : 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      disabled={page >= totalPages}
                      onClick={() => {
                        const newPage = page + 1;
                        setPage(newPage);
                        setSearchParams({ ...Object.fromEntries(searchParams.entries()), page: newPage });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '8px 12px' }}
                      aria-label="Next Page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filters Slide-in Modal */}
      {mobileFilterOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            display: 'flex',
          }}
        >
          <div
            onClick={() => setMobileFilterOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(3px)',
            }}
          />
          <div
            style={{
              position: 'relative',
              width: '300px',
              maxWidth: '85%',
              backgroundColor: 'var(--bg-card)',
              height: '100%',
              padding: '24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 3001,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Filters</h3>
              <button onClick={() => setMobileFilterOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Repeat Category Options */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Categories
              </label>
              {categories.map((cat) => (
                <div key={cat._id} style={{ marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="m-cat"
                      checked={selectedCategory === cat.slug}
                      onChange={() => {
                        updateFilters({ category: cat.slug });
                        setMobileFilterOpen(false);
                      }}
                      style={{ width: 'auto' }}
                    />
                    {cat.name}
                  </label>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                handleResetFilters();
                setMobileFilterOpen(false);
              }}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 'auto' }}
            >
              Reset All
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .shop-layout {
            grid-template-columns: 1fr !important;
          }
          .desktop-filter-sidebar {
            display: none !important;
          }
          .mobile-filter-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ShopPage;
