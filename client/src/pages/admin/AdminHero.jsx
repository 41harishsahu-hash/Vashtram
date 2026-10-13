import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../../context/useCart';
import api from '../../services/api';
import {
  Sparkles,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Edit2,
  Image as ImageIcon,
  X,
  ExternalLink,
} from 'lucide-react';

const AdminHero = () => {
  const { showToast } = useCart();

  // Active Tab: 'text' or 'images'
  const [activeTab, setActiveTab] = useState('text');

  // Loading & Saving states
  const [fetching, setFetching] = useState(true);
  const [savingText, setSavingText] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Original and Working Text Form State
  const [textForm, setTextForm] = useState({
    smallLabel: '',
    heading: '',
    description: '',
    button1Text: '',
    button1Link: '',
    button2Text: '',
    button2Link: '',
    floatingCardTitle: '',
    floatingCardSubtitle: '',
    floatingCardBadge: '',
    floatingCardShow: true,
  });

  const [initialTextForm, setInitialTextForm] = useState(null);

  // Hero Images State
  const [images, setImages] = useState([]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // New Image Form
  const [newImageForm, setNewImageForm] = useState({
    url: '',
    altText: '',
    isActive: true,
    order: 1,
  });

  // Edit / Replace Image Form
  const [editImageForm, setEditImageForm] = useState({
    _id: '',
    url: '',
    altText: '',
    isActive: true,
    order: 1,
  });

  const addFileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);


  useEffect(() => {
    let isMounted = true;
    const initHeroData = async () => {
      try {
        const res = await api.get('/hero');
        if (isMounted && res.data?.success && res.data?.hero) {
          const hero = res.data.hero;

          const populatedForm = {
            smallLabel: hero.smallLabel || '',
            heading: hero.heading || '',
            description: hero.description || '',
            button1Text: hero.button1?.text || '',
            button1Link: hero.button1?.link || '',
            button2Text: hero.button2?.text || '',
            button2Link: hero.button2?.link || '',
            floatingCardTitle: hero.floatingCard?.title || '',
            floatingCardSubtitle: hero.floatingCard?.subtitle || '',
            floatingCardBadge: hero.floatingCard?.badge || '',
            floatingCardShow: hero.floatingCard?.show !== false,
          };

          setTextForm(populatedForm);
          setInitialTextForm(populatedForm);

          const sortedImages = (hero.images || []).sort(
            (a, b) => (a.order || 0) - (b.order || 0)
          );
          setImages(sortedImages);
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to load Hero data', 'error');
        }
      } finally {
        if (isMounted) {
          setFetching(false);
        }
      }
    };

    initHeroData();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  // ==========================================
  // HERO TEXT HANDLERS
  // ==========================================

  const handleSaveText = async (e) => {
    e.preventDefault();
    setSavingText(true);

    try {
      const payload = {
        smallLabel: textForm.smallLabel,
        heading: textForm.heading,
        description: textForm.description,
        button1: {
          text: textForm.button1Text,
          link: textForm.button1Link,
        },
        button2: {
          text: textForm.button2Text,
          link: textForm.button2Link,
        },
        floatingCard: {
          title: textForm.floatingCardTitle,
          subtitle: textForm.floatingCardSubtitle,
          badge: textForm.floatingCardBadge,
          show: textForm.floatingCardShow,
        },
      };

      const res = await api.put('/hero/text', payload);
      if (res.data?.success) {
        showToast('Hero text content updated successfully!');
        setInitialTextForm({ ...textForm });
      }
    } catch (err) {
      showToast(err.message || 'Failed to update Hero text', 'error');
    } finally {
      setSavingText(false);
    }
  };

  const handleResetText = () => {
    if (initialTextForm) {
      setTextForm({ ...initialTextForm });
      showToast('Text form reset to last saved state', 'info');
    }
  };

  // ==========================================
  // IMAGE UPLOAD RE-USE
  // ==========================================

  const handleFileUpload = async (file, target) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPEG, PNG, WebP)', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must be less than 5MB', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    setUploadingImage(true);
    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data?.url) {
        showToast('Image uploaded successfully!');
        if (target === 'add') {
          setNewImageForm((prev) => ({ ...prev, url: res.data.url }));
        } else if (target === 'replace') {
          setEditImageForm((prev) => ({ ...prev, url: res.data.url }));
        }
      }
    } catch (err) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  // ==========================================
  // HERO IMAGE HANDLERS
  // ==========================================

  const openAddModal = () => {
    const nextOrder = images.length > 0 ? Math.max(...images.map((i) => i.order || 0)) + 1 : 1;
    setNewImageForm({
      url: '',
      altText: 'VASHTRAM Luxury Mattress Protector',
      isActive: true,
      order: nextOrder,
    });
    setIsAddModalOpen(true);
  };

  const handleAddImageSubmit = async (e) => {
    e.preventDefault();
    if (!newImageForm.url.trim()) {
      showToast('Please upload or provide an image URL', 'warning');
      return;
    }

    try {
      const res = await api.post('/hero/images', newImageForm);
      if (res.data?.success && res.data?.hero) {
        showToast('New hero slide added successfully!');
        setImages(res.data.hero.images || []);
        setIsAddModalOpen(false);
      }
    } catch (err) {
      showToast(err.message || 'Failed to add hero image', 'error');
    }
  };

  const openEditModal = (img) => {
    setSelectedImage(img);
    setEditImageForm({
      _id: img._id,
      url: img.url,
      altText: img.altText || '',
      isActive: img.isActive !== false,
      order: img.order || 1,
    });
    setIsEditModalOpen(true);
  };

  const handleEditImageSubmit = async (e) => {
    e.preventDefault();
    if (!editImageForm.url.trim()) {
      showToast('Image URL cannot be empty', 'warning');
      return;
    }

    try {
      const res = await api.put(`/hero/images/${editImageForm._id}`, editImageForm);
      if (res.data?.success && res.data?.hero) {
        showToast('Hero image updated successfully!');
        setImages(res.data.hero.images || []);
        setIsEditModalOpen(false);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update hero image', 'error');
    }
  };

  const handleToggleActive = async (img) => {
    try {
      const updatedStatus = !img.isActive;
      const res = await api.put(`/hero/images/${img._id}`, {
        isActive: updatedStatus,
      });
      if (res.data?.success && res.data?.hero) {
        showToast(
          `Image ${updatedStatus ? 'enabled for' : 'hidden from'} storefront carousel`
        );
        setImages(res.data.hero.images || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  const handleDeleteImage = async (imgId) => {
    if (!window.confirm('Are you sure you want to delete this hero carousel image?')) {
      return;
    }

    try {
      const res = await api.delete(`/hero/images/${imgId}`);
      if (res.data?.success && res.data?.hero) {
        showToast('Image removed from hero carousel');
        setImages(res.data.hero.images || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete hero image', 'error');
    }
  };

  const handleMoveOrder = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    // Swap positions
    const newImages = [...images];
    const temp = newImages[index];
    newImages[index] = newImages[targetIndex];
    newImages[targetIndex] = temp;

    // Assign sequential orders
    const updatedOrders = newImages.map((img, idx) => ({
      id: img._id,
      order: idx + 1,
    }));

    try {
      const res = await api.put('/hero/images/reorder', {
        imageOrders: updatedOrders,
      });
      if (res.data?.success && res.data?.hero) {
        setImages(res.data.hero.images || []);
        showToast('Image order updated');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update image order', 'error');
    }
  };

  if (fetching) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-color)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Loading Hero Section settings...
        </p>
      </div>
    );
  }

  const activeImagesCount = images.filter((img) => img.isActive !== false).length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.9rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Hero Section Management
            </h1>
            <span
              style={{
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent-color)',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Live Storefront
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Fully customize the homepage hero banner headlines, action buttons, floating badge, and horizontal image slider.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              fontSize: '0.88rem',
              fontWeight: activeTab === 'text' ? 600 : 500,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: activeTab === 'text' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'text' ? 'var(--accent-color)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'text' ? 'var(--shadow-sm)' : 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Sparkles size={16} /> Hero Text &amp; Buttons
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('images')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              fontSize: '0.88rem',
              fontWeight: activeTab === 'images' ? 600 : 500,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: activeTab === 'images' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'images' ? 'var(--accent-color)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'images' ? 'var(--shadow-sm)' : 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <ImageIcon size={16} /> Hero Image Carousel ({images.length})
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB A: HERO TEXT MANAGEMENT                              */}
      {/* ======================================================== */}
      {activeTab === 'text' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '28px' }} className="hero-text-grid">
          {/* Left: Text Form */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '28px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <form onSubmit={handleSaveText} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Small Label / Badge
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={textForm.smallLabel}
                    onChange={(e) => setTextForm({ ...textForm, smallLabel: e.target.value })}
                    placeholder="e.g. Handcrafted Luxury Living"
                    style={{ paddingLeft: '36px' }}
                  />
                  <Sparkles
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--accent-color)',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Appears at the top with sparkling badge styling
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Main Heading
                </label>
                <input
                  type="text"
                  required
                  value={textForm.heading}
                  onChange={(e) => setTextForm({ ...textForm, heading: e.target.value })}
                  placeholder="e.g. Bring Comfort & Elegance Home"
                  style={{ fontSize: '1.05rem', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Sub Heading / Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={textForm.description}
                  onChange={(e) => setTextForm({ ...textForm, description: e.target.value })}
                  placeholder="Describe your mattress protector collection..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Action Buttons Configuration */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Call to Action Buttons
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                      Primary Button Text
                    </label>
                    <input
                      type="text"
                      value={textForm.button1Text}
                      onChange={(e) => setTextForm({ ...textForm, button1Text: e.target.value })}
                      placeholder="e.g. Shop Now"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                      Primary Button URL
                    </label>
                    <input
                      type="text"
                      value={textForm.button1Link}
                      onChange={(e) => setTextForm({ ...textForm, button1Link: e.target.value })}
                      placeholder="e.g. /shop"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                      Secondary Button Text
                    </label>
                    <input
                      type="text"
                      value={textForm.button2Text}
                      onChange={(e) => setTextForm({ ...textForm, button2Text: e.target.value })}
                      placeholder="e.g. Explore Cotton"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                      Secondary Button URL
                    </label>
                    <input
                      type="text"
                      value={textForm.button2Link}
                      onChange={(e) => setTextForm({ ...textForm, button2Link: e.target.value })}
                      placeholder="e.g. /shop?category=cotton"
                    />
                  </div>
                </div>
              </div>

              {/* Floating Trust Card Configuration */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Floating Trust Card
                  </h3>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={textForm.floatingCardShow}
                      onChange={(e) => setTextForm({ ...textForm, floatingCardShow: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    Display on Hero
                  </label>
                </div>

                {textForm.floatingCardShow && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                          Card Title
                        </label>
                        <input
                          type="text"
                          value={textForm.floatingCardTitle}
                          onChange={(e) => setTextForm({ ...textForm, floatingCardTitle: e.target.value })}
                          placeholder="e.g. Signature Heritage Weave"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                          Badge Text
                        </label>
                        <input
                          type="text"
                          value={textForm.floatingCardBadge}
                          onChange={(e) => setTextForm({ ...textForm, floatingCardBadge: e.target.value })}
                          placeholder="e.g. In Stock"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                        Card Subtitle / Specs
                      </label>
                      <input
                        type="text"
                        value={textForm.floatingCardSubtitle}
                        onChange={(e) => setTextForm({ ...textForm, floatingCardSubtitle: e.target.value })}
                        placeholder="e.g. 100% Combed Cotton • 300+ Thread Count"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Form Buttons */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <button type="submit" disabled={savingText} className="btn btn-primary">
                  <Save size={16} /> {savingText ? 'Saving Updates...' : 'Save Text Changes'}
                </button>

                <button
                  type="button"
                  onClick={handleResetText}
                  className="btn btn-secondary"
                  title="Revert to last saved values"
                >
                  <RotateCcw size={16} /> Revert
                </button>
              </div>
            </form>
          </div>

          {/* Right: Real-time Live Storefront Preview */}
          <div>
            <div
              style={{
                position: 'sticky',
                top: '90px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-color)' }}>
                  Live Storefront Preview
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Updates as you type
                </span>
              </div>

              <div
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {textForm.smallLabel && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--accent-light)',
                      color: 'var(--accent-color)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginBottom: '14px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <Sparkles size={12} />
                    <span>{textForm.smallLabel}</span>
                  </div>
                )}

                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.6rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    lineHeight: 1.25,
                    marginBottom: '12px',
                  }}
                >
                  {textForm.heading || 'Headline Preview'}
                </h2>

                <p
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    marginBottom: '20px',
                  }}
                >
                  {textForm.description || 'Description preview will appear here.'}
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {textForm.button1Text && (
                    <span
                      className="btn btn-primary btn-sm"
                      style={{ pointerEvents: 'none' }}
                    >
                      {textForm.button1Text} →
                    </span>
                  )}
                  {textForm.button2Text && (
                    <span
                      className="btn btn-secondary btn-sm"
                      style={{ pointerEvents: 'none' }}
                    >
                      {textForm.button2Text}
                    </span>
                  )}
                </div>

                {textForm.floatingCardShow && (
                  <div
                    style={{
                      marginTop: '20px',
                      backgroundColor: 'var(--bg-card)',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8B6239', textTransform: 'uppercase' }}>
                        {textForm.floatingCardTitle || 'Card Title'}
                      </p>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {textForm.floatingCardSubtitle || 'Card Subtitle'}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#137333',
                        backgroundColor: '#E6F4EA',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      {textForm.floatingCardBadge || 'Badge'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB B: HERO IMAGE CAROUSEL MANAGEMENT                    */}
      {/* ======================================================== */}
      {activeTab === 'images' && (
        <div>
          {/* Action Bar */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              boxShadow: 'var(--shadow-sm)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Carousel Slides ({images.length})
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                <strong style={{ color: '#137333' }}>{activeImagesCount} Active</strong> in storefront horizontal slider • Reorder with up/down arrows
              </p>
            </div>

            <button type="button" onClick={openAddModal} className="btn btn-primary">
              <Plus size={16} /> Add New Slide
            </button>
          </div>

          {/* Images Grid / List */}
          {images.length === 0 ? (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-color)',
                padding: '48px 24px',
                textAlign: 'center',
              }}
            >
              <ImageIcon size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>No hero images found</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '6px 0 20px' }}>
                Add your first image to populate the horizontal slider.
              </p>
              <button type="button" onClick={openAddModal} className="btn btn-primary">
                <Plus size={16} /> Add First Slide
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {images.map((img, index) => {
                const isActive = img.isActive !== false;
                return (
                  <div
                    key={img._id || `img-${index}`}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all var(--transition-fast)',
                      opacity: isActive ? 1 : 0.65,
                    }}
                    className="hero-image-row"
                  >
                    {/* Reorder Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleMoveOrder(index, 'up')}
                        disabled={index === 0}
                        title="Move slide up"
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: index === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowUp size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveOrder(index, 'down')}
                        disabled={index === images.length - 1}
                        title="Move slide down"
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: index === images.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: index === images.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>

                    {/* Order Badge */}
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-light)',
                        color: 'var(--accent-color)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      #{index + 1}
                    </div>

                    {/* Thumbnail Image Preview */}
                    <div
                      style={{
                        width: '120px',
                        height: '75px',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        backgroundColor: 'var(--bg-secondary)',
                        flexShrink: 0,
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <img
                        src={img.url}
                        alt={img.altText || 'Hero thumbnail'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: isActive ? 'var(--badge-success-bg)' : 'var(--badge-warning-bg)',
                            color: isActive ? 'var(--badge-success-text)' : 'var(--badge-warning-text)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {isActive ? 'Active Slide' : 'Disabled'}
                        </span>

                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Order Index: {img.order || index + 1}
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          marginTop: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {img.altText || 'Untitled Slide'}
                      </p>

                      <a
                        href={img.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--accent-color)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '2px',
                          textDecoration: 'none',
                        }}
                      >
                        View Image Link <ExternalLink size={12} />
                      </a>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {/* Toggle Active Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(img)}
                        className="btn btn-secondary btn-sm"
                        title={isActive ? 'Click to disable' : 'Click to enable'}
                      >
                        {isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                        <span className="desktop-btn-label">{isActive ? 'Disable' : 'Enable'}</span>
                      </button>

                      {/* Edit / Replace Button */}
                      <button
                        type="button"
                        onClick={() => openEditModal(img)}
                        className="btn btn-secondary btn-sm"
                        title="Edit metadata or replace image file"
                      >
                        <Edit2 size={15} />
                        <span className="desktop-btn-label">Edit / Replace</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img._id)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#C5221F' }}
                        title="Delete image"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD NEW HERO IMAGE                              */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal, 50000)',
            padding: '20px',
          }}
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
              width: '540px',
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Add New Carousel Slide</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddImageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Upload or URL */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Upload Image File (Recommended)
                </label>
                <input
                  type="file"
                  ref={addFileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileUpload(e.target.files[0], 'add')}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => addFileInputRef.current?.click()}
                  className="btn btn-secondary btn-full"
                  style={{ borderStyle: 'dashed', padding: '14px' }}
                >
                  <Upload size={16} />
                  {uploadingImage ? 'Uploading Image to Server...' : 'Choose File from Device (Max 5MB)'}
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Or Direct Image URL
                </label>
                <input
                  type="text"
                  placeholder="/img/HeroCrousel1.jpeg or https://res.cloudinary.com/..."
                  value={newImageForm.url}
                  onChange={(e) => setNewImageForm({ ...newImageForm, url: e.target.value })}
                />
              </div>

              {/* Preview */}
              {newImageForm.url && (
                <div>
                  <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    Preview
                  </span>
                  <div
                    style={{
                      height: '180px',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <img
                      src={newImageForm.url}
                      alt="New preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = '/img/placeholder.svg';
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Alt Text / Slide Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. VASHTRAM Waterproof Mattress Protector - King"
                  value={newImageForm.altText}
                  onChange={(e) => setNewImageForm({ ...newImageForm, altText: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Slide Order #
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newImageForm.order}
                    onChange={(e) => setNewImageForm({ ...newImageForm, order: Number(e.target.value) })}
                  />
                </div>

                <div style={{ paddingTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={newImageForm.isActive}
                      onChange={(e) => setNewImageForm({ ...newImageForm, isActive: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    Active on Storefront
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={uploadingImage || !newImageForm.url} className="btn btn-primary">
                  Add Slide to Carousel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT / REPLACE HERO IMAGE                       */}
      {/* ======================================================== */}
      {isEditModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal, 50000)',
            padding: '20px',
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
              width: '540px',
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Edit / Replace Slide</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditImageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Replace image via file upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Replace with New File
                </label>
                <input
                  type="file"
                  ref={replaceFileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileUpload(e.target.files[0], 'replace')}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => replaceFileInputRef.current?.click()}
                  className="btn btn-secondary btn-full"
                  style={{ borderStyle: 'dashed', padding: '14px' }}
                >
                  <Upload size={16} />
                  {uploadingImage ? 'Uploading Replacement Image...' : 'Upload Replacement File'}
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Image URL
                </label>
                <input
                  type="text"
                  required
                  value={editImageForm.url}
                  onChange={(e) => setEditImageForm({ ...editImageForm, url: e.target.value })}
                />
              </div>

              {/* Preview */}
              {editImageForm.url && (
                <div>
                  <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    Current Slide Preview
                  </span>
                  <div
                    style={{
                      height: '180px',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <img
                      src={editImageForm.url}
                      alt="Edit preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = '/img/placeholder.svg';
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Alt Text / Slide Label
                </label>
                <input
                  type="text"
                  value={editImageForm.altText}
                  onChange={(e) => setEditImageForm({ ...editImageForm, altText: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Slide Order #
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editImageForm.order}
                    onChange={(e) => setEditImageForm({ ...editImageForm, order: Number(e.target.value) })}
                  />
                </div>

                <div style={{ paddingTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={editImageForm.isActive}
                      onChange={(e) => setEditImageForm({ ...editImageForm, isActive: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    Active on Storefront
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={uploadingImage || !editImageForm.url} className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .hero-text-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-image-row {
            flex-wrap: wrap;
          }
        }
        @media (max-width: 600px) {
          .desktop-btn-label {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminHero;
