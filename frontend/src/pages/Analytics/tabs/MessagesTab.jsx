import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export default function MessagesTab({
  data,
  loading,
  filters,
  onFilterChange,
  onExport
}) {
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [statusFilter, setStatusFilter] = useState(filters.status || 'all');

  const getMetricVal = (val, fallback = 0) => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') {
      return val.value !== undefined ? val.value : fallback;
    }
    return val;
  };

  const kpis = data?.kpis || {};
  const rateTrends = data?.rateTrends || [];
  const messages = data?.messages || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onFilterChange({ search: searchTerm, page: 1 });
  };

  const handleStatusChange = (e) => {
    const val = e.target.value;
    setStatusFilter(val);
    onFilterChange({ status: val, page: 1 });
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    onFilterChange({ page: newPage });
  };

  return (
    <div>
      {/* KPI Cards (6 cards) */}
      <div className="an-kpi-grid-4 mb-4">
        {/* Total */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-chat-dots-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Messages</div>
            <div className="cg-stat-value">{getMetricVal(kpis.total)?.toLocaleString() || 0}</div>
          </div>
        </div>

        {/* Sent */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-send-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Sent</div>
            <div className="cg-stat-value">{getMetricVal(kpis.sent)?.toLocaleString() || 0}</div>
          </div>
        </div>

        {/* Delivered */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-green">
            <i className="bi bi-check2-all"></i>
          </div>
          <div>
            <div className="cg-stat-label">Delivered</div>
            <div className="cg-stat-value text-green">{getMetricVal(kpis.delivered)?.toLocaleString() || 0}</div>
          </div>
        </div>

        {/* Read */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
            <i className="bi bi-eye-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Read</div>
            <div className="cg-stat-value" style={{ color: '#0284c7' }}>{getMetricVal(kpis.read)?.toLocaleString() || 0}</div>
          </div>
        </div>

        {/* Failed */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Failed</div>
            <div className="cg-stat-value" style={{ color: '#dc2626' }}>{getMetricVal(kpis.failed)?.toLocaleString() || 0}</div>
          </div>
        </div>

        {/* Pending */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
            <i className="bi bi-hourglass-split"></i>
          </div>
          <div>
            <div className="cg-stat-label">Pending / Sending</div>
            <div className="cg-stat-value" style={{ color: '#d97706' }}>{getMetricVal(kpis.pending)?.toLocaleString() || 0}</div>
          </div>
        </div>
      </div>

      {/* Conversion & Verification Rates Row */}
      <div className="cg-card mb-4">
        <div className="cg-card-header pb-2">
          <h3 className="cg-card-title mb-0">
            <i className="bi bi-shield-check text-primary me-2"></i>
            Verified Message Delivery & Engagement Rates
          </h3>
          <span className="text-secondary small">Meta Cloud API delivery funnel verification</span>
        </div>
        <div className="row g-4 pt-2">
          <div className="col-12 col-md-4">
            <div className="p-3 rounded-3" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-semibold text-secondary small">Delivery Rate (Delivered / Sent)</span>
                <i className="bi bi-check-circle-fill text-success fs-5"></i>
              </div>
              <div className="fs-2 fw-bold text-success mt-2">{getMetricVal(kpis.deliveryRate, 0)}%</div>
              <div className="small text-muted mt-1">Confirmed delivered to recipient phones</div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="p-3 rounded-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-semibold text-secondary small">Read Rate (Read / Delivered)</span>
                <i className="bi bi-eye-fill text-primary fs-5"></i>
              </div>
              <div className="fs-2 fw-bold text-primary mt-2">{getMetricVal(kpis.readRate, 0)}%</div>
              <div className="small text-muted mt-1">Opened and read by recipients</div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="p-3 rounded-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-semibold text-secondary small">Failure Rate (Failed / Sent)</span>
                <i className="bi bi-x-circle-fill text-danger fs-5"></i>
              </div>
              <div className="fs-2 fw-bold text-danger mt-2">{getMetricVal(kpis.failureRate, 0)}%</div>
              <div className="small text-muted mt-1">Undelivered or invalid numbers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row: Daily Volume + Rate Trends */}
      <div className="row g-4 mb-4">
        {/* Daily Volume Bar Chart */}
        <div className="col-12 col-lg-6">
          <div className="an-chart-card">
            <div className="an-chart-header">
              <div>
                <h4 className="an-chart-title">
                  <i className="bi bi-bar-chart-fill text-primary"></i>
                  Daily Message Volume
                </h4>
                <div className="an-chart-subtitle">Sent vs Delivered vs Failed volume distribution</div>
              </div>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rateTrends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickFormatter={(val) => val.slice(5)} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="sent" name="Sent" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Rate Trends Line Chart */}
        <div className="col-12 col-lg-6">
          <div className="an-chart-card">
            <div className="an-chart-header">
              <div>
                <h4 className="an-chart-title">
                  <i className="bi bi-graph-up-arrow text-primary"></i>
                  Delivery & Read Rate Trends (%)
                </h4>
                <div className="an-chart-subtitle">Daily percentage benchmarks over time</div>
              </div>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rateTrends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickFormatter={(val) => val.slice(5)} />
                  <YAxis stroke="#94a3b8" fontSize={11} unit="%" domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line type="monotone" dataKey="deliveryRate" name="Delivery Rate %" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="readRate" name="Read Rate %" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="failureRate" name="Failure Rate %" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Messages Table */}
      <div className="cg-card">
        <div className="cg-card-header">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <h3 className="cg-card-title mb-0">
              <i className="bi bi-table text-primary me-2"></i>
              Detailed Message Log
            </h3>
            <span className="badge bg-light text-secondary border px-2 py-1">
              {pagination.total.toLocaleString()} Records
            </span>
          </div>

          {/* Table Filters & Search */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <form onSubmit={handleSearchSubmit} className="cg-search-box">
              <i className="bi bi-search cg-search-icon"></i>
              <input
                type="text"
                className="form-control cg-search-input"
                placeholder="Search contact, phone, WAMID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </form>

            <select
              className="an-filter-select"
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued / Sending</option>
            </select>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-inline-flex align-items-center gap-1"
              onClick={() => onExport('messages', 'csv')}
              title="Download CSV"
            >
              <i className="bi bi-download"></i>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="table-responsive">
          <table className="table cf-table mb-0 align-middle">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Phone</th>
                <th>Direction</th>
                <th>Campaign / Source</th>
                <th>Status</th>
                <th>Delivered Time</th>
                <th>Read Time</th>
                <th>Failure Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    <span className="text-secondary small">Loading message records...</span>
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    No message records found matching your filters.
                  </td>
                </tr>
              ) : (
                messages.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="fw-bold text-dark">{m.contact_name || 'Anonymous Contact'}</div>
                      <div className="small text-muted font-monospace">{m.meta_message_id?.slice(0, 16) || `#${m.id}`}</div>
                    </td>
                    <td><code>{m.contact_phone || 'N/A'}</code></td>
                    <td>
                      <span className={`badge ${m.direction === 'OUTBOUND' ? 'bg-primary' : 'bg-info'}`}>
                        {m.direction}
                      </span>
                    </td>
                    <td>
                      <div className="text-dark small fw-semibold">{m.campaign_name || 'Direct / Inbox'}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{m.message_type || 'template'}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        m.message_status === 'delivered' ? 'bg-success' :
                        m.message_status === 'read' ? 'bg-info' :
                        m.message_status === 'failed' ? 'bg-danger' :
                        'bg-secondary'
                      }`}>
                        {m.message_status}
                      </span>
                    </td>
                    <td className="small text-muted">
                      {m.delivered_at ? new Date(m.delivered_at).toLocaleString() : '-'}
                    </td>
                    <td className="small text-muted">
                      {m.read_at ? new Date(m.read_at).toLocaleString() : '-'}
                    </td>
                    <td className="small text-danger" style={{ maxWidth: '200px' }}>
                      {m.failure_reason || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="d-flex align-items-center justify-content-between pt-3 border-top mt-3">
            <span className="small text-muted">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
            </span>
            <div className="d-flex align-items-center gap-1">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-2"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-2"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
