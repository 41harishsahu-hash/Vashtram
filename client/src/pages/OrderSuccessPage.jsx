import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { CheckCircle2, Clock, ArrowRight } from 'lucide-react';

const OrderSuccessPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        if (res.data?.success) {
          setOrder(res.data.order);
        }
      } catch (err) {
        setError(err.message || 'Unable to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Retrieving your order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>Order Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          {error || 'Unable to locate order.'}
        </p>
        <Link to="/orders" className="btn btn-primary">
          View My Orders
        </Link>
      </div>
    );
  }

  const {
    orderNumber,
    orderStatus,
    paymentMethod,
    paymentStatus,
    items = [],
    shippingAddress,
    subtotal,
    shippingPrice,
    totalAmount,
    createdAt,
    shipment,
    statusHistory = [],
  } = order;

  const statuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];
  const currentStep = statuses.indexOf(orderStatus);

  const isClosed = orderStatus === 'Cancelled' || orderStatus === 'Returned';
  const headline = isClosed
    ? `Order ${orderStatus}`
    : orderStatus === 'Delivered'
      ? 'Order Delivered'
      : orderStatus === 'Shipped'
        ? 'Your Order Is On Its Way'
        : 'Order Placed Successfully!';
  const subline = isClosed
    ? 'This order is closed. If you have any questions, please contact us with your order number.'
    : orderStatus === 'Delivered'
      ? 'Your order has been delivered. Thank you for shopping with VASHTRAM!'
      : orderStatus === 'Shipped'
        ? 'Your parcel has been handed over to the courier. You can track it below.'
        : null;

  const hasTrackingDetails = Boolean(shipment && (shipment.courierName || shipment.trackingNumber));
  const hasSafeTrackingUrl = Boolean(shipment?.trackingUrl) && /^https?:\/\//i.test(shipment.trackingUrl);
  const timeline = [...statusHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
  const formatDateTime = (value) =>
    new Date(value).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div style={{ padding: 'clamp(20px, 3.5vw, 40px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        {/* Success Banner */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: 'clamp(20px, 4vw, 36px) clamp(16px, 3.5vw, 28px)',
            textAlign: 'center',
            marginBottom: '32px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: isClosed ? '#FDECEA' : '#E6F4EA',
              color: isClosed ? '#B3261E' : '#137333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '8px',
            }}
          >
            {headline}
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '16px' }}>
            {subline || (
              <>
                Thank you for choosing <strong>VASHTRAM</strong>. We are preparing your mattress protectors for dispatch.
              </>
            )}
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'var(--bg-secondary)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            <span>Order Number:</span>
            <span style={{ color: 'var(--accent-color)', letterSpacing: '0.04em' }}>{orderNumber}</span>
          </div>
        </div>

        {/* Order Progress Stepper */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: '28px',
            marginBottom: '32px',
          }}
        >
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '24px' }}>Order Tracking</h3>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              position: 'relative',
              marginBottom: '16px',
            }}
            className="tracking-stepper"
          >
            {statuses.map((status, index) => {
              const isPassed = index <= currentStep;
              const isCurrent = index === currentStep;

              return (
                <div
                  key={status}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    zIndex: 2,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: isPassed ? 'var(--accent-color)' : 'var(--bg-secondary)',
                      color: isPassed ? 'var(--text-light)' : 'var(--text-muted)',
                      border: isCurrent ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      marginBottom: '8px',
                      boxShadow: isCurrent ? '0 0 0 3px var(--accent-light)' : 'none',
                    }}
                  >
                    {isPassed ? '✓' : index + 1}
                  </div>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: isCurrent ? 700 : 500,
                      color: isPassed ? 'var(--text-primary)' : 'var(--text-muted)',
                      textAlign: 'center',
                    }}
                  >
                    {status}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}
          >
            <Clock size={16} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
            <span>
              Placed on {new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.
              Current Status: <strong style={{ color: 'var(--text-primary)' }}>{orderStatus}</strong>
            </span>
          </div>
        </div>

        {/* Shipment / Courier Details */}
        {hasTrackingDetails && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '24px 28px',
              marginBottom: '32px',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>Shipment Details</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                marginBottom: '18px',
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Courier
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>{shipment.courierName || '-'}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Tracking Number
                </span>
                <strong style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {shipment.trackingNumber || '-'}
                </strong>
              </div>
              {shipment.shippedAt && (
                <div>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Shipped On
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {new Date(shipment.shippedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
              )}
            </div>
            {hasSafeTrackingUrl ? (
              <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                Track on courier website
              </a>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                You can track this parcel on the courier&apos;s website using the tracking number above.
              </p>
            )}
          </div>
        )}

        {/* Order Timeline */}
        {timeline.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '24px 28px',
              marginBottom: '32px',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px' }}>Order Timeline</h3>
            <ol
              style={{
                listStyle: 'none',
                margin: '0 0 0 8px',
                padding: '0 0 0 20px',
                borderLeft: '2px solid var(--border-color)',
              }}
            >
              {timeline.map((entry, index) => (
                <li
                  key={`${entry.status}-${entry.date}-${index}`}
                  style={{
                    position: 'relative',
                    paddingBottom: index === timeline.length - 1 ? 0 : '18px',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: '-27px',
                      top: '4px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: index === 0 ? 'var(--accent-color)' : 'var(--border-color)',
                    }}
                  />
                  <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', margin: 0 }}>
                    <strong>{entry.status}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> - {formatDateTime(entry.date)}</span>
                  </p>
                  {entry.note && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{entry.note}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Order Details & Summary Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '24px',
            marginBottom: '32px',
          }}
          className="order-detail-grid"
        >
          {/* Purchased Items */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>
              Items Ordered ({items.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    paddingBottom: idx < items.length - 1 ? '14px' : '0',
                    borderBottom: idx < items.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover' }}
                    />
                    <div>
                      <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.name}
                      </p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Qty: {item.quantity} • {item.size}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping & Payment Summary */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>
              Delivery &amp; Payment
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Delivery Address
              </span>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {shippingAddress.fullName}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {shippingAddress.address}, {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Mobile: {shippingAddress.mobileNumber}
              </p>
            </div>

            <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Payment Information
              </span>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {paymentMethod}
              </p>
              {order.razorpayPaymentId && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                  Ref: {order.razorpayPaymentId}
                </p>
              )}
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: paymentStatus === 'Completed' ? 'var(--badge-success-bg)' : 'var(--badge-warning-bg)',
                  color: paymentStatus === 'Completed' ? 'var(--badge-success-text)' : 'var(--badge-warning-text)',
                  marginTop: '4px',
                }}
              >
                Payment: {paymentStatus === 'Completed' ? 'Verified & Paid' : paymentStatus}
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Delivery Fee</span>
                <span style={{ color: shippingPrice === 0 ? '#137333' : 'inherit' }}>
                  {shippingPrice === 0 ? 'FREE' : `₹${shippingPrice}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700 }}>
                <span>Total Paid</span>
                <span>₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation CTAs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }} className="success-actions">
          <Link to="/orders" className="btn btn-secondary">
            View All My Orders
          </Link>
          <Link to="/shop" className="btn btn-primary">
            Continue Shopping <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .order-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .tracking-stepper span {
            font-size: 0.68rem !important;
          }
          .success-actions .btn {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </div>
  );
};

export default OrderSuccessPage;
