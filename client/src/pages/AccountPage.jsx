import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useCart } from '../context/useCart';
import { Package, LogOut, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  validateAccountForm,
  sanitizePhoneInput,
  sanitizePincodeInput,
} from '../utils/validationHelper';

const AccountPage = () => {
  const { user, updateProfile, logout } = useAuth();
  const { showToast } = useCart();

  const [formData, setFormData] = useState({
    name: user?.name ? String(user.name) : '',
    phone: user?.phone ? String(user.phone) : '',
    fullName: user?.address?.fullName ? String(user.address.fullName) : (user?.name ? String(user.name) : ''),
    mobileNumber: user?.address?.mobileNumber ? String(user.address.mobileNumber) : (user?.phone ? String(user.phone) : ''),
    address: user?.address?.address ? String(user.address.address) : '',
    city: user?.address?.city ? String(user.address.city) : '',
    state: user?.address?.state ? String(user.address.state) : '',
    pincode: user?.address?.pincode ? String(user.address.pincode) : '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const togglePasswordVisibility = (field) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);

  // Sync user profile data when user changes
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      setFormData((prev) => ({
        name: user.name != null ? String(user.name) : prev.name,
        phone: user.phone != null ? String(user.phone) : prev.phone,
        fullName: user.address?.fullName != null ? String(user.address.fullName) : (user.name != null ? String(user.name) : prev.fullName),
        mobileNumber: user.address?.mobileNumber != null ? String(user.address.mobileNumber) : (user.phone != null ? String(user.phone) : prev.mobileNumber),
        address: user.address?.address != null ? String(user.address.address) : prev.address,
        city: user.address?.city != null ? String(user.address.city) : prev.city,
        state: user.address?.state != null ? String(user.address.state) : (prev.state || ''),
        pincode: user.address?.pincode != null ? String(user.address.pincode) : prev.pincode,
      }));
    }, 0);
    return () => clearTimeout(timer);
  }, [user]);

  // Handle sanitized input changes & live validation for touched fields
  const handleChange = (name, rawValue) => {
    let value = rawValue;
    if (name === 'phone' || name === 'mobileNumber') {
      value = sanitizePhoneInput(rawValue);
    } else if (name === 'pincode') {
      value = sanitizePincodeInput(rawValue);
    }

    const updated = { ...formData, [name]: value };
    setFormData(updated);

    if (touched[name]) {
      const { errors: newErrors } = validateAccountForm(updated);
      setErrors(() => {
        const nextErrors = {};
        for (const key of Object.keys(newErrors)) {
          if (touched[key] || key === name) {
            nextErrors[key] = newErrors[key];
          }
        }
        return nextErrors;
      });
    }
  };

  // Mark field touched and run validation on blur
  const handleBlur = (fieldName) => {
    setTouched((prev) => {
      const nextTouched = { ...prev, [fieldName]: true };
      const { errors: newErrors } = validateAccountForm(formData);
      const filteredErrors = {};
      for (const key of Object.keys(newErrors)) {
        if (nextTouched[key]) {
          filteredErrors[key] = newErrors[key];
        }
      }
      setErrors(filteredErrors);
      return nextTouched;
    });
  };

  // Form submission with complete validation
  const handleSubmit = async (e) => {
    e.preventDefault();

    const allTouched = {
      name: true,
      phone: true,
      fullName: true,
      mobileNumber: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
    };
    setTouched(allTouched);

    const { errors: formErrors, isValid } = validateAccountForm(formData);
    setErrors(formErrors);

    if (!isValid) {
      const firstError = Object.values(formErrors)[0];
      showToast(firstError || 'Please fix the highlighted errors before saving.', 'error');
      return;
    }

    if (passwordData.newPassword || passwordData.currentPassword || passwordData.confirmPassword) {
      if (!passwordData.currentPassword) {
        showToast('Please enter your current password to set a new password.', 'error');
        return;
      }
      if (!passwordData.newPassword || passwordData.newPassword.length < 8) {
        showToast('New password must be at least 8 characters long.', 'error');
        return;
      }
      if (!/[a-zA-Z]/.test(passwordData.newPassword) || !/[0-9]/.test(passwordData.newPassword)) {
        showToast('New password must contain both letters and numbers.', 'error');
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        showToast('New password and confirmation do not match.', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: {
          fullName: formData.fullName.trim(),
          mobileNumber: formData.mobileNumber.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          pincode: formData.pincode.trim(),
        },
      };

      if (passwordData.newPassword) {
        payload.currentPassword = passwordData.currentPassword;
        payload.newPassword = passwordData.newPassword;
      }

      await updateProfile(payload);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPassword({ currentPassword: false, newPassword: false, confirmPassword: false });
      setErrors({});
      showToast(
        passwordData.newPassword
          ? 'Profile and password updated successfully! Session refreshed.'
          : 'Profile and address updated successfully!'
      );
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const hasStartedAddress =
    Boolean(String(formData.fullName || '').trim()) ||
    Boolean(String(formData.mobileNumber || '').trim()) ||
    Boolean(String(formData.address || '').trim()) ||
    Boolean(String(formData.city || '').trim()) ||
    Boolean(String(formData.pincode || '').trim());

  if (!user) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '600px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            Loading account details...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(20px, 3.5vw, 36px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(20px, 3vw, 32px)', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              My Account
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Manage your personal information and default delivery address
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/orders" className="btn btn-secondary btn-sm">
              <Package size={16} /> My Orders
            </Link>
          </div>
        </div>

        {/* Profile Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: 'clamp(18px, 3.5vw, 32px)',
            marginBottom: '32px',
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            <h2
              style={{
                fontSize: '1.2rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px',
              }}
            >
              Personal Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }} className="account-form-grid">
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Full Name <span style={{ color: '#D93025' }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  placeholder="e.g. Rohan Sharma"
                  maxLength={60}
                  style={
                    touched.name && errors.name
                      ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                      : {}
                  }
                />
                {touched.name && errors.name && (
                  <span
                    style={{
                      color: '#D93025',
                      fontSize: '0.78rem',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <AlertCircle size={13} /> {errors.name}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Email cannot be changed</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Contact Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  onBlur={() => handleBlur('phone')}
                  placeholder="10-digit number (e.g. 9876543210)"
                  maxLength={10}
                  style={
                    touched.phone && errors.phone
                      ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                      : {}
                  }
                />
                {touched.phone && errors.phone ? (
                  <span
                    style={{
                      color: '#D93025',
                      fontSize: '0.78rem',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <AlertCircle size={13} /> {errors.phone}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Optional, 10-digit mobile number starting with 6-9
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Account Role
                </label>
                <input
                  type="text"
                  value={user?.role === 'admin' ? 'Administrator' : 'Customer'}
                  disabled
                  style={{ opacity: 0.6 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px' }}>
              <h2
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Default Delivery Address
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {hasStartedAddress ? 'All fields required' : 'Optional'}
              </span>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '20px' }}>
              Saved address is automatically prefilled during checkout for quick ordering.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="account-form-grid">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Recipient Name {hasStartedAddress && <span style={{ color: '#D93025' }}>*</span>}
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    onBlur={() => handleBlur('fullName')}
                    placeholder="e.g. Rohan Sharma"
                    maxLength={60}
                    style={
                      touched.fullName && errors.fullName
                        ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                        : {}
                    }
                  />
                  {touched.fullName && errors.fullName && (
                    <span
                      style={{
                        color: '#D93025',
                        fontSize: '0.78rem',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertCircle size={13} /> {errors.fullName}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Recipient Mobile {hasStartedAddress && <span style={{ color: '#D93025' }}>*</span>}
                  </label>
                  <input
                    type="tel"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={(e) => handleChange('mobileNumber', e.target.value)}
                    onBlur={() => handleBlur('mobileNumber')}
                    placeholder="10-digit number"
                    maxLength={10}
                    style={
                      touched.mobileNumber && errors.mobileNumber
                        ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                        : {}
                    }
                  />
                  {touched.mobileNumber && errors.mobileNumber && (
                    <span
                      style={{
                        color: '#D93025',
                        fontSize: '0.78rem',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertCircle size={13} /> {errors.mobileNumber}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Street / Flat Address {hasStartedAddress && <span style={{ color: '#D93025' }}>*</span>}
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  onBlur={() => handleBlur('address')}
                  placeholder="Apartment, Street name, Area"
                  maxLength={250}
                  style={
                    touched.address && errors.address
                      ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                      : {}
                  }
                />
                {touched.address && errors.address && (
                  <span
                    style={{
                      color: '#D93025',
                      fontSize: '0.78rem',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <AlertCircle size={13} /> {errors.address}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }} className="account-form-grid-3">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    City {hasStartedAddress && <span style={{ color: '#D93025' }}>*</span>}
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    onBlur={() => handleBlur('city')}
                    placeholder="e.g. Mumbai"
                    maxLength={60}
                    style={
                      touched.city && errors.city
                        ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                        : {}
                    }
                  />
                  {touched.city && errors.city && (
                    <span
                      style={{
                        color: '#D93025',
                        fontSize: '0.78rem',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertCircle size={13} /> {errors.city}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    State {hasStartedAddress && <span style={{ color: '#D93025' }}>*</span>}
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    onBlur={() => handleBlur('state')}
                    placeholder="e.g. Rajasthan"
                    maxLength={60}
                    style={
                      touched.state && errors.state
                        ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                        : {}
                    }
                  />
                  {touched.state && errors.state && (
                    <span
                      style={{
                        color: '#D93025',
                        fontSize: '0.78rem',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertCircle size={13} /> {errors.state}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Pincode {hasStartedAddress && <span style={{ color: '#D93025' }}>*</span>}
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    onBlur={() => handleBlur('pincode')}
                    placeholder="6-digit pincode"
                    maxLength={6}
                    style={
                      touched.pincode && errors.pincode
                        ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                        : {}
                    }
                  />
                  {touched.pincode && errors.pincode && (
                    <span
                      style={{
                        color: '#D93025',
                        fontSize: '0.78rem',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertCircle size={13} /> {errors.pincode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* SECURITY & PASSWORD CHANGE SECTION */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Lock size={18} style={{ color: 'var(--accent-color)' }} />
                Security &amp; Password
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: '16px' }}>
                Leave these fields blank if you do not wish to change your password.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Current Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword.currentPassword ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, currentPassword: e.target.value })
                      }
                      placeholder="Enter current password"
                      autoComplete="current-password"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('currentPassword')}
                      aria-label={showPassword.currentPassword ? 'Hide Current Password' : 'Show Current Password'}
                      title={showPassword.currentPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm, 4px)',
                        transition: 'color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      {showPassword.currentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword.newPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      placeholder="Min. 8 characters (letters & numbers)"
                      autoComplete="new-password"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('newPassword')}
                      aria-label={showPassword.newPassword ? 'Hide New Password' : 'Show New Password'}
                      title={showPassword.newPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm, 4px)',
                        transition: 'color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      {showPassword.newPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword.confirmPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirmPassword')}
                      aria-label={showPassword.confirmPassword ? 'Hide Confirm New Password' : 'Show Confirm New Password'}
                      title={showPassword.confirmPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm, 4px)',
                        transition: 'color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      {showPassword.confirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Row */}
            <div
              className="account-form-actions"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving Changes...' : 'Save Profile & Settings'}
              </button>

              <button
                type="button"
                className="account-signout-btn"
                onClick={() => {
                  logout();
                  if (showToast) showToast('Signed out from all devices');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#C5221F',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(197, 34, 31, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .account-form-grid, .account-form-grid-3 {
            grid-template-columns: 1fr !important;
          }
          .account-form-actions {
            flex-direction: column;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .account-form-actions .btn-primary {
            width: 100%;
            justify-content: center;
          }
          .account-form-actions .account-signout-btn {
            justify-content: center;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default AccountPage;
