import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useCart } from '../../context/useCart';
import {
  UploadCloud,
  AlertCircle,
  RotateCcw,
  Image as ImageIcon,
  Save,
  X,
  FileCheck,
  ExternalLink,
} from 'lucide-react';
import { resolveImageUrl } from '../../utils/imageUrl';

const AdminAbout = () => {
  const { showToast } = useCart();
  const fileInputRef = useRef(null);

  const [aboutData, setAboutData] = useState({
    imageUrl: '/img/About/About.jpeg',
    altText: 'VASHTRAM Textile Weaving and Heritage',
    updatedAt: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // File selection state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadAbout = async () => {
      try {
        const res = await api.get('/about');
        if (isMounted && res.data?.success && res.data?.about) {
          setAboutData(res.data.about);
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to load About page information', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAbout();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  // Cleanup object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Validate and stage file for preview
  const handleStageFile = (file) => {
    setUploadError('');
    if (!file) return;

    // Allowed types: JPEG, PNG, WebP
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validMimes.includes(file.type) && !validExts.includes(ext)) {
      setUploadError('Invalid format. Only JPG, JPEG, PNG, and WebP images are supported.');
      showToast('Please select a valid image file (JPG, PNG, WebP)', 'warning');
      return;
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large. Maximum allowed size is 5MB.');
      showToast('Image size must be less than 5MB', 'warning');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setFileDetails({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: file.type || ext.replace('.', '').toUpperCase(),
    });
  };

  // Input change handler
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleStageFile(e.target.files[0]);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleStageFile(e.dataTransfer.files[0]);
    }
  };

  // Discard selected file preview
  const handleCancelSelection = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileDetails(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload and Save to Backend / Database
  const handleSaveImage = async (e) => {
    e?.preventDefault();
    if (!selectedFile) {
      showToast('Please choose an image from your computer first', 'warning');
      return;
    }

    setSaving(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('altText', aboutData.altText || 'VASHTRAM Textile Weaving and Heritage');

      const res = await api.post('/about/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        showToast('About page image uploaded and saved successfully!');
        if (res.data.about) {
          setAboutData(res.data.about);
        } else if (res.data.imageUrl) {
          setAboutData((prev) => ({ ...prev, imageUrl: res.data.imageUrl }));
        }

        handleCancelSelection();
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to upload image. Please try again.';
      setUploadError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reset to default brand image
  const handleResetDefault = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reset the About page image back to the original brand heritage image?'
      )
    ) {
      return;
    }

    try {
      const res = await api.post('/about/reset');
      if (res.data?.success) {
        showToast('About page image restored to brand default!');
        if (res.data.about) {
          setAboutData(res.data.about);
        } else {
          setAboutData((prev) => ({ ...prev, imageUrl: '/img/About/About.jpeg' }));
        }
        handleCancelSelection();
      }
    } catch (err) {
      showToast(err.message || 'Failed to reset About image', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '860px' }}>
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
            About Page Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '3px' }}>
            Upload and update the high-resolution brand visual displayed on the customer-facing About Page
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href="/about"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.84rem' }}
            title="Open customer-facing About page in a new tab"
          >
            <ExternalLink size={14} /> View Live About Page
          </a>
          <button
            type="button"
            onClick={handleResetDefault}
            className="btn btn-secondary"
            style={{ fontSize: '0.84rem' }}
            title="Restore default brand image"
          >
            <RotateCcw size={14} /> Restore Default
          </button>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: '48px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          Loading About page details...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* CURRENT LIVE STOREFRONT IMAGE CARD */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={18} style={{ color: 'var(--accent-color)' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Current Active About Image
                </h2>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--badge-success-bg)',
                  color: 'var(--badge-success-text)',
                }}
              >
                ● Active on Live Storefront
              </span>
            </div>

            <div
              style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                maxHeight: '340px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={resolveImageUrl(aboutData.imageUrl, '/img/About/About.jpeg')}
                alt={aboutData.altText || 'About Image'}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/img/About/About.jpeg';
                }}
                style={{
                  width: '100%',
                  height: '280px',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '12px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span>Alt: {aboutData.altText}</span>
              {aboutData.updatedAt && (
                <span>
                  Last Updated: {new Date(aboutData.updatedAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>

          {/* UPLOAD NEW IMAGE SECTION (NO IMAGE URL INPUT - DIRECT FILE UPLOAD ONLY) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Upload New About Image
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                Select an image file directly from your computer or device (JPG, PNG, WebP up to 5MB)
              </p>
            </div>

            {/* Hidden HTML File Input (No URL text inputs!) */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Error Message if any */}
            {uploadError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(197, 34, 31, 0.08)',
                  border: '1px solid rgba(197, 34, 31, 0.3)',
                  color: '#C5221F',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Drag & Drop Upload Zone (When no file is selected yet) */}
            {!selectedFile ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: dragActive
                    ? '2px dashed var(--accent-color)'
                    : '2px dashed var(--border-color)',
                  backgroundColor: dragActive ? 'var(--accent-light)' : 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-light)',
                    color: 'var(--accent-color)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <UploadCloud size={28} />
                </div>

                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                  }}
                >
                  Click to Choose Image From Device
                </h3>

                <p
                  style={{
                    fontSize: '0.84rem',
                    color: 'var(--text-secondary)',
                    maxWidth: '440px',
                    margin: '0 auto 16px',
                    lineHeight: 1.5,
                  }}
                >
                  Drag and drop your image file here, or browse files from your computer.
                </p>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <UploadCloud size={16} /> Choose Image
                </button>

                <div
                  style={{
                    marginTop: '16px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Supported: JPG, JPEG, PNG, WEBP (Max 5MB)
                </div>
              </div>
            ) : (
              /* SELECTED IMAGE PREVIEW & CONFIRMATION BOX */
              <div
                style={{
                  border: '1.5px solid var(--accent-color)',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck size={18} style={{ color: 'var(--accent-color)' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Selected Image Preview (Ready to Save)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelSelection}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem' }}
                    title="Cancel selection and choose another file"
                  >
                    <X size={14} /> Clear Selection
                  </button>
                </div>

                {/* Preview Image Container */}
                <div
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#000',
                    maxHeight: '320px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <img
                    src={previewUrl}
                    alt="Selected Preview"
                    style={{
                      width: '100%',
                      height: '260px',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>

                {/* File Metadata Info */}
                {fileDetails && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      flexWrap: 'wrap',
                      backgroundColor: 'var(--bg-card)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '18px',
                    }}
                  >
                    <span>
                      <strong>File:</strong> {fileDetails.name}
                    </span>
                    <span>
                      <strong>Size:</strong> {fileDetails.size}
                    </span>
                    <span>
                      <strong>Format:</strong> {fileDetails.type}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSaveImage}
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ minWidth: '150px' }}
                  >
                    <Save size={16} /> {saving ? 'Uploading & Saving...' : 'Save Image'}
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="btn btn-secondary"
                  >
                    Choose Different File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAbout;
