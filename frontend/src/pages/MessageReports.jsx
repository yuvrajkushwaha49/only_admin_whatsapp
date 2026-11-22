import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import api from '../services/api';
import '../styles/dashboard.css';
import '../styles/analytics.css';

export default function MessageReports() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [timeRange, setTimeRange] = useState('Last 7 Days');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  const [messageData, setMessageData] = useState({
    hourlyActivity: [],
    inboundCount: 0,
    outboundCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    messages: []
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchMessageReports = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setLoading(true);

      const res = await api.get('/analytics/messages', {
        params: { timeRange }
      });

      if (res.data?.success && res.data.data) {
        setMessageData(res.data.data);
      }

      if (isManual) {
        showToast('success', 'Message reports refreshed from database.');
      }
    } catch (err) {
      console.error('[MessageReports] Error fetching message analytics:', err);
      showToast('danger', 'Failed to load message reports from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMessageReports();
  }, [timeRange]);

  const totalExchanged = (messageData.outboundCount || 0) + (messageData.inboundCount || 0);
  const deliveryRate = messageData.outboundCount > 0
    ? Number(((messageData.deliveredCount / messageData.outboundCount) * 100).toFixed(1))
    : 0;
  const readRate = messageData.deliveredCount > 0
    ? Number(((messageData.readCount / messageData.deliveredCount) * 100).toFixed(1))
    : 0;

  // Filter messages list
  const filteredMessages = (messageData.messages || []).filter(msg => {
    if (directionFilter !== 'all' && (msg.direction || '').toUpperCase() !== directionFilter.toUpperCase()) {
      return false;
    }
    if (statusFilter !== 'all' && (msg.message_status || '').toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const phone = (msg.customer_phone || '').toLowerCase();
      const body = (msg.message_body || '').toLowerCase();
      if (!phone.includes(q) && !body.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / pageSize));
  const paginatedMessages = filteredMessages.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Pie chart data
  const pieData = [
    { name: 'Delivered', value: messageData.deliveredCount || 0, color: '#10b981' },
    { name: 'Read Receipts', value: messageData.readCount || 0, color: '#06b6d4' },
    { name: 'Inbound Inquiries', value: messageData.inboundCount || 0, color: '#6366f1' },
    { name: 'Failed', value: messageData.failedCount || 0, color: '#ef4444' }
  ].filter(item => item.value > 0);

  // Hourly Bar Chart data (take 24h)
  const barChartData = (messageData.hourlyActivity || []).map(h => ({
    hour: h.hour,
    Outbound: h.outbound || 0,
    Inbound: h.inbound || 0
  }));

  const handleExportCsv = () => {
    try {
      setExporting(true);
      let csv = 'ID,Phone,Direction,Type,Status,Body,Created At\n';
      filteredMessages.forEach(m => {
        const bodyClean = (m.message_body || '').replace(/"/g, '""').replace(/(\r\n|\n|\r)/gm, ' ');
        csv += `"${m.id}","${m.customer_phone || ''}","${m.direction || ''}","${m.message_type || ''}","${m.message_status || ''}","${bodyClean}","${m.created_at || ''}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `message_reports_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      showToast('success', `Exported ${filteredMessages.length} message records successfully.`);
    } catch (err) {
      console.error('[MessageReports] Export failed:', err);
      showToast('danger', 'Failed to export message reports.');
    } finally {
      setExporting(false);
    }
  };

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
              <i className="bi bi-chat-square-dots"></i>
            </div>
            <div>
              <h1 className="cg-hero-title">Message Reports</h1>
              <p className="cg-hero-desc">
                Real-time WhatsApp transmission logs, 24-hour peak activity telemetry, and delivery status breakdown.
              </p>
            </div>
          </div>

          <div className="cg-hero-actions">
            <select
              className="form-select form-select-sm"
              style={{
                width: 'auto',
                minWidth: '135px',
                borderRadius: '8px',
                borderColor: '#e2e8f0',
                fontWeight: 500,
                color: '#334155'
              }}
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="Today">Today</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Month">This Month</option>
            </select>

            <button
              type="button"
              onClick={() => fetchMessageReports(true)}
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
              disabled={exporting || filteredMessages.length === 0}
              className="cg-hero-btn-create"
              style={{ background: '#00a884', borderColor: '#00a884' }}
              title="Export Message Reports as CSV"
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
              <i className="bi bi-chat-dots-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Messages Exchanged</div>
              <div className="cg-stat-value">{totalExchanged.toLocaleString()}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-green">
              <i className="bi bi-patch-check-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Delivery Success Rate</div>
              <div className="cg-stat-value text-green">
                {deliveryRate}% <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>({(messageData.deliveredCount || 0).toLocaleString()} delivered)</span>
              </div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
              <i className="bi bi-chat-left-quote-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Inbound Direct Replies</div>
              <div className="cg-stat-value" style={{ color: '#0284c7' }}>
                {(messageData.inboundCount || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>({readRate}% read rate)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Graph & Pie Chart Row */}
        <div className="row g-4 mb-4">
          <div className="col-12 col-lg-8">
            <div className="cg-card h-100 mb-0">
              <div className="cg-card-header pb-2">
                <h3 className="cg-card-title d-flex align-items-center gap-2" style={{ fontSize: '1.05rem' }}>
                  <i className="bi bi-bar-chart-fill text-primary"></i>
                  <span>24-Hour Transmission Telemetry</span>
                </h3>
                <div className="d-flex align-items-center gap-3 small text-secondary">
                  <span className="d-flex align-items-center gap-1">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }}></span>
                    <span>Outbound</span>
                  </span>
                  <span className="d-flex align-items-center gap-1">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#06b6d4', display: 'inline-block' }}></span>
                    <span>Inbound</span>
                  </span>
                </div>
              </div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} interval={2} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="Outbound" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Inbound" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="cg-card h-100 mb-0">
              <div className="cg-card-header pb-2">
                <h3 className="cg-card-title d-flex align-items-center gap-2" style={{ fontSize: '1.05rem' }}>
                  <i className="bi bi-pie-chart-fill text-primary"></i>
                  <span>Message Status Breakdown</span>
                </h3>
              </div>
              {pieData.length === 0 ? (
                <div className="text-center py-4 text-muted my-auto">
                  <i className="bi bi-pie-chart fs-1 text-secondary d-block mb-1"></i>
                  <div className="small">No message telemetry records for this period.</div>
                </div>
              ) : (
                <>
                  <div style={{ width: '100%', height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="d-flex justify-content-center flex-wrap gap-2 small text-secondary mt-1">
                    {pieData.map((item) => (
                      <span key={item.name} className="d-flex align-items-center gap-1">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }}></span>
                        <span>{item.name}: <strong>{item.value.toLocaleString()}</strong></span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Card Container (Exact match with Organize Your Contacts) */}
        <div className="cg-card">
          <div className="cg-card-header">
            <h2 className="cg-card-title">
              Message Transmission Logs ({filteredMessages.length})
            </h2>

            <div className="cg-search-box">
              <i className="bi bi-search cg-search-icon"></i>
              <input
                type="text"
                className="form-control cg-search-input"
                placeholder="Search phone or message content..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="btn btn-sm btn-link position-absolute end-0 top-50 translate-middle-y text-muted pe-3 text-decoration-none"
                  onClick={() => setSearchTerm('')}
                >
                  <i className="bi bi-x-circle-fill"></i>
                </button>
              )}
            </div>
          </div>

          {/* Quick Filters Row */}
          <div className="px-4 py-2 bg-light border-bottom d-flex flex-wrap align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted fw-medium">Direction:</span>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto', minWidth: '120px' }}
                value={directionFilter}
                onChange={(e) => {
                  setDirectionFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Directions</option>
                <option value="OUTBOUND">Outbound Sent</option>
                <option value="INBOUND">Inbound Received</option>
              </select>
            </div>

            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted fw-medium">Status:</span>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto', minWidth: '120px' }}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="ms-auto small text-muted">
              Showing {paginatedMessages.length} of {filteredMessages.length} records
            </div>
          </div>

          {/* Table or Empty State */}
          {loading && !refreshing ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading message logs...</span>
              </div>
              <div className="text-muted mt-2 small">Loading live message records from MySQL...</div>
            </div>
          ) : paginatedMessages.length === 0 ? (
            <div className="cg-empty-state">
              <div className="cg-empty-icon">
                <i className="bi bi-chat-left-dots"></i>
              </div>
              <h3 className="cg-empty-title">No Message Records Found</h3>
              <p className="cg-empty-desc">
                {searchTerm || directionFilter !== 'all' || statusFilter !== 'all'
                  ? 'No message records matched your query. Try clearing the filters.'
                  : 'Start sending WhatsApp broadcasts or direct chat messages to inspect live message delivery logs.'}
              </p>
              {(searchTerm || directionFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm mt-2"
                  onClick={() => {
                    setSearchTerm('');
                    setDirectionFilter('all');
                    setStatusFilter('all');
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table cg-table mb-0">
                <thead>
                  <tr>
                    <th style={{ width: '70px' }}>ID</th>
                    <th style={{ minWidth: '150px' }}>Phone Number</th>
                    <th style={{ width: '130px' }}>Direction</th>
                    <th style={{ width: '120px' }}>Type</th>
                    <th style={{ minWidth: '240px' }}>Message Preview</th>
                    <th style={{ width: '130px' }}>Status</th>
                    <th style={{ width: '160px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMessages.map((msg) => {
                    const isOutbound = (msg.direction || '').toUpperCase() === 'OUTBOUND';
                    const status = (msg.message_status || 'sent').toLowerCase();

                    return (
                      <tr key={msg.id}>
                        <td>
                          <span className="text-muted font-monospace small">#{msg.id}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-telephone text-secondary"></i>
                            <span className="fw-semibold text-dark">{msg.customer_phone || '—'}</span>
                          </div>
                        </td>
                        <td>
                          {isOutbound ? (
                            <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                              <i className="bi bi-arrow-up-right me-1"></i>Outbound
                            </span>
                          ) : (
                            <span className="badge rounded-pill bg-info-subtle text-info border border-info-subtle px-2 py-1">
                              <i className="bi bi-arrow-down-left me-1"></i>Inbound
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-light text-secondary border text-uppercase" style={{ fontSize: '0.72rem' }}>
                            {msg.message_type || 'text'}
                          </span>
                        </td>
                        <td>
                          <div
                            className="text-truncate text-secondary"
                            style={{ maxWidth: '320px', fontSize: '0.88rem' }}
                            title={msg.message_body || ''}
                          >
                            {msg.message_body || <span className="fst-italic text-muted">[Template / Media Payload]</span>}
                          </div>
                        </td>
                        <td>
                          {status === 'read' ? (
                            <span className="badge rounded-pill bg-info-subtle text-info px-2 py-1">
                              <i className="bi bi-check2-all me-1"></i>Read
                            </span>
                          ) : status === 'delivered' ? (
                            <span className="badge rounded-pill bg-success-subtle text-success px-2 py-1">
                              <i className="bi bi-check-circle-fill me-1"></i>Delivered
                            </span>
                          ) : status === 'failed' ? (
                            <span className="badge rounded-pill bg-danger-subtle text-danger px-2 py-1">
                              <i className="bi bi-x-circle-fill me-1"></i>Failed
                            </span>
                          ) : (
                            <span className="badge rounded-pill bg-secondary-subtle text-secondary px-2 py-1">
                              <i className="bi bi-check me-1"></i>Sent
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="small text-muted">
                            {msg.created_at ? new Date(msg.created_at).toLocaleString() : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="d-flex align-items-center justify-content-between p-3 border-top">
              <span className="small text-muted">
                Page {currentPage} of {totalPages}
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  <i className="bi bi-chevron-left me-1"></i>Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Next<i className="bi bi-chevron-right ms-1"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
