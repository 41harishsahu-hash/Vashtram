import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Package, ChevronRight, ArrowRight } from 'lucide-react';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get('/orders/myorders');
        if (res.data?.success) {
          setOrders(res.data.orders);
        }
      } catch (err) {
        console.error('Failed to load orders', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

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

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading your orders...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(20px, 3.5vw, 36px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
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
              My Order History
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Track current orders and review past purchases
            </p>
          </div>

          <Link to="/shop" className="btn btn-secondary btn-sm">
            Shop More
          </Link>
        </div>

        {orders.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '60px 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: 'var(--accent-color)',
              }}
            >
              <Package size={28} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Orders Placed Yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Explore our Mattress Protector collection and give your bedroom the protection it deserves today.
            </p>
            <Link to="/shop" className="btn btn-primary">
              Start Shopping <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {orders.map((order) => (
              <div
                key={order._id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  padding: 'clamp(14px, 3vw, 24px)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'box-shadow var(--transition-fast)',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '14px',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      #{order.orderNumber}
                    </span>
                    {getStatusBadge(order.orderStatus)}
                  </div>

                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {/* Items Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover' }}
                        />
                        <div>
                          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.name}
                          </p>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Qty: {item.quantity} • {item.size}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer / Total & Details Link */}
                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block' }}>
                      Payment: {order.paymentMethod} ({order.paymentStatus})
                    </span>
                    {order.shipment?.trackingNumber && (
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block' }}>
                        Shipped via {order.shipment.courierName || 'courier'} - Tracking No: {order.shipment.trackingNumber}
                      </span>
                    )}
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Total: ₹{order.totalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <Link to={`/order/${order._id}`} className="btn btn-secondary btn-sm">
                    View Tracking Details <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
