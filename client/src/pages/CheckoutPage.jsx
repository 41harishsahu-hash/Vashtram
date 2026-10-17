import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/useCart';
import { useAuth } from '../context/useAuth';
import api from '../services/api';
import { storage } from '../utils/storage';
import { loadRazorpayScript } from '../utils/loadRazorpay';
import { pollPaymentStatusWorkflow } from '../utils/paymentPolling';
import useBodyScrollLock from '../utils/useBodyScrollLock';
import { Lock, CreditCard, Check, AlertCircle, RefreshCw } from 'lucide-react';
import {
  isValidFullName,
  isValidEmailAddress,
  isValidStreetAddress,
  isValidState,
  isValidCity,
  isValidDeliveryNotes,
} from '../utils/validationHelper';

const CheckoutPage = () => {
  const { cart, subtotal, shipping, total, clearCart, showToast, validateCartWithServer } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('vashtram_checkout_form');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          fullName: parsed.fullName || '',
          mobileNumber: parsed.mobileNumber || '',
          email: parsed.email || '',
          address: parsed.address || '',
          city: parsed.city || '',
          state: parsed.state || '',
          pincode: parsed.pincode || '',
          notes: parsed.notes || '',
        };
      }
    } catch { }
    return {
      fullName: user?.address?.fullName || user?.name || '',
      mobileNumber: user?.address?.mobileNumber || user?.phone || '',
      email: user?.email || '',
      address: user?.address?.address || '',
      city: user?.address?.city || '',
      state: user?.address?.state || '',
      pincode: user?.address?.pincode || '',
      notes: '',
    };
  });

  const [loadingStep, setLoadingStep] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [isPendingPayment, setIsPendingPayment] = useState(false);
  const [razorpayConfigured, setRazorpayConfigured] = useState(true);
  const [paymentBanner, setPaymentBanner] = useState({ state: 'none', message: '', orderId: null });

  // Lock body scroll during payment confirmation processing modal
  useBodyScrollLock(isPendingPayment);

  // Centralized payment status polling with exponential backoff & resilience
  const pollPaymentStatus = useCallback(
    async (orderIdToPoll) => {
      setIsPendingPayment(true);
      setSubmitting(true);
      setLoadingStep('Confirming payment status with bank...');

      const result = await pollPaymentStatusWorkflow(orderIdToPoll, {
        fetchStatus: (id) => api.get(`/payment/status/${id}`),
        onStateChange: (banner) => setPaymentBanner(banner),
      });

      if (result.state === 'confirmed' && result.confirmedOrderId) {
        clearCart();
        storage.clearPendingPayment();
        sessionStorage.removeItem('vashtram_checkout_form');
        showToast('Payment confirmed! Order placed successfully.', 'success');
        setTimeout(() => {
          navigate(`/order/${result.confirmedOrderId}`);
        }, 800);
      } else if (result.state === 'failed') {
        storage.clearPendingPayment();
        showToast(result.message || 'Payment could not be completed.', 'error');
        setIsPendingPayment(false);
        setSubmitting(false);
        setLoadingStep('');
      } else if (result.state === 'unknown') {
        setSubmitting(false);
        setLoadingStep('');
        showToast('Payment status is pending verification. Please do NOT pay again.', 'warning');
      }
    },
    [clearCart, navigate, showToast]
  );

  // Resume polling on mount if a pending payment exists in localStorage (e.g. after refresh, back button, network drop)
  useEffect(() => {
    const pending = storage.getPendingPayment();
    if (pending && pending.razorpayOrderId) {
      const ageMs = Date.now() - (pending.createdAt || 0);
      if (ageMs < 30 * 60 * 1000) {
        pollPaymentStatus(pending.razorpayOrderId);
      } else {
        storage.clearPendingPayment();
      }
    }
  }, [pollPaymentStatus]);

  const handleDismissBanner = () => {
    storage.clearPendingPayment();
    setPaymentBanner({ state: 'none', message: '', orderId: null });
    setIsPendingPayment(false);
    setSubmitting(false);
    setLoadingStep('');
  };

  // Validate cart against live catalog on load
  useEffect(() => {
    if (validateCartWithServer) {
      validateCartWithServer();
    }
  }, [validateCartWithServer]);

  // Check if Razorpay keys are configured on backend
  useEffect(() => {
    api
      .get('/payment/key')
      .then((res) => {
        if (res.data?.success && res.data.isConfigured !== undefined) {
          setRazorpayConfigured(res.data.isConfigured);
        }
      })
      .catch(() => {});
  }, []);

  // If cart is empty and no pending payment verification is active, redirect to cart page
  useEffect(() => {
    const pending = storage.getPendingPayment();
    if (cart.length === 0 && !isPendingPayment && !pending) {
      navigate('/cart');
    }
  }, [cart, navigate, isPendingPayment]);

  // Pre-fill user data if auth changes
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.address?.fullName || user.name || '',
        mobileNumber: prev.mobileNumber || user.address?.mobileNumber || user.phone || '',
        email: prev.email || user.email || '',
        address: prev.address || user.address?.address || '',
        city: prev.city || user.address?.city || '',
        state: prev.state || user.address?.state || '',
        pincode: prev.pincode || user.address?.pincode || '',
      }));
    }, 0);
    return () => clearTimeout(timer);
  }, [user]);

  const validateField = (name, value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    switch (name) {
      case 'fullName':
        if (!trimmed || !isValidFullName(trimmed)) {
          return 'Name must be 2–60 characters and contain a valid name.';
        }
        return null;
      case 'email':
        if (!trimmed || !isValidEmailAddress(trimmed)) {
          return 'Please enter a valid email address (maximum 254 characters).';
        }
        return null;
      case 'address':
        if (!trimmed || !isValidStreetAddress(trimmed)) {
          return 'Address must be 5–200 characters.';
        }
        return null;
      case 'city':
        if (!trimmed || !isValidCity(trimmed)) {
          return 'City must be 2–60 characters and contain a valid city name.';
        }
        return null;
      case 'state':
        if (!trimmed || !isValidState(trimmed)) {
          return 'State must be 2–60 characters and contain a valid state name.';
        }
        return null;
      case 'mobileNumber':
        if (!trimmed || !/^[6-9]\d{9}$/.test(trimmed)) {
          return 'Enter a valid 10-digit Indian mobile number starting with 6-9';
        }
        return null;
      case 'pincode':
        if (!trimmed || !/^\d{6}$/.test(trimmed)) {
          return 'Pincode must be exactly 6 digits';
        }
        return null;
      case 'notes':
        if (!trimmed) {
          return null;
        }
        if (trimmed.length > 250) {
          return 'Delivery instructions must not exceed 250 characters.';
        }
        if (!isValidDeliveryNotes(trimmed)) {
          return 'Please enter valid delivery instructions or leave this field empty.';
        }
        return null;
      default:
        return null;
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      const error = validateField(name, value);
      if (!error) {
        setErrors((prev) => ({ ...prev, [name]: null }));
      }
    }
  };

  const validate = () => {
    const errs = {};
    const fieldOrder = ['fullName', 'mobileNumber', 'email', 'address', 'city', 'state', 'pincode', 'notes'];
    for (const field of fieldOrder) {
      const error = validateField(field, formData[field]);
      if (error) {
        errs[field] = error;
      }
    }

    setErrors(errs);

    const firstInvalid = fieldOrder.find((field) => errs[field]);
    if (firstInvalid) {
      const el = document.querySelector(`[name="${firstInvalid}"]`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return Object.keys(errs).length === 0;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    // Prevent double submission / duplicate orders
    if (submitting || isPendingPayment) {
      return;
    }

    if (!validate()) {
      showToast('Please correct the errors in the shipping form', 'warning');
      return;
    }

    if (!isAuthenticated) {
      sessionStorage.setItem('vashtram_checkout_form', JSON.stringify(formData));
      showToast('Please sign in or create an account to finalize your order', 'info');
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }

    setSubmitting(true);
    setLoadingStep('Connecting to Razorpay...');

    try {
      // 1. Ensure Razorpay Checkout SDK is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        throw new Error('Failed to load Razorpay payment gateway. Please check your internet connection.');
      }

      // 2. Prepare payload and create Razorpay order on backend
      const orderItems = cart.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        size: item.size,
        sizeMeasurement: item.sizeMeasurement || '',
        sizeName: item.sizeName || '',
        price: item.price,
        color: item.color,
      }));

      const shippingAddressPayload = {
        fullName: formData.fullName.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        email: formData.email.trim().toLowerCase(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
      };

      setLoadingStep('Creating secure order...');
      const orderInitRes = await api.post('/payment/create-order', {
        items: orderItems,
        shippingAddress: shippingAddressPayload,
        notes: formData.notes ? formData.notes.trim() : '',
      });

      if (!orderInitRes.data?.success || !orderInitRes.data?.orderId) {
        throw new Error(orderInitRes.data?.message || 'Could not initiate Razorpay order');
      }

      const { orderId, amount, currency, keyId, totalAmount: serverTotalAmount } = orderInitRes.data;

      // Persist pending payment in safe storage to survive page refresh, browser back, or network interruptions
      storage.setPendingPayment({ razorpayOrderId: orderId, createdAt: Date.now() });

      // Price drift guard: Compare server-returned total with displayed total (difference > 1 INR)
      const expectedTotal = Number(serverTotalAmount || (amount / 100));
      if (Math.abs(expectedTotal - total) > 1) {
        setSubmitting(false);
        setLoadingStep('');
        storage.clearPendingPayment();
        showToast('Cart prices or shipping have updated. Please review your total before paying.', 'warning');
        return;
      }

      // 3. Configure official Razorpay Checkout options
      const options = {
        key: keyId,
        amount: amount,
        currency: currency || 'INR',
        name: 'VASHTRAM',
        description: `Mattress Protectors & Home Textiles (${cart.length} item${cart.length > 1 ? 's' : ''})`,
        image: `${window.location.origin}/og-image.jpeg`,
        order_id: orderId,
        prefill: {
          name: formData.fullName.trim(),
          email: formData.email.trim(),
          contact: formData.mobileNumber.trim(),
        },
        notes: {
          shippingCity: formData.city.trim(),
          shippingPincode: formData.pincode.trim(),
        },
        theme: {
          color: '#8B6239',
        },
        modal: {
          ondismiss: () => {
            if (!isPendingPayment) {
              setSubmitting(false);
              setLoadingStep('');
              storage.clearPendingPayment();
              showToast('Payment window closed. Your order was not placed.', 'info');
            }
          },
        },
        handler: async (paymentResponse) => {
          setSubmitting(true);
          setLoadingStep('Verifying payment signature with bank...');

          try {
            // 4. Verify HMAC-SHA256 signature on backend and confirm order
            const verifyRes = await api.post('/payment/verify', {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            });

            if (verifyRes.data?.success && verifyRes.data?.order) {
              clearCart();
              storage.clearPendingPayment();
              sessionStorage.removeItem('vashtram_checkout_form');
              showToast('Payment verified successfully! Order confirmed.', 'success');
              navigate(`/order/${verifyRes.data.order._id}`);
              return;
            }

            // When intent is claimed or finalizing, verify returns HTTP 202 with pending: true
            if (verifyRes.status === 202 || verifyRes.data?.pending) {
              await pollPaymentStatus(paymentResponse.razorpay_order_id);
            } else {
              throw new Error(verifyRes.data?.message || 'Payment verification failed');
            }
          } catch (verifyErr) {
            console.warn('[Payment Verify Network/Error]:', verifyErr.message || verifyErr);
            const status = verifyErr.status || verifyErr.response?.status;
            // On definite 4xx rejection (not timeout/network error)
            if (status && status >= 400 && status < 500 && status !== 408) {
              storage.clearPendingPayment();
              setIsPendingPayment(false);
              setSubmitting(false);
              setLoadingStep('');
              showToast(verifyErr.message || 'Payment verification rejected by server.', 'error');
              return;
            }
            // On timeout or network error: do NOT re-enable form, poll status with backoff
            await pollPaymentStatus(paymentResponse.razorpay_order_id);
          }
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on('payment.failed', (response) => {
        if (!isPendingPayment) {
          setSubmitting(false);
          setLoadingStep('');
          showToast(
            response.error?.description || 'Payment failed. Please try another payment method.',
            'error'
          );
        }
      });

      razorpay.open();
    } catch (err) {
      setSubmitting(false);
      setLoadingStep('');
      showToast(err.message || 'Failed to initiate online payment. Please try again.', 'error');
    }
  };

  return (
    <div style={{ padding: 'clamp(20px, 3.5vw, 36px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container">
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'clamp(18px, 3vw, 32px)',
          }}
        >
          Checkout
        </h1>

        {!isAuthenticated && (
          <div
            style={{
              backgroundColor: 'var(--accent-light)',
              padding: '14px 20px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Already have a VASHTRAM account? Sign in for saved addresses and faster checkout.
            </span>
            <Link
              to="/login"
              state={{ from: '/checkout' }}
              className="btn btn-primary btn-sm"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Resilient Payment Status Banner */}
        {paymentBanner.state !== 'none' && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md, 8px)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              backgroundColor:
                paymentBanner.state === 'confirmed'
                  ? 'rgba(46, 125, 50, 0.1)'
                  : paymentBanner.state === 'failed'
                  ? 'rgba(211, 47, 47, 0.1)'
                  : paymentBanner.state === 'unknown'
                  ? 'rgba(237, 108, 2, 0.12)'
                  : 'rgba(197, 160, 89, 0.15)',
              border: `1px solid ${
                paymentBanner.state === 'confirmed'
                  ? '#2e7d32'
                  : paymentBanner.state === 'failed'
                  ? '#d32f2f'
                  : paymentBanner.state === 'unknown'
                  ? '#ed6c02'
                  : 'var(--accent-color, #c5a059)'
              }`,
            }}
          >
            <div style={{ marginTop: '2px', flexShrink: 0 }}>
              {paymentBanner.state === 'processing' && (
                <RefreshCw
                  size={20}
                  style={{
                    color: 'var(--accent-color, #c5a059)',
                    animation: 'vashtram-spin 1.2s linear infinite',
                  }}
                />
              )}
              {paymentBanner.state === 'confirmed' && <Check size={20} color="#2e7d32" />}
              {(paymentBanner.state === 'failed' || paymentBanner.state === 'unknown') && (
                <AlertCircle
                  size={20}
                  color={paymentBanner.state === 'unknown' ? '#ed6c02' : '#d32f2f'}
                />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  marginBottom: '4px',
                  color:
                    paymentBanner.state === 'confirmed'
                      ? '#2e7d32'
                      : paymentBanner.state === 'failed'
                      ? '#d32f2f'
                      : paymentBanner.state === 'unknown'
                      ? '#c65102'
                      : 'var(--text-primary)',
                }}
              >
                {paymentBanner.state === 'processing' && 'Payment Processing'}
                {paymentBanner.state === 'confirmed' && 'Payment Confirmed'}
                {paymentBanner.state === 'failed' && 'Payment Incomplete'}
                {paymentBanner.state === 'unknown' && 'Payment Verification Pending — Do NOT Pay Again'}
              </div>
              <div
                style={{
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {paymentBanner.message}
              </div>
              {paymentBanner.state === 'unknown' && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Link to="/orders" className="btn btn-primary btn-sm">
                    View My Orders
                  </Link>
                  <button
                    type="button"
                    onClick={handleDismissBanner}
                    className="btn btn-outline btn-sm"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {paymentBanner.state === 'failed' && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleDismissBanner}
                    className="btn btn-outline btn-sm"
                  >
                    Dismiss &amp; Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handlePlaceOrder}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 400px',
              gap: 'clamp(20px, 3.5vw, 40px)',
              alignItems: 'start',
            }}
            className="checkout-grid"
          >
            {/* Left: Shipping Form */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 'clamp(16px, 3.5vw, 28px)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '20px',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '12px',
                }}
              >
                Shipping Information
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Full Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Full Name <span style={{ color: '#C5221F' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="e.g. Rohan Sharma"
                    maxLength={60}
                    minLength={2}
                    value={formData.fullName}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    style={{ borderColor: errors.fullName ? '#C5221F' : 'var(--border-color)' }}
                  />
                  {errors.fullName && (
                    <span style={{ color: '#C5221F', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      {errors.fullName}
                    </span>
                  )}
                </div>

                {/* Mobile & Email Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-row">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Mobile Number <span style={{ color: '#C5221F' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      name="mobileNumber"
                      placeholder="10-digit number"
                      maxLength={10}
                      value={formData.mobileNumber}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      style={{ borderColor: errors.mobileNumber ? '#C5221F' : 'var(--border-color)' }}
                    />
                    {errors.mobileNumber && (
                      <span style={{ color: '#C5221F', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {errors.mobileNumber}
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Email Address <span style={{ color: '#C5221F' }}>*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="e.g. rohan@example.com"
                      maxLength={254}
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      style={{ borderColor: errors.email ? '#C5221F' : 'var(--border-color)' }}
                    />
                    {errors.email && (
                      <span style={{ color: '#C5221F', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {errors.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Street Address / Flat / Building <span style={{ color: '#C5221F' }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    name="address"
                    placeholder="Enter complete building name, flat number, street and landmark"
                    maxLength={200}
                    minLength={5}
                    value={formData.address}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    style={{ borderColor: errors.address ? '#C5221F' : 'var(--border-color)' }}
                  />
                  {errors.address && (
                    <span style={{ color: '#C5221F', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      {errors.address}
                    </span>
                  )}
                </div>

                {/* City, State, Pincode */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }} className="form-row-3">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      City <span style={{ color: '#C5221F' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      placeholder="e.g. City"
                      maxLength={60}
                      minLength={2}
                      value={formData.city}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      style={{ borderColor: errors.city ? '#C5221F' : 'var(--border-color)' }}
                    />
                    {errors.city && (
                      <span style={{ color: '#C5221F', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {errors.city}
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      State <span style={{ color: '#C5221F' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="state"
                      placeholder="e.g. State"
                      maxLength={60}
                      minLength={2}
                      value={formData.state}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      style={{ borderColor: errors.state ? '#C5221F' : 'var(--border-color)' }}
                    />
                    {errors.state && (
                      <span style={{ color: '#C5221F', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {errors.state}
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Pincode <span style={{ color: '#C5221F' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="pincode"
                      placeholder="6 digits (e.g. PinCode)"
                      maxLength={6}
                      value={formData.pincode}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      style={{ borderColor: errors.pincode ? '#C5221F' : 'var(--border-color)' }}
                    />
                    {errors.pincode && (
                      <span style={{ color: '#C5221F', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {errors.pincode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Order Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Special Delivery Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    name="notes"
                    placeholder="e.g. Leave with security / Ring bell twice"
                    maxLength={250}
                    value={formData.notes}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    style={{ borderColor: errors.notes ? '#C5221F' : 'var(--border-color)' }}
                  />
                  {errors.notes && (
                    <span style={{ color: '#C5221F', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      {errors.notes}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Order Review & Payment */}
            <aside
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 'clamp(16px, 3vw, 24px)',
                position: 'sticky',
                top: '90px',
              }}
            >
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '16px',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '12px',
                }}
              >
                Order Summary
              </h2>

              {/* Items List */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  marginBottom: '20px',
                  paddingRight: '4px',
                }}
              >
                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            maxWidth: '180px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.name}
                        </p>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Qty: {item.quantity} • {item.size}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    ₹{subtotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Shipping Delivery</span>
                  <span style={{ fontWeight: 600, color: shipping === 0 ? '#137333' : 'var(--text-primary)' }}>
                    {shipping === 0 ? 'FREE' : `₹${shipping}`}
                  </span>
                </div>
                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Total
                  </span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ₹{total.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Payment Method - 100% PREPAID ONLINE ONLY */}
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}
                  >
                    Payment Method
                  </label>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      backgroundColor: 'rgba(19, 115, 51, 0.12)',
                      color: '#137333',
                    }}
                  >
                    <Check size={12} strokeWidth={3} /> Online Payment Only
                  </span>
                </div>

                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--accent-gold, #C5A059)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-color)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CreditCard size={16} />
                      </div>
                      <div>
                        <span
                          style={{
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            display: 'block',
                          }}
                        >
                          Razorpay Secure Checkout
                        </span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                          Instant &amp; 100% Encrypted Payment
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--accent-color)',
                        backgroundColor: 'var(--accent-light, #FAF5ED)',
                        border: '1px solid var(--accent-gold, #C5A059)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      Prepaid
                    </span>
                  </div>

                  {/* Payment options pills */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px dashed var(--border-color)',
                    }}
                  >
                    {['UPI (GPay, PhonePe, Paytm)', 'Cards (Visa, Master, RuPay)', 'Net Banking', 'Wallets'].map(
                      (method, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {method}
                        </span>
                      )
                    )}
                  </div>

                  <p
                    style={{
                      margin: '12px 0 0',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.4,
                    }}
                  >
                    VASHTRAM is a prepaid-only atelier. Your order is confirmed and prioritized for express dispatch immediately upon payment verification.
                  </p>

                  {!razorpayConfigured && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        backgroundColor: 'var(--badge-warning-bg, #FEF7E0)',
                        border: '1px solid #F5C242',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        color: 'var(--badge-warning-text, #B06000)',
                        lineHeight: 1.45,
                      }}
                    >
                      <strong>Razorpay Setup Notice:</strong> Configure your payment credentials in server environment variables to process live transactions.
                    </div>
                  )}
                </div>
              </div>

              {/* Pay ₹Amount Button */}
              <button
                type="submit"
                disabled={submitting || isPendingPayment}
                className="btn btn-primary btn-lg btn-full"
                style={{
                  padding: '14px',
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  opacity: submitting || isPendingPayment ? 0.7 : 1,
                  cursor: submitting || isPendingPayment ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting || isPendingPayment ? (
                  <span>{loadingStep || 'Processing Payment...'}</span>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Pay ₹{total.toLocaleString('en-IN')} via Razorpay</span>
                  </>
                )}
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                }}
              >
                <Lock size={14} />
                <span>256-Bit SSL Encrypted &amp; Secure Order Processing</span>
              </div>
            </aside>
          </div>
        </form>
      </div>

      {/* Task 4: Persistent Confirming Your Payment Modal */}
      {isPendingPayment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(26, 20, 16, 0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px)',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '16px',
              padding: '36px 28px',
              maxWidth: '460px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                margin: '0 auto 20px',
                width: '52px',
                height: '52px',
                border: '4px solid rgba(197, 160, 89, 0.2)',
                borderTopColor: 'var(--accent-color, #8B6239)',
                borderRadius: '50%',
                animation: 'vashtram-spin 0.9s linear infinite',
              }}
            />
            <h3
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                marginBottom: '10px',
                color: 'var(--text-primary)',
              }}
            >
              {loadingStep || 'Confirming payment status...'}
            </h3>
            <p
              style={{
                fontSize: '0.92rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: '0 0 18px',
              }}
            >
              We are finalizing your order with the bank and reserving your handcrafted items in our atelier. Please do not refresh or close this window.
            </p>
            <div
              style={{
                display: 'inline-block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--accent-color, #8B6239)',
                backgroundColor: 'var(--accent-light, #FAF5ED)',
                padding: '6px 14px',
                borderRadius: '20px',
              }}
            >
              Securing order with atelier inventory • Usually takes a few seconds
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes vashtram-spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 860px) {
          .checkout-grid {
            grid-template-columns: 1fr !important;
          }
          .checkout-grid aside {
            position: static !important;
            top: auto !important;
          }
          .form-row, .form-row-3 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CheckoutPage;
