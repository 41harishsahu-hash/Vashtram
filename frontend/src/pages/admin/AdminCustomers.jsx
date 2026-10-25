import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useCart } from '../../context/useCart';
import { Search } from 'lucide-react';

const AdminCustomers = () => {
  const { showToast } = useCart();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadCustomers = async () => {
      try {
        const res = await api.get('/admin/customers');
        if (isMounted && res.data?.success) {
          setCustomers(res.data.customers);
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to load customers', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCustomers();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const res = await api.put(`/admin/customers/${id}/toggle`);
      if (res.data?.success) {
        showToast(res.data.message);
        setCustomers((prev) =>
          prev.map((c) => (c._id === id ? { ...c, isActive: !currentStatus } : c))
        );
      }
    } catch (err) {
      showToast(err.message || 'Failed to toggle customer status', 'error');
    }
  };

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.9rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Customer Management
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '3px' }}>
          Registered customer accounts, purchase frequency, and lifetime spend
        </p>
      </div>

      {/* Search */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '14px 20px',
          marginBottom: '24px',
          maxWidth: '460px',
        }}
      >
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search by customer name, email, or mobile..."
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
      </div>

      {/* Table */}
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
            minWidth: '700px',
            borderCollapse: 'collapse',
            fontSize: '0.88rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Customer Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Email Address</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mobile</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Total Orders</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Total Spent</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Joined Date</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Account Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading customer records...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No customer records found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c._id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.name}
                  </td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{c.email}</td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                    {c.phone || c.address?.mobileNumber || '—'}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontWeight: 600 }}>{c.orderCount ?? 0}</span> orders
                  </td>

                  <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                    ₹{(c.totalSpent ?? 0).toLocaleString('en-IN')}
                  </td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {new Date(c.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: c.isActive !== false ? 'var(--badge-success-bg)' : 'var(--badge-danger-bg)',
                        color: c.isActive !== false ? 'var(--badge-success-text)' : 'var(--badge-danger-text)',
                      }}
                    >
                      {c.isActive !== false ? 'Active' : 'Deactivated'}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleStatus(c._id, c.isActive !== false, c.name)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        color: c.isActive !== false ? '#C5221F' : '#137333',
                      }}
                    >
                      {c.isActive !== false ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCustomers;
