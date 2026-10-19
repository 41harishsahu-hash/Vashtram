import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useCart } from '../../context/useCart';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { Plus, Search, Edit3, Trash2, X, Upload, ArrowLeft, ArrowRight, Star } from 'lucide-react';

const AdminProducts = () => {
  const { showToast } = useCart();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);

  // Lock body scroll when product edit modal is open
  useBodyScrollLock(modalOpen);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState(null);

  // Form State
  const initialFormState = {
    name: '',
    description: '',
    price: 2499,
    discountPrice: '',
    category: '',
    material: '100% Pure Combed Cotton',
    size: 'King',
    sizes: [
      { measurement: '48×75', name: 'Double', price: 344 },
      { measurement: '60×75', name: 'Queen', price: 481 },
      { measurement: '60×78', name: 'Queen', price: 471 },
      { measurement: '72×72', name: 'King', price: 501 },
      { measurement: '72×75', name: 'King', price: 501 },
      { measurement: '72×78', name: 'King', price: 449 },
      { measurement: '72×84', name: 'King', price: 549 },
      { measurement: '', name: 'Free Size', price: 525 },
    ],
    color: '',
    pattern: 'Floral',
    images: [
      '/img/product1.jpeg',
      '/img/product2.jpeg',
    ],
    stock: 15,
    sku: '',
    threadCount: 300,
    dimensions: '108 x 108 inches',
    pillowCovers: 'Pillow Covers Not Included.',
    careInstructions: 'Machine wash cold on gentle cycle. Line dry in shade.',
    isFeatured: false,
    isActive: true,
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchProductsAndCategories = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/products', { params: { limit: 50, includeInactive: 'true' } }),
        api.get('/categories?all=true'),
      ]);

      if (prodRes.data?.success) setProducts(prodRes.data.products);
      if (catRes.data?.success) setCategories(catRes.data.categories);
    } catch (err) {
      showToast(err.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let isMounted = true;
    const loadProductsAndCategories = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          api.get('/products', { params: { limit: 50, includeInactive: 'true' } }),
          api.get('/categories?all=true'),
        ]);

        if (isMounted) {
          if (prodRes.data?.success) setProducts(prodRes.data.products);
          if (catRes.data?.success) setCategories(catRes.data.categories);
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to load products', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProductsAndCategories();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      ...initialFormState,
      category: categories.length > 0 ? categories[0]._id : '',
      price: 2499,
      discountPrice: '',
      sizes: [
        { measurement: '48×75', name: 'Double', price: 344 },
        { measurement: '60×75', name: 'Queen', price: 481 },
        { measurement: '60×78', name: 'Queen', price: 471 },
        { measurement: '72×72', name: 'King', price: 501 },
        { measurement: '72×75', name: 'King', price: 501 },
        { measurement: '72×78', name: 'King', price: 449 },
        { measurement: '72×84', name: 'King', price: 549 },
        { measurement: '', name: 'Free Size', price: 525 },
      ],
      images: [
        '/img/product1.jpeg',
        '/img/product2.jpeg',
      ],
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    let parsedImages = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      parsedImages = [...product.images];
    } else if (typeof product.images === 'string' && product.images.trim()) {
      parsedImages = product.images.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (parsedImages.length === 0) {
      parsedImages = [
        '/img/product1.jpeg',
        '/img/product2.jpeg',
      ];
    } else if (parsedImages.length === 1) {
      parsedImages.push('/img/product2.jpeg');
    } else if (parsedImages.length > 4) {
      parsedImages = parsedImages.slice(0, 4);
    }

    let parsedSizes = [];
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      parsedSizes = product.sizes.map((s) => ({
        measurement: s.measurement || '',
        name: s.name || '',
        price: s.price !== undefined ? s.price : '',
      }));
    } else {
      parsedSizes = [
        {
          measurement: product.dimensions || '',
          name: product.size || 'King',
          price: product.price || '',
        },
      ];
    }

    // Sanitize discountPrice: only prefill if it is strictly lower than original price
    const validDiscountPrice =
      product.discountPrice && product.price && Number(product.discountPrice) < Number(product.price)
        ? product.discountPrice
        : '';

    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      discountPrice: validDiscountPrice,
      category: product.category?._id || product.category || '',
      material: product.material,
      size: product.size || (parsedSizes.length > 0 ? parsedSizes[0].name : 'King'),
      sizes: parsedSizes,
      color: product.color,
      pattern: product.pattern,
      images: parsedImages,
      stock: product.stock,
      sku: product.sku,
      threadCount: product.threadCount || 300,
      dimensions: product.dimensions || '108 x 108 inches',
      pillowCovers: product.pillowCovers || '',
      careInstructions: product.careInstructions || '',
      isFeatured: product.isFeatured || false,
      isActive: product.isActive !== undefined ? product.isActive : true,
    });
    setModalOpen(true);
  };

  const handleAddSizeOption = () => {
    setFormData((prev) => ({
      ...prev,
      sizes: [
        ...(prev.sizes || []),
        { measurement: '', name: 'King', price: '' },
      ],
    }));
  };

  const handleSizeOptionChange = (idx, field, value) => {
    setFormData((prev) => {
      const nextSizes = [...(prev.sizes || [])];
      nextSizes[idx] = { ...nextSizes[idx], [field]: value };
      return { ...prev, sizes: nextSizes };
    });
  };

  const handleRemoveSizeOption = (idx) => {
    if ((formData.sizes || []).length <= 1) {
      showToast('A product must have at least one size option', 'warning');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== idx),
    }));
  };

  const handleLoadPresetSizes = () => {
    setFormData((prev) => ({
      ...prev,
      sizes: [
        { measurement: '48×75', name: 'Double', price: 344 },
        { measurement: '60×75', name: 'Queen', price: 481 },
        { measurement: '60×78', name: 'Queen', price: 471 },
        { measurement: '72×72', name: 'King', price: 501 },
        { measurement: '72×75', name: 'King', price: 501 },
        { measurement: '72×78', name: 'King', price: 449 },
        { measurement: '72×84', name: 'King', price: 549 },
        { measurement: '', name: 'Free Size', price: 525 },
      ],
      price: prev.price || 344,
    }));
    showToast('Loaded standard mattress protector size options preset!');
  };

  const handleDeleteProduct = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"?`)) return;

    try {
      const res = await api.delete(`/products/${id}`);
      if (res.data?.success) {
        showToast(`Product "${name}" deleted successfully`);
        setProducts((prev) => prev.filter((p) => p._id !== id));
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete product', 'error');
    }
  };

  // Multiple Images Handlers (2 to 4 images support)
  const handleSlotUrlChange = (idx, newUrl) => {
    setFormData((prev) => {
      const nextImgs = [...(prev.images || [])];
      nextImgs[idx] = newUrl;
      return { ...prev, images: nextImgs };
    });
  };

  const handleSlotFileUpload = async (idx, file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please upload a valid image file (JPEG, PNG, or WebP).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must be less than 5MB.', 'error');
      return;
    }

    const uploadData = new FormData();
    uploadData.append('image', file);
    uploadData.append('folder', 'products');
    setUploadingSlot(idx);

    try {
      const res = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data?.url) {
        showToast(`Image ${idx + 1} uploaded successfully!`);
        setFormData((prev) => {
          const nextImgs = [...(prev.images || [])];
          nextImgs[idx] = res.data.url;
          return { ...prev, images: nextImgs };
        });
      }
    } catch (err) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleAddNewSlotWithFile = async (file) => {
    if (!file) return;
    if ((formData.images || []).length >= 4) {
      showToast('Maximum 4 images allowed per product.', 'error');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please upload a valid image file (JPEG, PNG, or WebP).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must be less than 5MB.', 'error');
      return;
    }

    const newIndex = (formData.images || []).length;
    const uploadData = new FormData();
    uploadData.append('image', file);
    uploadData.append('folder', 'products');
    setUploadingSlot(newIndex);

    try {
      const res = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data?.url) {
        showToast(`Image ${newIndex + 1} uploaded successfully!`);
        setFormData((prev) => ({
          ...prev,
          images: [...(prev.images || []), res.data.url],
        }));
      }
    } catch (err) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleAddNewEmptySlot = () => {
    if ((formData.images || []).length >= 4) {
      showToast('Maximum 4 images allowed per product.', 'error');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      images: [
        ...(prev.images || []),
        '/img/product3.jpeg',
      ],
    }));
    showToast('New image slot added. You can now edit its URL or upload a file.');
  };

  const handleRemoveSlot = (idx) => {
    if ((formData.images || []).length <= 2) {
      showToast('Minimum 2 images required. Every product must have at least 2 images.', 'error');
      return;
    }
    setFormData((prev) => {
      const nextImgs = (prev.images || []).filter((_, i) => i !== idx);
      return { ...prev, images: nextImgs };
    });
    showToast(`Image ${idx + 1} removed`);
  };

  const handleMoveSlot = (fromIdx, toIdx) => {
    setFormData((prev) => {
      const nextImgs = [...(prev.images || [])];
      if (toIdx < 0 || toIdx >= nextImgs.length) return prev;
      const [moved] = nextImgs.splice(fromIdx, 1);
      nextImgs.splice(toIdx, 0, moved);
      return { ...prev, images: nextImgs };
    });
  };

  const handleSetPrimary = (idx) => {
    if (idx === 0) return;
    handleMoveSlot(idx, 0);
    showToast(`Image ${idx + 1} moved to Primary position ⭐`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const cleanImages = (Array.isArray(formData.images) ? formData.images : [])
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter(Boolean);

      if (cleanImages.length < 2) {
        showToast('Please provide at least 2 product images (minimum 2, maximum 4)', 'error');
        setSubmitting(false);
        return;
      }

      if (cleanImages.length > 4) {
        showToast('Maximum 4 product images allowed', 'error');
        setSubmitting(false);
        return;
      }
      const validSizes = (formData.sizes || [])
        .map((s) => ({
          measurement: (s.measurement || '').toString().trim(),
          name: (s.name || '').toString().trim(),
          price: s.price !== '' && s.price !== null && s.price !== undefined ? Number(s.price) : NaN,
        }))
        .filter((s) => s.name && !isNaN(s.price) && s.price >= 0);

      if (validSizes.length === 0) {
        showToast('Please provide at least one valid size option with Size Name and Individual Price', 'error');
        setSubmitting(false);
        return;
      }

      const basePrice = formData.price ? Number(formData.price) : validSizes[0].price;

      // Price validation: discount price must be positive and strictly less than original price
      if (formData.discountPrice !== '' && formData.discountPrice !== null && formData.discountPrice !== undefined) {
        const numDiscount = Number(formData.discountPrice);
        if (isNaN(numDiscount) || numDiscount <= 0) {
          showToast('Discount price must be a valid positive number greater than 0', 'error');
          setSubmitting(false);
          return;
        }
        if (numDiscount >= basePrice) {
          showToast(`Discount price (₹${numDiscount.toLocaleString('en-IN')}) must be strictly less than original price (₹${basePrice.toLocaleString('en-IN')})`, 'error');
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        ...formData,
        price: basePrice,
        discountPrice: formData.discountPrice ? Number(formData.discountPrice) : null,
        stock: Number(formData.stock),
        threadCount: Number(formData.threadCount),
        images: cleanImages,
        sizes: validSizes,
        size: validSizes[0].name,
      };

      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct._id}`, payload);
        if (res.data?.success) {
          showToast(`Product "${payload.name}" updated successfully!`);
          fetchProductsAndCategories();
          setModalOpen(false);
        }
      } else {
        const res = await api.post('/products', payload);
        if (res.data?.success) {
          showToast(`New Product "${payload.name}" added successfully!`);
          fetchProductsAndCategories();
          setModalOpen(false);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to save product', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products by search and category
  const filteredProducts = products.filter((prod) => {
    const matchesSearch =
      !search ||
      prod.name.toLowerCase().includes(search.toLowerCase()) ||
      prod.sku?.toLowerCase().includes(search.toLowerCase()) ||
      prod.material?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' ||
      prod.category?._id === selectedCategory ||
      prod.category?.slug === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      {/* Title & Actions Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.9rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Product Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '3px' }}>
            Manage inventory, mattress protector catalog, sizes, and pricing
          </p>
        </div>

        <button onClick={handleOpenAddModal} className="btn btn-primary">
          <Plus size={18} /> Add New Product
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Search by title, SKU, or material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '0.88rem' }}
          />
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ width: 'auto', minWidth: '180px', fontSize: '0.88rem' }}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div
        className="table-responsive"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: '760px',
            borderCollapse: 'collapse',
            fontSize: '0.88rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Product</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>SKU</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Category</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Price</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Stock</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading products...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No matching products found.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr
                  key={p._id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ position: 'relative' }}>
                        <img
                          src={p.images && p.images.length > 0 ? p.images[0] : ''}
                          alt={p.name}
                          style={{ width: '46px', height: '46px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '-4px',
                            right: '-4px',
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            color: '#fff',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '1px 4px',
                            borderRadius: '3px',
                          }}
                          title={`${(p.images && p.images.length) || 1} images`}
                        >
                          {(p.images && p.images.length) || 1}🖼️
                        </span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {p.sizes && p.sizes.length > 0
                            ? `${p.sizes.length} Sizes (${p.sizes.map((s) => s.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')})`
                            : p.size} • {p.material}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{p.sku}</td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                    {p.category?.name || 'General'}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <div>
                      {p.sizes && p.sizes.length > 0 ? (
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            ₹{Math.min(...p.sizes.map((s) => Number(s.price))).toLocaleString('en-IN')}
                            {Math.min(...p.sizes.map((s) => Number(s.price))) !== Math.max(...p.sizes.map((s) => Number(s.price))) &&
                              ` - ₹${Math.max(...p.sizes.map((s) => Number(s.price))).toLocaleString('en-IN')}`}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--accent-color)',
                              display: 'block',
                              fontWeight: 600,
                            }}
                          >
                            {p.sizes.length} size options
                          </span>
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const hasDiscount = p.discountPrice && Number(p.discountPrice) > 0 && Number(p.discountPrice) < Number(p.price);
                            const effective = hasDiscount ? p.discountPrice : p.price;
                            return (
                              <>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                  ₹{effective.toLocaleString('en-IN')}
                                </span>
                                {hasDiscount && (
                                  <span
                                    style={{
                                      fontSize: '0.75rem',
                                      color: 'var(--text-muted)',
                                      textDecoration: 'line-through',
                                      display: 'block',
                                    }}
                                  >
                                    ₹{p.price.toLocaleString('en-IN')}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor:
                          p.stock <= 5 ? 'var(--badge-danger-bg)' : 'var(--badge-success-bg)',
                        color:
                          p.stock <= 5 ? 'var(--badge-danger-text)' : 'var(--badge-success-text)',
                      }}
                    >
                      {p.stock} units
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: p.isActive ? 'var(--badge-success-bg)' : 'var(--bg-secondary)',
                        color: p.isActive ? 'var(--badge-success-text)' : 'var(--text-muted)',
                      }}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEditModal(p)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 10px' }}
                        title="Edit product"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p._id, p.name)}
                        className="btn btn-sm"
                        style={{ padding: '6px 10px', color: '#C5221F', border: '1px solid var(--border-color)' }}
                        title="Delete product"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-modal, 50000)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={() => setModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(3px)',
            }}
          />

          <div
            style={{
              position: 'relative',
              width: '850px',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: '90vh',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 4001,
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                {editingProduct ? 'Edit Product Details' : 'Add New Product'}
              </h2>
              <button
                type="button"
                aria-label="Close product modal"
                onClick={() => setModalOpen(false)}
                style={{
                  minWidth: '40px',
                  minHeight: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body & Footer Form */}
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {/* Scrollable Form Content */}
              <div
                style={{
                  padding: '24px',
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Product Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. VASHTRAM Waterproof Mattress Protector King"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Detailed craftsmanship, fabric softness and styling description..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        Category *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        Original Price (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        placeholder="e.g. 2499"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        Discount Price (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="e.g. 1499 (optional)"
                        value={formData.discountPrice}
                        onChange={(e) => setFormData({ ...formData, discountPrice: e.target.value })}
                        style={
                          formData.discountPrice &&
                            formData.price &&
                            Number(formData.discountPrice) > Number(formData.price)
                            ? { borderColor: '#d93025' }
                            : {}
                        }
                      />
                      {formData.discountPrice &&
                        formData.price &&
                        Number(formData.discountPrice) > Number(formData.price) ? (
                        <span style={{ color: '#d93025', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                          Discount price cannot exceed the original price (₹{Number(formData.price).toLocaleString('en-IN')})
                        </span>
                      ) : (
                        formData.sizes && formData.sizes.length > 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>
                            Optional when size variants have individual prices (individual size prices take precedence on storefront)
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Dedicated Multiple Size Options Section */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            margin: 0,
                          }}
                        >
                          Multiple Size Options & Individual Prices *
                        </label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Every product supports multiple size options. Each option must have a Numerical Measurement, Size Name, and Individual Price.
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={handleLoadPresetSizes}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Load 8 common sizes: 48×75 Double, 60×75 Queen, 72×72 King, etc."
                        >
                          ⚡ Load Size Preset
                        </button>
                        <button
                          type="button"
                          onClick={handleAddSizeOption}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Plus size={14} /> Add Size Option
                        </button>
                      </div>
                    </div>

                    {/* Size Options Table */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        overflowX: 'auto',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 600, width: '32%' }}>1. Numerical Measurement</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, width: '32%' }}>2. Size Name</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, width: '24%' }}>3. Individual Price (₹) *</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center', width: '12%' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(formData.sizes || []).map((s, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < (formData.sizes || []).length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                              {/* 1. Numerical Measurement */}
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  type="text"
                                  placeholder="e.g. 48×75, 60×75, 72×72"
                                  value={s.measurement || ''}
                                  onChange={(e) => handleSizeOptionChange(idx, 'measurement', e.target.value)}
                                  style={{ fontSize: '0.82rem', padding: '6px 10px', width: '100%' }}
                                />
                              </td>

                              {/* 2. Size Name */}
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  type="text"
                                  placeholder="e.g. Double, Queen, King, Free Size"
                                  value={s.name || ''}
                                  required
                                  onChange={(e) => handleSizeOptionChange(idx, 'name', e.target.value)}
                                  style={{ fontSize: '0.82rem', padding: '6px 10px', width: '100%' }}
                                  list="size-presets"
                                />
                              </td>

                              {/* 3. Individual Price */}
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ position: 'relative' }}>
                                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>₹</span>
                                  <input
                                    type="number"
                                    placeholder="e.g. 344"
                                    min={0}
                                    required
                                    value={s.price}
                                    onChange={(e) => handleSizeOptionChange(idx, 'price', e.target.value)}
                                    style={{ fontSize: '0.82rem', padding: '6px 10px 6px 20px', width: '100%' }}
                                  />
                                </div>
                              </td>

                              {/* Action / Delete */}
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSizeOption(idx)}
                                  disabled={(formData.sizes || []).length <= 1}
                                  title={(formData.sizes || []).length <= 1 ? 'Product must have at least one size option' : 'Delete this size option'}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: (formData.sizes || []).length <= 1 ? 'var(--text-muted)' : '#C5221F',
                                    cursor: (formData.sizes || []).length <= 1 ? 'not-allowed' : 'pointer',
                                    opacity: (formData.sizes || []).length <= 1 ? 0.3 : 1,
                                    padding: '4px',
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <datalist id="size-presets">
                      <option value="King" />
                      <option value="Queen" />
                      <option value="Double" />
                      <option value="Single" />
                      <option value="Free Size" />
                    </datalist>

                    {/* Size Preview / Summary Pills */}
                    {(formData.sizes || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Size Summary ({(formData.sizes || []).length} Options):
                        </span>
                        {(formData.sizes || []).map((s, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              backgroundColor: 'var(--bg-card)',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {s.measurement ? `${s.measurement} (${s.name})` : (s.name || 'Size')} : <strong>₹{s.price || 0}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        Stock Quantity *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        SKU Code
                      </label>
                      <input
                        type="text"
                        placeholder="Auto or VST-XXX"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        Material
                      </label>
                      <input
                        type="text"
                        value={formData.material}
                        onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        Pattern
                      </label>
                      <input
                        type="text"
                        value={formData.pattern}
                        onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        Color
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Beige, Soft Blue"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                          Product Images *
                        </label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Minimum: 2 images | Maximum: 4 images. Image 1 is the <strong>Primary Image</strong> shown across catalog and cards.
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          backgroundColor: (formData.images || []).length >= 2 && (formData.images || []).length <= 4 ? '#E6F4EA' : '#FCE8E6',
                          color: (formData.images || []).length >= 2 && (formData.images || []).length <= 4 ? '#137333' : '#C5221F',
                        }}
                      >
                        {(formData.images || []).length} / 4 Images
                      </span>
                    </div>

                    {/* Horizontal Image Slots Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '12px',
                        marginBottom: '10px',
                      }}
                    >
                      {(formData.images || []).map((imgUrl, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: idx === 0 ? '2px solid var(--accent-color, #8B6239)' : '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px',
                            backgroundColor: idx === 0 ? 'rgba(139, 98, 57, 0.04)' : 'var(--bg-secondary)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            boxShadow: idx === 0 ? '0 2px 8px rgba(139, 98, 57, 0.12)' : 'none',
                          }}
                        >
                          {/* Header badge & delete */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: idx === 0 ? '#8B6239' : 'var(--text-muted)',
                                backgroundColor: idx === 0 ? '#F9F3EC' : 'var(--bg-card)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: idx === 0 ? '1px solid #D7C4B2' : '1px solid var(--border-color)',
                              }}
                            >
                              {idx === 0 ? '⭐ Primary' : `Image ${idx + 1}`}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(idx)}
                              disabled={(formData.images || []).length <= 2}
                              title={(formData.images || []).length <= 2 ? 'Minimum 2 images required' : 'Remove image'}
                              style={{
                                border: 'none',
                                background: 'none',
                                color: (formData.images || []).length <= 2 ? 'var(--text-muted)' : '#C5221F',
                                cursor: (formData.images || []).length <= 2 ? 'not-allowed' : 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                opacity: (formData.images || []).length <= 2 ? 0.35 : 1,
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* Image Preview Box */}
                          <div
                            style={{
                              width: '100%',
                              height: '110px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              backgroundColor: '#1a1a1a',
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {uploadingSlot === idx ? (
                              <div style={{ color: '#fff', fontSize: '0.75rem', textAlign: 'center', padding: '8px' }}>
                                Uploading...
                              </div>
                            ) : imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={`Product Image ${idx + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  e.target.style.opacity = 0.3;
                                }}
                              />
                            ) : (
                              <div style={{ color: '#aaa', fontSize: '0.75rem', textAlign: 'center' }}>
                                No Image
                              </div>
                            )}
                          </div>

                          {/* Reorder & Set Primary Toolbar */}
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveSlot(idx, idx - 1)}
                                title="Move Left (Reorder)"
                                style={{
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-card)',
                                  borderRadius: '4px',
                                  padding: '3px 6px',
                                  cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                  opacity: idx === 0 ? 0.3 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <ArrowLeft size={12} />
                              </button>

                              <button
                                type="button"
                                disabled={idx === (formData.images || []).length - 1}
                                onClick={() => handleMoveSlot(idx, idx + 1)}
                                title="Move Right (Reorder)"
                                style={{
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-card)',
                                  borderRadius: '4px',
                                  padding: '3px 6px',
                                  cursor: idx === (formData.images || []).length - 1 ? 'not-allowed' : 'pointer',
                                  opacity: idx === (formData.images || []).length - 1 ? 0.3 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <ArrowRight size={12} />
                              </button>
                            </div>

                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimary(idx)}
                                title="Set as Primary Image"
                                style={{
                                  fontSize: '0.72rem',
                                  border: '1px solid var(--accent-color, #8B6239)',
                                  background: 'none',
                                  color: 'var(--accent-color, #8B6239)',
                                  borderRadius: '4px',
                                  padding: '3px 6px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <Star size={11} /> Primary
                              </button>
                            )}
                          </div>

                          {/* Replace File Upload Button */}
                          <label
                            style={{
                              fontSize: '0.72rem',
                              textAlign: 'center',
                              padding: '4px 6px',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <Upload size={12} /> Replace Image
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleSlotFileUpload(idx, file);
                              }}
                              style={{ display: 'none' }}
                            />
                          </label>

                          {/* Direct URL Input */}
                          <input
                            type="text"
                            placeholder="Paste image URL..."
                            value={imgUrl}
                            onChange={(e) => handleSlotUrlChange(idx, e.target.value)}
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              width: '100%',
                            }}
                          />
                        </div>
                      ))}

                      {/* Add Image Slot Button Card (visible when < 4) */}
                      {(formData.images || []).length < 4 && (
                        <div
                          style={{
                            border: '2px dashed var(--border-color)',
                            borderRadius: '8px',
                            padding: '16px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            backgroundColor: 'var(--bg-secondary)',
                            minHeight: '220px',
                            textAlign: 'center',
                          }}
                        >
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--bg-card)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--accent-color, #8B6239)',
                            }}
                          >
                            <Plus size={18} />
                          </div>

                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Add Image ({(formData.images || []).length + 1} of 4)
                          </span>

                          <label
                            className="btn btn-secondary btn-sm"
                            style={{
                              cursor: 'pointer',
                              fontSize: '0.74rem',
                              padding: '5px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              marginTop: '2px',
                            }}
                          >
                            <Upload size={12} /> Upload File
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAddNewSlotWithFile(file);
                              }}
                              style={{ display: 'none' }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={handleAddNewEmptySlot}
                            className="btn btn-sm"
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 8px',
                              background: 'none',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            + Add URL Slot
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '24px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.isFeatured}
                        onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                        style={{ width: 'auto' }}
                      />
                      Featured on Homepage
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        style={{ width: 'auto' }}
                      />
                      Active (Visible in Store)
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Fixed / pinned at bottom) */}
              <div
                style={{
                  flexShrink: 0,
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
                  {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
