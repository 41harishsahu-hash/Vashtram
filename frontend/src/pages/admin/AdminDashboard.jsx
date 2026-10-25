import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import {
  Package,
  ShoppingBag,
  Users,
  IndianRupee,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  MessageSquare,
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Admin Dashboard | VASHTRAM';
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/admin/dashboard');
        if (res.data?.success) {
          setStats(res.data.stats);
          setRecentOrders(res.data.recentOrders || []);
          setLowStockItems(res.data.lowStockItems || []);
        }
      } catch (err) {
        console.error('Failed to load admin dashboard stats', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
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
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading live database analytics...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Title & Quick Add Button */}
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
              fontFamily: 'var(--font-heading)',
              fontSize: '1.95rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            Vashtram Admin Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '3px' }}>
            Real-time business performance and inventory overview
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/admin/products" className="btn btn-primary btn-sm">
            <Plus size={16} /> Manage Products
          </Link>
          <Link to="/admin/orders" className="btn btn-secondary btn-sm">
            View All Orders
          </Link>
          <Link
            to="/admin/inquiries"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <MessageSquare size={15} /> Inquiries
            {stats?.newInquiries > 0 && (
              <span
                style={{
                  backgroundColor: '#2563EB',
                  color: '#fff',
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  marginLeft: '2px',
                }}
              >
                {stats.newInquiries}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Top 4 Primary Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {/* Total Products */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '22px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Total Products
            </span>
            <span style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalProducts ?? 0}
            </span>
          </div>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package size={22} />
          </div>
        </div>

        {/* Total Orders */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '22px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Total Orders
            </span>
            <span style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalOrders ?? 0}
            </span>
          </div>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingBag size={22} />
          </div>
        </div>

        {/* Total Customers */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '22px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Total Customers
            </span>
            <span style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalCustomers ?? 0}
            </span>
          </div>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={22} />
          </div>
        </div>

        {/* Total Revenue */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '22px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Total Revenue
            </span>
            <span style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              ₹{(stats?.totalRevenue ?? 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IndianRupee size={22} />
          </div>
        </div>
      </div>

      {/* Secondary Status Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Pending Orders</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#B06000' }}>
              {stats?.pendingOrders ?? 0}
            </p>
          </div>
          <Clock size={22} style={{ color: '#B06000' }} />
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Processing Orders</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-color)' }}>
              {stats?.processingOrders ?? 0}
            </p>
          </div>
          <ShoppingBag size={22} style={{ color: 'var(--accent-color)' }} />
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Low Stock Products</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#C5221F' }}>
              {stats?.lowStockCount ?? 0}
            </p>
          </div>
          <AlertTriangle size={22} style={{ color: '#C5221F' }} />
        </div>
      </div>

      {/* Main Grid: Recent Orders Table & Low Stock List */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.8fr 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
        className="admin-dashboard-grid"
      >
        {/* Recent Orders Table */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            overflowX: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
            }}
          >
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Recent Orders</h2>
            <Link
              to="/admin/orders"
              style={{
                fontSize: '0.85rem',
                color: 'var(--accent-color)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              View All <ArrowUpRight size={14} />
            </Link>
          </div>

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
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Order ID</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No orders placed yet.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr
                    key={order._id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color var(--transition-fast)',
                    }}
                  >
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent-color)' }}>
                      <Link to={`/admin/orders`}>#{order.orderNumber}</Link>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {order.shippingAddress?.fullName || order.user?.name || 'Customer'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px' }}>{getStatusBadge(order.orderStatus)}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Low Stock Alerts */}
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
              marginBottom: '18px',
            }}
          >
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Low Stock Alert</h2>
            <span
              style={{
                backgroundColor: 'var(--badge-danger-bg)',
                color: 'var(--badge-danger-text)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {lowStockItems.length} Products
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {lowStockItems.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                All product inventory levels are healthy!
              </p>
            ) : (
              lowStockItems.map((prod) => (
                <div
                  key={prod._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={prod.images && prod.images.length > 0 ? prod.images[0] : ''}
                      alt={prod.name}
                      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                    <div>
                      <p
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          maxWidth: '160px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {prod.name}
                      </p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        SKU: {prod.sku}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--badge-danger-bg)',
                      color: 'var(--badge-danger-text)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {prod.stock} Left
                  </span>
                </div>
              ))
            )}
          </div>

          <Link
            to="/admin/products"
            className="btn btn-secondary btn-sm btn-full"
            style={{ marginTop: '18px' }}
          >
            Manage Inventory
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 990px) {
          .admin-dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
