import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import '../styles/dashboard.css';
import '../styles/analytics.css';

export default function ContactReports() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    optedIn: 0,
    unsubscribed: 0,
    suppressed: 0
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [optInFilter, setOptInFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchContactReports = async (page = 1, isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setLoading(true);

      const params = {
        page,
        limit: 25,
        search: searchTerm.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      };

      if (optInFilter === 'opted_in') {
        params.optedIn = '1';
      } else if (optInFilter === 'opted_out') {
        params.optedIn = '0';
      }

      const res = await api.get('/contacts', { params });
      if (res.data?.success) {
        setContacts(res.data.contacts || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }

      if (isManual) {
        showToast('success', 'Contact reports refreshed from database.');
      }
    } catch (err) {
      console.error('[ContactReports] Error loading reports from DB:', err);
      showToast('danger', 'Failed to load contact reports from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchContactReports(1);
  }, [optInFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchContactReports(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = { format: 'csv' };
      if (optInFilter === 'opted_in') params.optedIn = '1';
      if (optInFilter === 'opted_out') params.optedIn = '0';
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await api.get('/contacts/export', {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `contact_reports_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      showToast('success', `Exported contact reports successfully.`);
    } catch (err) {
      console.error('[ContactReports] Export failed:', err);
      showToast('danger', 'Failed to export contact reports.');
    } finally {
      setExporting(false);
    }
  };

  const optInRate = stats.total > 0 ? Number(((stats.optedIn / stats.total) * 100).toFixed(1)) : 0;
  const reachableCount = Math.max(0, stats.optedIn - (stats.suppressed - stats.unsubscribed));
  const reachableRate = stats.total > 0 ? Number(((reachableCount / stats.total) * 100).toFixed(1)) : 0;

  return (
    <div className="contact-groups-page pb-5">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`alert alert-${toastMsg.type} alert-dismissible fade show shadow-sm position-fixed top-0 end-0 m-3 z-3`}
          role="alert"
          style={{ maxWidth: '420px', zIndex: 1080 }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${toastMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}`}></i>
            <span>{toastMsg.text}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setToastMsg(null)}></button>
        </div>
      )}

      <div className="cg-page-container">
        {/* Top Hero Banner (Exact match with Organize Your Contacts) */}
        <div className="cg-hero-banner">
          <div className="cg-hero-left">
            <div className="cg-hero-icon">
              <i className="bi bi-person-lines-fill"></i>
            </div>
            <div>
              <h1 className="cg-hero-title">Contact Reports</h1>
              <p className="cg-hero-subtitle">
                Audience opt-in analytics, WhatsApp reachability, and subscriber database reports.
              </p>
            </div>
          </div>

          <div className="cg-hero-actions">
            <select
              className="form-select form-select-sm"
              value={optInFilter}
              onChange={(e) => setOptInFilter(e.target.value)}
              style={{
                borderRadius: '10px',
                fontWeight: 600,
                border: '1px solid #E5EAF2',
                padding: '0.6rem 1.15rem',
                minWidth: '150px',
                color: '#172033',
                background: '#ffffff'
              }}
            >
              <option value="all">All Consent</option>
              <option value="opted_in">WhatsApp Opted-In</option>
              <option value="opted_out">Opted-Out / Suppressed</option>
            </select>

            <button
              type="button"
              onClick={() => fetchContactReports(pagination.page, true)}
              disabled={refreshing}
              className="cg-hero-btn-refresh"
              title="Refresh reports from database"
            >
              <i className={`bi bi-arrow-clockwise ${refreshing ? 'spin' : ''}`}></i>
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || stats.total === 0}
              className="cg-hero-btn-create"
              style={{ background: '#00a884', borderColor: '#00a884' }}
              title="Export Contacts Report as CSV"
            >
              {exporting ? (
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
              ) : (
                <i className="bi bi-download"></i>
              )}
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* 3 Stats Cards Row (Exact match with Organize Your Contacts) */}
        <div className="cg-stats-grid">
          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-blue">
              <i className="bi bi-people-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Total Audience</div>
              <div className="cg-stat-value">{stats.total.toLocaleString()}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-green">
              <i className="bi bi-patch-check-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">WhatsApp Opted-In</div>
              <div className="cg-stat-value text-green">
                {stats.optedIn.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>({optInRate}%)</span>
              </div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
              <i className="bi bi-send-check-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Broadcast Reachable</div>
              <div className="cg-stat-value" style={{ color: '#0284c7' }}>
                {reachableCount.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>({reachableRate}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card Container (Exact match with Organize Your Contacts) */}
        <div className="cg-card">
          <div className="cg-card-header">
            <h2 className="cg-card-title">
              All Contact Records ({pagination.total})
            </h2>

            <div className="cg-search-box">
              <i className="bi bi-search cg-search-icon"></i>
              <input
                type="text"
                className="form-control cg-search-input"
                placeholder="Search by name, phone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="cg-card-body pt-2">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <div className="text-secondary small mt-2">Loading contact reports from database...</div>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-person-x fs-1 text-secondary d-block mb-2"></i>
                <h5 className="fw-bold text-dark">No Contact Records Found</h5>
                <p className="small text-secondary mb-3">
                  {searchTerm || optInFilter !== 'all'
                    ? 'No contacts matched your search or consent filter.'
                    : 'Add contacts or import a CSV file to generate subscriber audience reports.'}
                </p>
                <Link to="/imports" className="cg-hero-btn-create text-decoration-none">
                  <i className="bi bi-plus-lg me-1"></i> Import Contacts CSV
                </Link>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table analytics-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Contact Name & Phone</th>
                        <th>WhatsApp Consent</th>
                        <th>Status</th>
                        <th>Tags</th>
                        <th>Created Date</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c) => {
                        const isOptedIn = Boolean(c.is_opted_in === 1 || c.is_opted_in === true);
                        const initials = (c.name || 'C')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2);

                        const formattedDate = c.created_at
                          ? new Date(c.created_at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '—';

                        const tagsList = Array.isArray(c.tags) ? c.tags : [];

                        return (
                          <tr key={c.id}>
                            <td>
                              <div className="d-flex align-items-center gap-3">
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: '50%',
                                    background: '#f5f0ff',
                                    color: '#7c3aed',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  {initials}
                                </div>
                                <div>
                                  <div className="fw-bold text-dark">{c.name || 'Unnamed Contact'}</div>
                                  <div className="text-muted small d-flex align-items-center gap-2">
                                    <span>
                                      <i className="bi bi-telephone me-1 text-primary"></i>
                                      {c.phone}
                                    </span>
                                    {c.email && (
                                      <span>
                                        <i className="bi bi-envelope me-1"></i>
                                        {c.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              {isOptedIn ? (
                                <span className="analytics-badge-status completed">
                                  <i className="bi bi-check-circle-fill"></i>
                                  <span>Opted In</span>
                                </span>
                              ) : (
                                <span className="analytics-badge-status failed">
                                  <i className="bi bi-x-circle-fill"></i>
                                  <span>Opted Out</span>
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className="badge bg-light text-dark border px-2 py-1"
                                style={{ fontSize: '0.78rem' }}
                              >
                                {c.status || 'Active'}
                              </span>
                            </td>
                            <td>
                              {tagsList.length === 0 ? (
                                <span className="text-muted small">—</span>
                              ) : (
                                <div className="d-flex flex-wrap gap-1">
                                  {tagsList.slice(0, 3).map((t, idx) => (
                                    <span
                                      key={t.id || idx}
                                      className="badge px-2 py-1"
                                      style={{
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.74rem'
                                      }}
                                    >
                                      {t.name}
                                    </span>
                                  ))}
                                  {tagsList.length > 3 && (
                                    <span className="badge bg-light text-secondary border px-1" style={{ fontSize: '0.7rem' }}>
                                      +{tagsList.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="text-muted small">{formattedDate}</td>
                            <td className="text-end">
                              <Link
                                to={`/contacts/${c.id}`}
                                className="btn btn-sm btn-outline-secondary"
                                title="View Contact Details"
                                style={{ borderRadius: 8, padding: '0.35rem 0.65rem' }}
                              >
                                <i className="bi bi-eye"></i>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pt-3 border-top mt-3">
                    <div className="small text-muted">
                      Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total contacts)
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={pagination.page <= 1}
                        onClick={() => fetchContactReports(pagination.page - 1)}
                        style={{ borderRadius: 8 }}
                      >
                        <i className="bi bi-chevron-left me-1"></i> Previous
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => fetchContactReports(pagination.page + 1)}
                        style={{ borderRadius: 8 }}
                      >
                        Next <i className="bi bi-chevron-right ms-1"></i>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
