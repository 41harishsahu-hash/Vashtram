import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useCart } from '../../context/useCart';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { Search, Eye, X } from 'lucide-react';

const AdminOrders = () => {
  const { showToast } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Lock body scroll when order details modal is open
  useBodyScrollLock(!!selectedOrder);
  const [newStatus, setNewStatus] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/admin/orders', {
        params: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search.trim() || undefined,
          limit: 50,
        },
      });
      if (res.data?.success) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, showToast]);

  useEffect(() => {
    let isMounted = true;
    const loadOrders = async () => {
      try {
        const res = await api.get('/admin/orders', {
          params: {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            search: search.trim() || undefined,
            limit: 50,
          },
        });
        if (isMounted && res.data?.success) {
          setOrders(res.data.orders);
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to load orders', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOrders();
    return () => {
      isMounted = false;
    };
  }, [statusFilter, search, showToast]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleOpenDetailModal = (order) => {
    setSelectedOrder(order);
    setNewStatus(order.orderStatus);
    setNewPaymentStatus(order.paymentStatus);
    setStatusNote('');
    setCourierName(order.shipment?.courierName || '');
    setTrackingNumber(order.shipment?.trackingNumber || '');
    setTrackingUrl(order.shipment?.trackingUrl || '');
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder) return;

    const statusChanged = newStatus !== selectedOrder.orderStatus;
    const trackingPayload = {
      courierName: courierName.trim(),
      trackingNumber: trackingNumber.trim(),
      trackingUrl: trackingUrl.trim(),
    };
    const oldShipment = selectedOrder.shipment || {};
    const trackingChanged =
      trackingPayload.courierName !== (oldShipment.courierName || '') ||
      trackingPayload.trackingNumber !== (oldShipment.trackingNumber || '') ||
      trackingPayload.trackingUrl !== (oldShipment.trackingUrl || '');

    if (
      statusChanged &&
      newStatus === 'Shipped' &&
      (!trackingPayload.courierName || !trackingPayload.trackingNumber)
    ) {
      showToast('Please enter the courier name and tracking number before marking the order as Shipped.', 'error');
      return;
    }

    setUpdating(true);
    try {
      // 1. Update order status if changed (courier / tracking details travel with it)
      if (statusChanged) {
        await api.put(`/admin/orders/${selectedOrder._id}/status`, {
          status: newStatus,
          note: statusNote.trim() || undefined,
          ...(newStatus === 'Shipped' || newStatus === 'Delivered' ? trackingPayload : {}),
        });
      } else if (['Shipped', 'Delivered'].includes(selectedOrder.orderStatus) && trackingChanged) {
        // Only the tracking details were corrected
        await api.patch(`/admin/orders/${selectedOrder._id}/tracking`, trackingPayload);
      }

      // 2. Update payment status if changed
      if (newPaymentStatus !== selectedOrder.paymentStatus) {
        await api.put(`/admin/orders/${selectedOrder._id}/payment`, {
          paymentStatus: newPaymentStatus,
        });
      }

      showToast(`Order #${selectedOrder.orderNumber} successfully updated!`);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      showToast(err.message || 'Failed to update order status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Delivered':
        return <span className="badge badge-success">Delivered</span>;
      case 'Shipped':
        return <span className="badge" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}>Shipped</span>;
      case 'Processing':
        return <span className="badge badge-warning">Processing</span>;
      case 'Confirmed':
        return <span className="badge" style={{ backgroundColor: '#F3E8FF', color: '#7E22CE' }}>Confirmed</span>;
      case 'Cancelled':
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Pending</span>;
    }
  };

  const statusTabs = ['all', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.9rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Order Management
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '3px' }}>
          Inspect verified prepaid orders and advance shipping fulfillment
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '10px',
          marginBottom: '20px',
        }}
      >
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: statusFilter === tab ? 600 : 500,
              backgroundColor: statusFilter === tab ? 'var(--accent-color)' : 'var(--bg-card)',
              color: statusFilter === tab ? 'var(--text-light)' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              whiteSpace: 'nowrap',
            }}
          >
            {tab === 'all' ? 'All Orders' : tab}
          </button>
        ))}
      </div>

      {/* Search Input Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '14px 20px',
          marginBottom: '24px',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Search by Order ID (#VST-...), customer name, mobile, email, or city..."
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
          <button type="submit" className="btn btn-secondary btn-sm">
            Search
          </button>
        </form>
      </div>

      {/* Orders Table */}
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
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Order ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Customer Info</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Items</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Total</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Payment</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Order Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading orders from database...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No orders match the selected criteria.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o._id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--accent-color)' }}>
                    #{o.orderNumber}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                      {o.shippingAddress?.fullName || o.user?.name || 'Customer'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      {o.shippingAddress?.mobileNumber} • {o.shippingAddress?.city}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontWeight: 600 }}>{o.items?.length || 0}</span> item(s)
                  </td>

                  <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                    ₹{o.totalAmount.toLocaleString('en-IN')}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)' }}>
                      {o.paymentMethod}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '3px',
                        backgroundColor:
                          o.paymentStatus === 'Completed'
                            ? 'var(--badge-success-bg)'
                            : 'var(--badge-warning-bg)',
                        color:
                          o.paymentStatus === 'Completed'
                            ? 'var(--badge-success-text)'
                            : 'var(--badge-warning-text)',
                      }}
                    >
                      {o.paymentStatus}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px' }}>{getStatusBadge(o.orderStatus)}</td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(o.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleOpenDetailModal(o)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      <Eye size={14} /> Update
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Order Detail & Status Update Modal */}
      {selectedOrder && (
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
            onClick={() => setSelectedOrder(null)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(3px)',
            }}
          />

          <div
            style={{
              position: 'relative',
              width: '680px',
              maxWidth: '100%',
              maxHeight: '90vh',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 4001,
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  Order #{selectedOrder.orderNumber}
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <button
                type="button"
                aria-label="Close order details modal"
                onClick={() => setSelectedOrder(null)}
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              {/* Customer and Delivery info */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '20px',
                  fontSize: '0.88rem',
                }}
              >
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {selectedOrder.shippingAddress?.fullName}
                </p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {selectedOrder.shippingAddress?.address}, {selectedOrder.shippingAddress?.city},{' '}
                  {selectedOrder.shippingAddress?.state} - {selectedOrder.shippingAddress?.pincode}
                </p>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Phone: <strong>{selectedOrder.shippingAddress?.mobileNumber}</strong> • Email:{' '}
                  <strong>{selectedOrder.shippingAddress?.email}</strong>
                </p>
              </div>

              {/* Items in this order */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>
                Items Ordered
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {selectedOrder.items?.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                      <div>
                        <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>{item.name}</p>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Qty: {item.quantity} • {item.size}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontWeight: 700 }}>
                  <span>Total Amount</span>
                  <span>₹{selectedOrder.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Update Controls */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Update Status</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Order Fulfillment Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      style={{ fontSize: '0.88rem' }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Payment Status
                    </label>
                    <select
                      value={newPaymentStatus}
                      onChange={(e) => setNewPaymentStatus(e.target.value)}
                      style={{ fontSize: '0.88rem' }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed (Paid Online)</option>
                      <option value="Failed">Failed</option>
                      <option value="Refunded">Refunded</option>
                    </select>
                  </div>
                </div>

                {(newStatus === 'Shipped' || newStatus === 'Delivered') && (
                  <div
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Courier &amp; Tracking Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                          Courier Name {newStatus === 'Shipped' ? '*' : ''}
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          placeholder="e.g. Delhivery, BlueDart, India Post"
                          value={courierName}
                          onChange={(e) => setCourierName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                          Tracking Number (AWB) {newStatus === 'Shipped' ? '*' : ''}
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          placeholder="e.g. 1234567890"
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                        Tracking Link (optional)
                      </label>
                      <input
                        type="url"
                        maxLength={500}
                        placeholder="https://..."
                        value={trackingUrl}
                        onChange={(e) => setTrackingUrl(e.target.value)}
                      />
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      The customer will see these details on their order page.
                    </p>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Note for customer timeline (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    placeholder="e.g. Your parcel has left our warehouse"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStatus}
                disabled={updating}
                className="btn btn-primary btn-sm"
              >
                {updating ? 'Saving...' : 'Update Order in MongoDB'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
