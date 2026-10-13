import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useCart } from '../../context/useCart';
import {
  AVAILABLE_FEATURE_ICONS,
  renderFeatureIcon,
} from '../../utils/featureIcons';
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  AlertCircle,
  Eye,
} from 'lucide-react';

const AdminFeatures = () => {
  const { showToast } = useCart();
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'inactive'

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [featureToDelete, setFeatureToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Icon Selector Filter
  const [iconSearch, setIconSearch] = useState('');

  // Form State
  const initialForm = {
    title: '',
    description: '',
    icon: 'Feather',
    displayOrder: 1,
    isActive: true,
  };
  const [formData, setFormData] = useState(initialForm);

  // Fetch all features for Admin
  const fetchFeatures = useCallback(async () => {
    try {
      const res = await api.get('/features/admin');
      if (res.data?.success) {
        setFeatures(res.data.features || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch features', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let isMounted = true;
    const loadFeatures = async () => {
      try {
        const res = await api.get('/features/admin');
        if (isMounted && res.data?.success) {
          setFeatures(res.data.features || []);
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to fetch features', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadFeatures();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingFeature(null);
    const maxOrder = features.reduce((max, f) => Math.max(max, f.displayOrder || 0), 0);
    setFormData({
      ...initialForm,
      displayOrder: maxOrder + 1,
    });
    setIconSearch('');
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (feat) => {
    setEditingFeature(feat);
    setFormData({
      title: feat.title || '',
      description: feat.description || '',
      icon: feat.icon || 'Feather',
      displayOrder: feat.displayOrder ?? 1,
      isActive: feat.isActive !== false,
    });
    setIconSearch('');
    setModalOpen(true);
  };

  // Submit Add or Edit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showToast('Please provide a feature title', 'error');
      return;
    }
    if (!formData.description.trim()) {
      showToast('Please provide a feature description', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        icon: formData.icon.trim() || 'Feather',
        displayOrder: Number(formData.displayOrder) || 1,
        isActive: formData.isActive,
      };

      if (editingFeature) {
        const res = await api.put(`/features/${editingFeature._id}`, payload);
        if (res.data?.success) {
          showToast(`Feature "${formData.title}" updated successfully!`);
          await fetchFeatures();
          setModalOpen(false);
        }
      } else {
        const res = await api.post('/features', payload);
        if (res.data?.success) {
          showToast(`Feature "${formData.title}" added successfully!`);
          await fetchFeatures();
          setModalOpen(false);
        }
      }
    } catch (err) {
      showToast(err.message || 'Error saving feature', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Toggle Active/Inactive
  const handleToggleStatus = async (id, currentStatus, title) => {
    try {
      const res = await api.put(`/features/${id}/toggle`);
      if (res.data?.success) {
        showToast(`"${title}" is now ${!currentStatus ? 'Active' : 'Inactive'}`);
        setFeatures((prev) =>
          prev.map((f) => (f._id === id ? { ...f, isActive: !currentStatus } : f))
        );
      }
    } catch (err) {
      showToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  // Reorder: Shift position up or down
  const handleMoveOrder = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= features.length) return;

    const newFeatures = [...features];
    const currentItem = newFeatures[index];
    const swapItem = newFeatures[targetIndex];

    // Swap their displayOrder values
    const tempOrder = currentItem.displayOrder;
    currentItem.displayOrder = swapItem.displayOrder;
    swapItem.displayOrder = tempOrder;

    // If both orders happen to be equal, adjust explicitly
    if (currentItem.displayOrder === swapItem.displayOrder) {
      currentItem.displayOrder = direction === 'up' ? targetIndex + 1 : targetIndex + 2;
      swapItem.displayOrder = direction === 'up' ? targetIndex + 2 : targetIndex + 1;
    }

    newFeatures[index] = swapItem;
    newFeatures[targetIndex] = currentItem;

    setFeatures(newFeatures);

    try {
      const orders = newFeatures.map((f, idx) => ({
        id: f._id,
        displayOrder: idx + 1,
      }));
      await api.put('/features/reorder', { orders });
      showToast('Display order updated!');
      fetchFeatures();
    } catch (err) {
      showToast(err.message || 'Failed to update order', 'error');
      fetchFeatures();
    }
  };

  // Delete Prompt
  const handlePromptDelete = (feature) => {
    setFeatureToDelete(feature);
    setDeleteConfirmOpen(true);
  };

  // Execute Delete
  const handleConfirmDelete = async () => {
    if (!featureToDelete) return;

    setDeleting(true);
    try {
      const res = await api.delete(`/features/${featureToDelete._id}`);
      if (res.data?.success) {
        showToast(`Feature "${featureToDelete.title}" deleted successfully`);
        setDeleteConfirmOpen(false);
        setFeatureToDelete(null);
        fetchFeatures();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete feature', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reset to the original 4 default features? Any custom additions or edits will be replaced.'
      )
    ) {
      return;
    }

    try {
      const res = await api.post('/features/reset');
      if (res.data?.success) {
        showToast('Reset features to original 4 defaults successfully!');
        fetchFeatures();
      }
    } catch (err) {
      showToast(err.message || 'Failed to reset features', 'error');
    }
  };

  // Filtered list
  const filteredFeatures = features.filter((item) => {
    const matchesSearch =
      !search ||
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? item.isActive !== false
        : item.isActive === false;

    return matchesSearch && matchesStatus;
  });

  // Filtered icons for selector
  const filteredIcons = AVAILABLE_FEATURE_ICONS.filter(
    (ico) =>
      !iconSearch ||
      ico.name.toLowerCase().includes(iconSearch.toLowerCase()) ||
      ico.label.toLowerCase().includes(iconSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
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
            Why Choose Us (Features)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '3px' }}>
            Manage the dynamic value highlights, trust badges, and feature cards displayed on the storefront
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleResetDefaults}
            className="btn btn-secondary"
            style={{ fontSize: '0.84rem' }}
            title="Restore original 4 default feature cards"
          >
            <RotateCcw size={15} /> Reset Defaults
          </button>
          <button onClick={handleOpenAdd} className="btn btn-primary">
            <Plus size={18} /> Add Feature
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '14px 20px',
          marginBottom: '24px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '420px' }}>
          <input
            type="text"
            placeholder="Search features by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '34px',
              fontSize: '0.88rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              height: '38px',
            }}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              fontSize: '0.85rem',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              height: '38px',
            }}
          >
            <option value="all">All Features ({features.length})</option>
            <option value="active">Active Only ({features.filter((f) => f.isActive !== false).length})</option>
            <option value="inactive">Inactive Only ({features.filter((f) => f.isActive === false).length})</option>
          </select>
        </div>
      </div>

      {/* Features Table */}
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
              <th style={{ padding: '12px 16px', fontWeight: 600, width: '70px', textAlign: 'center' }}>
                Order
              </th>
              <th style={{ padding: '12px 16px', fontWeight: 600, width: '80px', textAlign: 'center' }}>
                Icon
              </th>
              <th style={{ padding: '12px 16px', fontWeight: 600, minWidth: '160px' }}>
                Title
              </th>
              <th style={{ padding: '12px 16px', fontWeight: 600, minWidth: '280px' }}>
                Description
              </th>
              <th style={{ padding: '12px 16px', fontWeight: 600, width: '120px', textAlign: 'center' }}>
                Status
              </th>
              <th style={{ padding: '12px 16px', fontWeight: 600, width: '150px', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading feature boxes...
                </td>
              </tr>
            ) : filteredFeatures.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No features found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredFeatures.map((item, index) => (
                <tr
                  key={item._id || index}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color var(--transition-fast)',
                    opacity: item.isActive === false ? 0.65 : 1,
                  }}
                >
                  {/* Order & Reorder Controls */}
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          minWidth: '20px',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {item.displayOrder ?? index + 1}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'up')}
                          disabled={index === 0}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '1px',
                            cursor: index === 0 ? 'default' : 'pointer',
                            opacity: index === 0 ? 0.25 : 0.7,
                            color: 'var(--text-primary)',
                          }}
                          title="Move Up"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'down')}
                          disabled={index === filteredFeatures.length - 1}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '1px',
                            cursor: index === filteredFeatures.length - 1 ? 'default' : 'pointer',
                            opacity: index === filteredFeatures.length - 1 ? 0.25 : 0.7,
                            color: 'var(--text-primary)',
                          }}
                          title="Move Down"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Icon Preview */}
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-light)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={`Icon: ${item.icon}`}
                    >
                      {renderFeatureIcon(item.icon, {
                        size: 20,
                        style: { color: 'var(--accent-color)' },
                      })}
                    </div>
                  </td>

                  {/* Title */}
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.title}
                  </td>

                  {/* Description */}
                  <td
                    style={{
                      padding: '14px 16px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      fontSize: '0.85rem',
                    }}
                  >
                    {item.description}
                  </td>

                  {/* Status Toggle & Badge */}
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(item._id, item.isActive !== false, item.title)}
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor:
                          item.isActive !== false ? 'var(--badge-success-bg)' : 'var(--badge-danger-bg)',
                        color:
                          item.isActive !== false ? 'var(--badge-success-text)' : 'var(--badge-danger-text)',
                        transition: 'opacity 0.2s ease',
                      }}
                      title={`Click to ${item.isActive !== false ? 'deactivate' : 'activate'}`}
                    >
                      {item.isActive !== false ? '● Active' : '○ Inactive'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 10px' }}
                        title="Edit Feature"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handlePromptDelete(item)}
                        className="btn btn-sm"
                        style={{
                          padding: '6px 10px',
                          color: '#C5221F',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'transparent',
                        }}
                        title="Delete Feature"
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

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal, 50000)',
            padding: '20px',
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              padding: '28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '14px',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.45rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {editingFeature ? 'Edit Feature Card' : 'Add New Feature Card'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* LIVE CARD PREVIEW */}
            <div
              style={{
                marginBottom: '24px',
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px dashed var(--border-color)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  marginBottom: '12px',
                }}
              >
                <Eye size={14} /> Storefront Preview
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '20px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  maxWidth: '280px',
                  margin: '0 auto',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}
                >
                  {renderFeatureIcon(formData.icon, {
                    size: 24,
                    style: { color: 'var(--accent-color)' },
                  })}
                </div>
                <h4
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                  }}
                >
                  {formData.title || 'Feature Title'}
                </h4>
                <p
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {formData.description || 'Feature description explaining the customer benefit...'}
                </p>
              </div>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit}>
              {/* Title */}
              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                  }}
                >
                  Feature Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Premium Fabric, Elegant Designs, Long Lasting"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  maxLength={120}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                  }}
                >
                  Feature Description *
                </label>
                <textarea
                  rows={3}
                  placeholder="Soft & Breathable 100% pure combed cotton that feels gentle on sensitive skin all year round."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  maxLength={500}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                    resize: 'vertical',
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                  {formData.description.length} / 500 characters
                </div>
              </div>

              {/* Icon Selector */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Select Icon (Lucide Icons)
                  </label>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                    Selected: {formData.icon}
                  </span>
                </div>

                {/* Quick Search */}
                <input
                  type="text"
                  placeholder="Search icon (e.g. Feather, Palette, Shield, Clock, Heart)..."
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    marginBottom: '10px',
                  }}
                />

                {/* Icon Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
                    gap: '8px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                  }}
                >
                  {filteredIcons.map((ico) => {
                    const isSelected = formData.icon === ico.name;
                    const IconComponent = ico.component;
                    return (
                      <button
                        key={ico.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: ico.name })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px 4px',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected
                            ? '2px solid var(--accent-color)'
                            : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'var(--accent-light)' : 'var(--bg-card)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title={ico.label}
                      >
                        <IconComponent
                          size={20}
                          style={{
                            color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                            marginBottom: '4px',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.65rem',
                            color: isSelected ? 'var(--accent-color)' : 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '60px',
                            fontWeight: isSelected ? 700 : 400,
                          }}
                        >
                          {ico.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display Order & Active Toggle */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '24px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '6px',
                    }}
                  >
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Lower numbers appear first on storefront
                  </span>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '6px',
                    }}
                  >
                    Storefront Visibility
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      height: '42px',
                    }}
                  >
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: 'var(--accent-color)',
                          cursor: 'pointer',
                        }}
                      />
                      <span>{formData.isActive ? 'Active (Visible on Website)' : 'Inactive (Hidden)'}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingFeature ? 'Save Changes' : 'Save Feature'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmOpen && featureToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal, 50000)',
            padding: '20px',
          }}
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(197, 34, 31, 0.12)',
                color: '#C5221F',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={26} />
            </div>

            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Delete Feature?
            </h3>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to permanently delete{' '}
              <strong style={{ color: 'var(--text-primary)' }}>"{featureToDelete.title}"</strong>?
              This will remove it from the database and storefront.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="btn btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="btn"
                style={{
                  backgroundColor: '#C5221F',
                  color: '#fff',
                  border: 'none',
                }}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Feature'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeatures;
