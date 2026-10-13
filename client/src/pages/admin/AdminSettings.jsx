import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useCart } from '../../context/useCart';
import { useSettings } from '../../context/useSettings';
import { formatWhatsAppNumber } from '../../utils/whatsapp';
import { WhatsAppIcon } from '../../components/common/WhatsAppButton';
import { Save, ExternalLink } from 'lucide-react';

const AdminSettings = () => {
  const { showToast } = useCart();
  const { updateLocalSettings } = useSettings();

  const [storeSettings, setStoreSettings] = useState({
    storeName: 'VASHTRAM Mattress Protectors',
    supportEmail: 'vashtramclothsy.info@gmail.com',
    supportPhone: '+91 7691841583',
    whatsappNumber: '+91 7691841583',
    storeAddress: 'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021',
    currency: 'INR (₹)',
    freeShippingThreshold: 999,
    standardShippingFee: 99,
    enableReturns: true,
    returnDays: 7,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch real settings from MongoDB backend on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data?.success && res.data?.settings) {
          setStoreSettings((prev) => ({
            ...prev,
            ...res.data.settings,
          }));
        }
      } catch (err) {
        showToast(err.message || 'Failed to load store settings', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [showToast]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!storeSettings.storeName?.trim()) {
      showToast('Store name is required', 'error');
      return;
    }

    if (!storeSettings.whatsappNumber?.trim() || !/^\+?[0-9\s\-()]{7,20}$/.test(storeSettings.whatsappNumber.trim())) {
      showToast('Please provide a valid WhatsApp business number (minimum 7 digits)', 'error');
      return;
    }

    if (!storeSettings.supportEmail?.trim() || !/^\S+@\S+\.\S+$/.test(storeSettings.supportEmail.trim())) {
      showToast('Please provide a valid customer support email', 'error');
      return;
    }

    if (!storeSettings.supportPhone?.trim()) {
      showToast('Please provide a valid customer support phone', 'error');
      return;
    }

    if (!storeSettings.storeAddress?.trim()) {
      showToast('Store address is required', 'error');
      return;
    }

    if (isNaN(Number(storeSettings.freeShippingThreshold)) || Number(storeSettings.freeShippingThreshold) < 0) {
      showToast('Free shipping threshold cannot be negative or invalid', 'error');
      return;
    }

    if (isNaN(Number(storeSettings.standardShippingFee)) || Number(storeSettings.standardShippingFee) < 0) {
      showToast('Standard shipping fee cannot be negative or invalid', 'error');
      return;
    }

    if (isNaN(Number(storeSettings.returnDays)) || Number(storeSettings.returnDays) < 0 || Number(storeSettings.returnDays) > 365) {
      showToast('Return days must be between 0 and 365 days', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/settings', {
        ...storeSettings,
        freeShippingThreshold: Number(storeSettings.freeShippingThreshold),
        standardShippingFee: Number(storeSettings.standardShippingFee),
        returnDays: Number(storeSettings.returnDays),
      });
      if (res.data?.success) {
        showToast('Store settings & WhatsApp number saved successfully!');
        if (res.data.settings) {
          setStoreSettings(res.data.settings);
          updateLocalSettings(res.data.settings);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to save store settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cleanWaNumber = formatWhatsAppNumber(storeSettings.whatsappNumber);
  const waTestLink = `https://wa.me/${cleanWaNumber}`;

  return (
    <div style={{ maxWidth: '780px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.9rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Store Settings &amp; WhatsApp Configuration
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '3px' }}>
          Manage your WhatsApp business contact number, customer support channels, shipping rates, and store policies
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '28px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading store settings from database...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* WHATSAPP BUSINESS NUMBER SECTION */}
            <div
              style={{
                backgroundColor: 'rgba(37, 211, 102, 0.05)',
                border: '1.5px solid rgba(37, 211, 102, 0.35)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#25D366',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <WhatsAppIcon size={18} color="#FFFFFF" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    WhatsApp Business Number
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#128C7E', fontWeight: 600 }}>
                    Active on Storefront Floating Button &amp; Direct Chat
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
                Customer clicks on the floating WhatsApp button and bulk inquiry buttons will automatically open a chat with this configured number.
              </p>

              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--text-primary)',
                  }}
                >
                  WhatsApp Business Number *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={storeSettings.whatsappNumber}
                    onChange={(e) =>
                      setStoreSettings({ ...storeSettings, whatsappNumber: e.target.value })
                    }
                    placeholder="+91 7691841583"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      fontSize: '1rem',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      borderRadius: 'var(--radius-sm)',
                      border: '1.5px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Accepts standard formats: +91 7691841583, 7691841583, or 917691841583 (India country code +91 will be auto-applied if omitted).
                </span>
              </div>

              {/* Dynamic Target Link Preview */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  backgroundColor: 'var(--bg-card)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <strong>Live Target URL:</strong>{' '}
                  <code style={{ color: '#075E54', fontWeight: 600 }}>{waTestLink}</code>
                </div>
                <a
                  href={waTestLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.78rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#075E54',
                    border: '1px solid #25D366',
                  }}
                  title="Open test chat in new tab"
                >
                  <ExternalLink size={13} /> Test WhatsApp Link
                </a>
              </div>
            </div>

            {/* STORE GENERAL INFORMATION */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
                Store &amp; Support Channels
              </h3>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Store Name
                </label>
                <input
                  type="text"
                  value={storeSettings.storeName}
                  onChange={(e) => setStoreSettings({ ...storeSettings, storeName: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Customer Support Email
                  </label>
                  <input
                    type="email"
                    value={storeSettings.supportEmail}
                    onChange={(e) => setStoreSettings({ ...storeSettings, supportEmail: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Customer Support Phone
                  </label>
                  <input
                    type="text"
                    value={storeSettings.supportPhone}
                    onChange={(e) => setStoreSettings({ ...storeSettings, supportPhone: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Store / Business Address *
                </label>
                <textarea
                  value={storeSettings.storeAddress || ''}
                  onChange={(e) => setStoreSettings({ ...storeSettings, storeAddress: e.target.value })}
                  placeholder="D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021"
                  required
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            {/* SHIPPING & CHECKOUT */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
                Shipping &amp; Delivery Thresholds
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Free Shipping Threshold (₹)
                  </label>
                  <input
                    type="number"
                    value={storeSettings.freeShippingThreshold}
                    onChange={(e) =>
                      setStoreSettings({
                        ...storeSettings,
                        freeShippingThreshold: Number(e.target.value),
                      })
                    }
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Orders above this amount receive free shipping
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Standard Shipping Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={storeSettings.standardShippingFee}
                    onChange={(e) =>
                      setStoreSettings({
                        ...storeSettings,
                        standardShippingFee: Number(e.target.value),
                      })
                    }
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* PAYMENT & RETURNS */}
            <div
              style={{
                borderTop: '1px solid var(--border-color)',
                paddingTop: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Payment &amp; Return Policies</h3>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.88rem',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#137333',
                  }}
                />
                <span>100% Prepaid-Only Checkout (Razorpay Gateway Active)</span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={storeSettings.enableReturns}
                  onChange={(e) => setStoreSettings({ ...storeSettings, enableReturns: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                Allow Doorstep Returns &amp; Replacements
              </label>

              {storeSettings.enableReturns && (
                <div style={{ maxWidth: '240px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Return Window (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={storeSettings.returnDays}
                    onChange={(e) =>
                      setStoreSettings({
                        ...storeSettings,
                        returnDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Number of days customer can request return/replacement (1-365)
                  </span>
                </div>
              )}
            </div>

            {/* SAVE BUTTON */}
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary btn-lg"
                style={{ minWidth: '160px' }}
              >
                <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
