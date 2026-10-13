import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useCart } from '../../context/useCart';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import {
  MessageSquare,
  Search,
  Eye,
  Trash2,
  Mail,
  Phone,
  RefreshCw,
  X,
  MessageCircle,
} from 'lucide-react';

const AdminInquiries = () => {
  const { showToast } = useCart();
  const [inquiries, setInquiries] = useState([]);
  const [stats, setStats] = useState({ total: 0, new: 0, inProgress: 0, resolved: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Lock body scroll when inquiry modal is open
  useBodyScrollLock(modalOpen && !!selectedInquiry);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [inquiryStatus, setInquiryStatus] = useState('New');

  const isMountedRef = useRef(true);
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchInquiries = useCallback(async () => {
    try {
      const res = await api.get('/inquiries', {
        params: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search.trim() || undefined,
          limit: 50,
        },
      });

      if (isMountedRef.current && res.data?.success) {
        setInquiries(res.data.inquiries || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        showToastRef.current(err.message || 'Failed to load inquiries', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [statusFilter, search]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    fetchInquiries();
  }, [fetchInquiries]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInquiries();
  };

  const handleOpenDetailModal = (inquiry) => {
    setSelectedInquiry(inquiry);
    setInquiryStatus(inquiry.status);
    setAdminNotes(inquiry.notes || '');
    setModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!selectedInquiry) return;
    setUpdatingStatus(true);
    try {
      const res = await api.put(`/inquiries/${selectedInquiry._id}`, {
        status: inquiryStatus,
        notes: adminNotes,
      });

      if (res.data?.success) {
        showToast('Inquiry updated successfully');
        setModalOpen(false);
        setSelectedInquiry(null);
        fetchInquiries();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update inquiry', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleQuickStatusChange = async (inquiryId, newStat) => {
    try {
      const res = await api.put(`/inquiries/${inquiryId}`, { status: newStat });
      if (res.data?.success) {
        showToast(`Status updated to "${newStat}"`);
        // Optimistic local update — no need for a redundant full refetch
        setInquiries((prev) =>
          prev.map((item) => (item._id === inquiryId ? { ...item, status: newStat } : item))
        );
      }
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete inquiry from "${name}"?`)) return;

    try {
      const res = await api.delete(`/inquiries/${id}`);
      if (res.data?.success) {
        showToast('Inquiry deleted successfully');
        // Optimistic local update — no need for a redundant full refetch
        setInquiries((prev) => prev.filter((i) => i._id !== id));
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete inquiry', 'error');
    }
  };

  return (
    <div>
      {/* Title & Stats Overview */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.9rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Customer Inquiries
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '3px' }}>
              Messages, questions, and sizing inquiries submitted via the Contact page
            </p>
          </div>
          <button
            onClick={fetchInquiries}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '18px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Total Inquiries
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
            {stats.total || 0}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '18px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #BFDBFE',
            borderLeft: '4px solid #2563EB',
          }}
        >
          <span style={{ fontSize: '0.82rem', color: '#1E40AF', fontWeight: 600 }}>
            New / Unread
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1D4ED8', marginTop: '4px' }}>
            {stats.new || 0}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '18px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            In Progress
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#7E22CE', marginTop: '4px' }}>
            {stats.inProgress || 0}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '18px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Resolved
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#15803D', marginTop: '4px' }}>
            {stats.resolved || 0}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Inquiries' },
              { id: 'New', label: 'New' },
              { id: 'In Progress', label: 'In Progress' },
              { id: 'Resolved', label: 'Resolved' },
              { id: 'Archived', label: 'Archived' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: statusFilter === tab.id ? 'var(--accent-color)' : 'var(--border-color)',
                  backgroundColor: statusFilter === tab.id ? 'var(--accent-light)' : 'transparent',
                  color: statusFilter === tab.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                  fontSize: '0.84rem',
                  fontWeight: statusFilter === tab.id ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', minWidth: '300px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Search inquiries by name, email, subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '34px', fontSize: '0.85rem', width: '100%' }}
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
      </div>

      {/* Inquiries Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading inquiries...
          </div>
        ) : inquiries.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <MessageSquare size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              No inquiries found
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '360px', margin: '0 auto' }}>
              {search || statusFilter !== 'all'
                ? 'No inquiries match the current filter or search criteria.'
                : 'Customer inquiries submitted via the Contact Us page will appear here.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '14px 18px' }}>Customer</th>
                  <th style={{ padding: '14px 18px' }}>Subject & Message</th>
                  <th style={{ padding: '14px 18px' }}>Date</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inq) => (
                  <tr
                    key={inq._id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color 0.15s ease',
                      backgroundColor: inq.status === 'New' ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                    }}
                  >
                    {/* Customer */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'top', minWidth: '180px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inq.name}</div>
                      <a
                        href={`mailto:${inq.email}`}
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '2px',
                          textDecoration: 'none',
                        }}
                      >
                        <Mail size={12} /> {inq.email}
                      </a>
                      {inq.phone && (
                        <a
                          href={`tel:${inq.phone}`}
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '2px',
                            textDecoration: 'none',
                          }}
                        >
                          <Phone size={12} /> {inq.phone}
                        </a>
                      )}
                    </td>

                    {/* Subject & Preview */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'top', maxWidth: '380px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {inq.subject}
                      </div>
                      <p
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.84rem',
                          margin: 0,
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {inq.message}
                      </p>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'top', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                      {new Date(inq.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                        {new Date(inq.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <select
                        value={inq.status}
                        onChange={(e) => handleQuickStatusChange(inq._id, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="New">New</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => handleOpenDetailModal(inq)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          onClick={() => handleDelete(inq._id, inq.name)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 10px', color: '#DC2626' }}
                          title="Delete inquiry"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inquiry Detail & Reply Modal */}
      {modalOpen && selectedInquiry && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal, 50000)',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border-color)',
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
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Inquiry Details • {new Date(selectedInquiry.createdAt).toLocaleString('en-IN')}
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedInquiry.subject}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close inquiry modal"
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Customer Info Card */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                    {selectedInquiry.name}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                    {selectedInquiry.email} {selectedInquiry.phone ? ` • ${selectedInquiry.phone}` : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent(`Re: ${selectedInquiry.subject} [VASHTRAM Support]`)}`}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                  >
                    <Mail size={14} /> Reply via Email
                  </a>
                  {selectedInquiry.phone && (
                    <a
                      href={`https://wa.me/${selectedInquiry.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${selectedInquiry.name}, regarding your inquiry with VASHTRAM: "${selectedInquiry.subject}"`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {/* Message Content */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Customer Message
                </label>
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {selectedInquiry.message}
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Inquiry Status
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['New', 'In Progress', 'Resolved', 'Archived'].map((stat) => (
                    <button
                      key={stat}
                      type="button"
                      onClick={() => setInquiryStatus(stat)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: inquiryStatus === stat ? 'var(--accent-color)' : 'var(--border-color)',
                        backgroundColor: inquiryStatus === stat ? 'var(--accent-light)' : 'transparent',
                        color: inquiryStatus === stat ? 'var(--accent-color)' : 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        fontWeight: inquiryStatus === stat ? 600 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {stat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin Internal Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Internal Admin Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Add private team notes (e.g. 'Answered via WhatsApp on King mattress protector sizing')"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />
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
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary btn-md"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={updatingStatus}
                className="btn btn-primary btn-md"
              >
                {updatingStatus ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInquiries;
