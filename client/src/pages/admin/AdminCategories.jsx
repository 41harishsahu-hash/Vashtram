import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { useCart } from '../../context/useCart';
import {
  Plus,
  Edit3,
  Trash2,
  X,
  UploadCloud,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Link2,
  Star,
} from 'lucide-react';
import { resolveImageUrl, PLACEHOLDER_IMAGE } from '../../utils/imageUrl';

const AdminCategories = () => {
  const { showToast } = useCart();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState(null); // index or 'new'

  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const fileInputRef = useRef(null);
  const replaceInputRefs = useRef({});

  const initialForm = {
    name: '',
    description: '',
    images: [],
    image: '',
    order: 0,
    isActive: true,
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories?all=true');
      if (res.data?.success) {
        setCategories(res.data.categories);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch categories', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        const res = await api.get('/categories?all=true');
        if (isMounted && res.data?.success) {
          setCategories(res.data.categories);
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to fetch categories', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCategories();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData(initialForm);
    setUrlInput('');
    setShowUrlInput(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    const catImages =
      Array.isArray(cat.images) && cat.images.length > 0
        ? [...cat.images]
        : cat.image
        ? [cat.image]
        : [];

    setFormData({
      name: cat.name,
      description: cat.description || '',
      images: catImages,
      image: catImages[0] || cat.image || '',
      order: cat.order || 0,
      isActive: cat.isActive !== undefined ? cat.isActive : true,
    });
    setUrlInput('');
    setShowUrlInput(false);
    setModalOpen(true);
  };

  // Upload a single file to replace a specific slot
  const handleReplaceSlot = async (idx, file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please upload a valid image (JPEG, PNG, or WebP).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must be less than 5MB.', 'error');
      return;
    }

    const uploadData = new FormData();
    uploadData.append('image', file);
    uploadData.append('folder', 'categories');
    setUploadingSlot(idx);

    try {
      const res = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data?.url) {
        showToast(`Image ${idx + 1} replaced successfully!`);
        setFormData((prev) => {
          const nextImgs = [...(prev.images || [])];
          nextImgs[idx] = res.data.url;
          return { ...prev, images: nextImgs, image: nextImgs[0] || '' };
        });
      }
    } catch (err) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setUploadingSlot(null);
    }
  };

  // Add one or multiple files from computer (up to max 4)
  const handleAddFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const currentImgs = formData.images || [];
    const availableSlots = 4 - currentImgs.length;

    if (availableSlots <= 0) {
      showToast('Maximum 4 images allowed per category.', 'error');
      return;
    }

    const filesToUpload = Array.from(fileList).slice(0, availableSlots);
    setUploadingSlot('new');

    try {
      const uploadedUrls = [];
      for (const file of filesToUpload) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          showToast(`Skipped ${file.name}: Only JPEG, PNG, and WebP are allowed.`, 'error');
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          showToast(`Skipped ${file.name}: File size exceeds 5MB.`, 'error');
          continue;
        }

        const uploadData = new FormData();
        uploadData.append('image', file);
        uploadData.append('folder', 'categories');

        const res = await api.post('/upload', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data?.success && res.data?.url) {
          uploadedUrls.push(res.data.url);
        }
      }

      if (uploadedUrls.length > 0) {
        showToast(`${uploadedUrls.length} image(s) uploaded successfully!`);
        setFormData((prev) => {
          const nextImgs = [...(prev.images || []), ...uploadedUrls].slice(0, 4);
          return { ...prev, images: nextImgs, image: nextImgs[0] || '' };
        });
      }
    } catch (err) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setUploadingSlot(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove an image from a specific slot
  const handleRemoveImage = (idx) => {
    setFormData((prev) => {
      const nextImgs = (prev.images || []).filter((_, i) => i !== idx);
      return { ...prev, images: nextImgs, image: nextImgs[0] || '' };
    });
  };

  // Move image left/right to reorder (changes which one is the cover)
  const handleMoveImage = (idx, direction) => {
    const targetIdx = idx + direction;
    const currentImgs = formData.images || [];
    if (targetIdx < 0 || targetIdx >= currentImgs.length) return;

    setFormData((prev) => {
      const nextImgs = [...(prev.images || [])];
      const temp = nextImgs[idx];
      nextImgs[idx] = nextImgs[targetIdx];
      nextImgs[targetIdx] = temp;
      return { ...prev, images: nextImgs, image: nextImgs[0] || '' };
    });
  };

  // Add an image directly by pasting an image URL
  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if ((formData.images || []).length >= 4) {
      showToast('Maximum 4 images allowed per category.', 'error');
      return;
    }
    setFormData((prev) => {
      const nextImgs = [...(prev.images || []), trimmed].slice(0, 4);
      return { ...prev, images: nextImgs, image: nextImgs[0] || '' };
    });
    setUrlInput('');
    showToast('Image URL added!');
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
      const res = await api.delete(`/categories/${id}`);
      if (res.data?.success) {
        showToast(`Category "${name}" deleted successfully`);
        fetchCategories();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete category', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Please provide a category name', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        images: formData.images || [],
        image: formData.images?.[0] || formData.image || '',
        order: Number(formData.order) || 0,
        isActive: formData.isActive,
      };

      if (editingCategory) {
        const res = await api.put(`/categories/${editingCategory._id}`, payload);
        if (res.data?.success) {
          showToast(`Category "${formData.name}" updated!`);
          fetchCategories();
          setModalOpen(false);
        }
      } else {
        const res = await api.post('/categories', payload);
        if (res.data?.success) {
          showToast(`Category "${formData.name}" created!`);
          fetchCategories();
          setModalOpen(false);
        }
      }
    } catch (err) {
      showToast(err.message || 'Error saving category', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
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
            Category Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '3px' }}>
            Organize mattress protector collections with 1–4 high-resolution images, carousels, and storefront order
          </p>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary">
          <Plus size={18} /> Add Category
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          overflowX: 'auto',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.88rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Category & Images</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Slug</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Description</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Products</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Order</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading categories...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No categories found.
                </td>
              </tr>
            ) : (
              categories.map((cat) => {
                const catImages =
                  Array.isArray(cat.images) && cat.images.length > 0
                    ? cat.images
                    : cat.image
                    ? [cat.image]
                    : [];
                const coverImage = resolveImageUrl(
                  catImages[0] || PLACEHOLDER_IMAGE
                );

                return (
                  <tr
                    key={cat._id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color var(--transition-fast)',
                    }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ position: 'relative', width: '52px', height: '52px', flexShrink: 0 }}>
                          <img
                            src={coverImage}
                            alt={cat.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '6px',
                              objectFit: 'cover',
                              border: '1px solid var(--border-color)',
                            }}
                          />
                          {catImages.length > 1 && (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: '-4px',
                                right: '-4px',
                                backgroundColor: 'var(--accent-color)',
                                color: '#fff',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                borderRadius: '999px',
                                padding: '1px 5px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                              }}
                              title={`${catImages.length} carousel slides`}
                            >
                              {catImages.length}
                            </span>
                          )}
                        </div>

                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                            {cat.name}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {catImages.length === 1
                              ? '1 image'
                              : catImages.length > 1
                              ? `${catImages.length} images (Carousel)`
                              : 'No image'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>/{cat.slug}</td>

                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', maxWidth: '240px' }}>
                      <span
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {cat.description || '—'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: 600 }}>{cat.productCount ?? 0}</span> designs
                    </td>

                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{cat.order ?? 0}</td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: cat.isActive ? 'var(--badge-success-bg)' : 'var(--bg-secondary)',
                          color: cat.isActive ? 'var(--badge-success-text)' : 'var(--text-muted)',
                        }}
                      >
                        {cat.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 10px' }}
                          title="Edit Category"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(cat._id, cat.name)}
                          className="btn btn-sm"
                          style={{ padding: '6px 10px', color: '#C5221F', border: '1px solid var(--border-color)' }}
                          title="Delete Category"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Category Add/Edit Modal */}
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
            onClick={() => !submitting && setModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
            }}
          />

          <div
            style={{
              position: 'relative',
              width: '680px',
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              padding: '28px',
              zIndex: 4001,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '2px' }}>
                  Manage collection details and 1–4 storefront carousel images
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                style={{ padding: '6px', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Category Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Category Name <span style={{ color: '#D93025' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pure Cotton"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of this mattress protector collection..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* 1–4 Category Images Section */}
              <div
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>
                      Category Images ({formData.images?.length || 0} / 4)
                    </label>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Upload 1 to 4 images. First image acts as the primary cover; multiple images form a responsive storefront carousel.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', gap: '4px' }}
                  >
                    <Link2 size={13} /> {showUrlInput ? 'Hide URL' : 'Add via URL'}
                  </button>
                </div>

                {/* Optional URL Adder Input */}
                {showUrlInput && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <input
                      type="url"
                      placeholder="Paste image URL (https://...)"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      style={{ fontSize: '0.84rem', padding: '8px 12px' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddUrl}
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0, padding: '0 14px' }}
                    >
                      Add
                    </button>
                  </div>
                )}

                {/* Hidden File Picker for adding new images */}
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleAddFiles(e.target.files)}
                />

                {/* Images Grid (1 to 4 items + upload tile) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {(formData.images || []).map((imgUrl, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: 'var(--radius-sm)',
                        border: idx === 0 ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* Image Thumbnail */}
                      <div style={{ position: 'relative', width: '100%', paddingTop: '80%', overflow: 'hidden' }}>
                        <img
                          src={imgUrl}
                          alt={`Category slide ${idx + 1}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />

                        {/* Slot Badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '6px',
                            left: '6px',
                            backgroundColor: idx === 0 ? 'var(--accent-color)' : 'rgba(0,0,0,0.65)',
                            color: '#fff',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          {idx === 0 ? (
                            <>
                              <Star size={10} fill="#fff" /> Cover
                            </>
                          ) : (
                            `#${idx + 1}`
                          )}
                        </div>

                        {/* Replace Loading Spinner */}
                        {uploadingSlot === idx && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                            }}
                          >
                            <Loader2 size={24} className="animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Hidden file input for Replace action */}
                      <input
                        type="file"
                        ref={(el) => (replaceInputRefs.current[idx] = el)}
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={(e) => handleReplaceSlot(idx, e.target.files?.[0])}
                      />

                      {/* Card Action Buttons Toolbar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderTop: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, -1)}
                              title="Move left (make earlier)"
                              style={{ padding: '2px 4px', color: 'var(--text-secondary)' }}
                            >
                              <ArrowLeft size={13} />
                            </button>
                          )}
                          {idx < (formData.images || []).length - 1 && (
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, 1)}
                              title="Move right"
                              style={{ padding: '2px 4px', color: 'var(--text-secondary)' }}
                            >
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => replaceInputRefs.current[idx]?.click()}
                            title="Replace this image from computer"
                            style={{ padding: '2px 4px', color: 'var(--accent-color)' }}
                          >
                            <RefreshCw size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            title="Remove image"
                            style={{ padding: '2px 4px', color: '#D93025' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Image Button / Dropzone (Up to 4 images) */}
                  {(formData.images || []).length < 4 && (
                    <div
                      onClick={() => !uploadingSlot && fileInputRef.current?.click()}
                      style={{
                        minHeight: '140px',
                        border: '2px dashed var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-card)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: uploadingSlot ? 'not-allowed' : 'pointer',
                        padding: '12px',
                        textAlign: 'center',
                        transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
                      }}
                      className="category-dropzone"
                    >
                      {uploadingSlot === 'new' ? (
                        <>
                          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={24} style={{ color: 'var(--accent-color)' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            + Upload Image
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Select from computer
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Order & Active Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Lower numbers display first on the storefront
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    Active in Storefront
                  </label>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '10px',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting || Boolean(uploadingSlot)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || Boolean(uploadingSlot)}
                  className="btn btn-primary btn-sm"
                  style={{ minWidth: '130px', justifyContent: 'center' }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Saving...
                    </>
                  ) : editingCategory ? (
                    'Save Changes'
                  ) : (
                    'Create Category'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .category-dropzone:hover {
          border-color: var(--accent-color) !important;
          background-color: var(--bg-hover) !important;
        }
      `}</style>
    </div>
  );
};

export default AdminCategories;
