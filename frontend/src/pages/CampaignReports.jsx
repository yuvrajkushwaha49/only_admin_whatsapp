import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { encodeHashId } from '../utils/hashId';
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

const PIE_COLORS = ['#10b981', '#06b6d4', '#ef4444', '#f59e0b'];

export default function CampaignReports() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchCampaignReports = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setLoading(true);

      const res = await api.get('/campaigns');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setCampaigns(res.data.data);
      }

      if (isManual) {
        showToast('success', 'Campaign reports refreshed from database.');
      }
    } catch (err) {
      console.error('[CampaignReports] Error fetching reports:', err);
      showToast('danger', 'Failed to fetch campaign reports from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCampaignReports();
  }, []);

  const handleExportAll = async () => {
    try {
      setExporting(true);
      const res = await api.get('/analytics/export', {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `campaign_reports_all_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      showToast('success', 'All campaign reports exported successfully.');
    } catch (err) {
      console.error('[CampaignReports] Export failed:', err);
      showToast('danger', 'Failed to export campaign reports.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSingle = async (campaignId, campaignName) => {
    try {
      setDownloadingId(campaignId);
      const res = await api.get(`/campaigns/${campaignId}/export`, {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const dateStr = new Date().toISOString().slice(0, 10);
      const cleanName = (campaignName || `campaign_${campaignId}`).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      link.setAttribute('download', `${cleanName}_report_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      showToast('success', `Exported report for "${campaignName}".`);
    } catch (err) {
      console.error('[CampaignReports] Single export failed:', err);
      showToast('danger', 'Failed to export this campaign report.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Filter campaigns by status & search term
  const filteredCampaigns = campaigns.filter(c => {
    const matchesStatus = statusFilter === 'all' || (c.status || '').toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch = !searchTerm.trim() ||
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.template_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.account_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate live aggregate totals from real DB records
  const totalSent = campaigns.reduce((acc, c) => acc + Number(c.sent_count || 0), 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + Number(c.delivered_count || 0), 0);
  const totalRead = campaigns.reduce((acc, c) => acc + Number(c.read_count || 0), 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + Number(c.failed_count || 0), 0);
  const avgDeliveryRate = totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(1)) : 0;
  const avgReadRate = totalDelivered > 0 ? Number(((totalRead / totalDelivered) * 100).toFixed(1)) : 0;

  const pieData = [
    { name: 'Delivered', value: totalDelivered, color: '#10b981' },
    { name: 'Read', value: totalRead, color: '#06b6d4' },
    { name: 'Failed', value: totalFailed, color: '#ef4444' }
  ].filter(p => p.value > 0);

  const barChartData = campaigns.slice(0, 7).map(c => ({
    name: (c.name || `Campaign #${c.id}`).length > 12 ? (c.name || `Campaign #${c.id}`).slice(0, 12) + '...' : (c.name || `Campaign #${c.id}`),
    sent: Number(c.sent_count || 0),
    delivered: Number(c.delivered_count || 0)
  }));

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
              <i className="bi bi-send-check-fill"></i>
            </div>
            <div>
              <h1 className="cg-hero-title">Campaign Reports</h1>
              <p className="cg-hero-subtitle">
                Detailed broadcast analytics, recipient delivery breakdowns, read conversions, and failure tracking.
              </p>
            </div>
          </div>

          <div className="cg-hero-actions">
            <select
              className="cg-hero-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="running">Running</option>
              <option value="scheduled">Scheduled</option>
              <option value="paused">Paused</option>
              <option value="failed">Failed</option>
            </select>

            <button
              type="button"
              onClick={() => fetchCampaignReports(true)}
              disabled={refreshing}
              className="cg-hero-btn-refresh"
              title="Refresh reports list"
            >
              <i className={`bi bi-arrow-clockwise ${refreshing ? 'spin' : ''}`}></i>
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportAll}
              disabled={exporting || campaigns.length === 0}
              className="cg-hero-btn-create"
              title="Export All Reports as CSV"
            >
              {exporting ? (
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
              ) : (
                <i className="bi bi-download"></i>
              )}
              <span>Export Reports</span>
            </button>
          </div>
        </div>

        {/* 3 Stats Cards Row (Exact match with Organize Your Contacts) */}
        <div className="cg-stats-grid">
          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-blue">
              <i className="bi bi-send-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Total Broadcasts</div>
              <div className="cg-stat-value">{campaigns.length}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-green">
              <i className="bi bi-patch-check-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Messages Delivered</div>
              <div className="cg-stat-value text-green">
                {totalDelivered.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>({avgDeliveryRate}%)</span>
              </div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
              <i className="bi bi-eye-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Messages Read</div>
              <div className="cg-stat-value" style={{ color: '#0284c7' }}>
                {totalRead.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>({avgReadRate}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Graph & Pie Chart Row */}
        <div className="row g-4 cg-chart-row">
          <div className="col-12 col-lg-8">
            <div className="cg-chart-card">
              <div className="cg-chart-card-header">
                <h3 className="cg-chart-card-title">
                  <i className="bi bi-bar-chart-fill"></i>
                  <span>Campaign Delivery Performance</span>
                </h3>
                <div className="cg-chart-legend">
                  <span className="cg-chart-legend-item">
                    <span className="cg-chart-legend-dot" style={{ background: '#7c3aed' }}></span>
                    <span>Sent</span>
                  </span>
                  <span className="cg-chart-legend-item">
                    <span className="cg-chart-legend-dot" style={{ background: '#10b981' }}></span>
                    <span>Delivered</span>
                  </span>
                </div>
              </div>
              {barChartData.length === 0 ? (
                <div className="text-center py-5 text-muted my-auto">
                  <i className="bi bi-bar-chart fs-1 text-secondary d-block mb-1"></i>
                  <div className="small">No campaign transmission data yet.</div>
                </div>
              ) : (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <Bar dataKey="sent" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="cg-chart-card">
              <div className="cg-chart-card-header">
                <h3 className="cg-chart-card-title">
                  <i className="bi bi-pie-chart-fill"></i>
                  <span>Delivery Status Breakdown</span>
                </h3>
              </div>
              {pieData.length === 0 ? (
                <div className="text-center py-5 text-muted my-auto">
                  <i className="bi bi-pie-chart fs-1 text-secondary d-block mb-1"></i>
                  <div className="small">No delivery records to display.</div>
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
                            <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="d-flex justify-content-center flex-wrap gap-2 small text-secondary mt-1">
                    {pieData.map((item, idx) => (
                      <span key={item.name} className="d-flex align-items-center gap-1">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color || PIE_COLORS[idx % PIE_COLORS.length] }}></span>
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
              All Campaign Reports ({filteredCampaigns.length})
            </h2>

            <div className="cg-search-box">
              <i className="bi bi-search cg-search-icon"></i>
              <input
                type="text"
                className="form-control cg-search-input"
                placeholder="Search campaigns by name, template..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="cg-card-body pt-2">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <div className="text-secondary small mt-2">Loading campaign reports from database...</div>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="cg-empty-state-box">
                <div className="cg-empty-icon-wrap">
                  <i className="bi bi-send"></i>
                </div>
                <h5 className="cg-empty-title">No Campaign Reports Found</h5>
                <p className="cg-empty-desc">
                  {searchTerm || statusFilter !== 'all'
                    ? 'No campaigns matched your search or status filter.'
                    : 'Launch a WhatsApp broadcast to view live delivery and engagement reports.'}
                </p>
                <Link to="/campaigns/new" className="cg-hero-btn-create text-decoration-none">
                  <i className="bi bi-plus-lg me-1"></i> Create New Campaign
                </Link>
              </div>
            ) : (
              <div className="cg-report-table-container">
                <table className="cg-report-table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th>Recipients</th>
                      <th>Sent</th>
                      <th>Delivered</th>
                      <th>Read</th>
                      <th>Failed</th>
                      <th>Delivery Rate</th>
                      <th>Date</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((c) => {
                      const sent = Number(c.sent_count || 0);
                      const del = Number(c.delivered_count || 0);
                      const read = Number(c.read_count || 0);
                      const failed = Number(c.failed_count || 0);
                      const delRate = sent > 0 ? Number(((del / sent) * 100).toFixed(1)) : 0;
                      const rRate = del > 0 ? Number(((read / del) * 100).toFixed(1)) : 0;

                      const formattedDate = c.created_at
                        ? new Date(c.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        : '—';

                      return (
                        <tr key={c.id}>
                          <td>
                            <div className="fw-bold text-dark">{c.name}</div>
                            <div className="text-muted small">
                              {c.template_name && (
                                <span className="me-2">
                                  <i className="bi bi-file-text me-1 text-primary"></i>
                                  {c.template_name}
                                </span>
                              )}
                              {c.account_name && (
                                <span>
                                  <i className="bi bi-whatsapp me-1 text-success"></i>
                                  {c.account_name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`analytics-badge-status ${
                                c.status === 'completed'
                                  ? 'completed'
                                  : c.status === 'failed'
                                  ? 'failed'
                                  : 'running'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="fw-semibold">{c.total_recipients || sent}</td>
                          <td>{sent}</td>
                          <td className="text-success fw-semibold">{del}</td>
                          <td className="text-info fw-semibold">{read}</td>
                          <td className={failed > 0 ? 'text-danger fw-semibold' : 'text-muted'}>
                            {failed}
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-bold">{delRate}%</span>
                              <div
                                style={{
                                  width: 45,
                                  height: 6,
                                  background: '#f1f5f9',
                                  borderRadius: 4,
                                  overflow: 'hidden'
                                }}
                              >
                                <div
                                  style={{
                                    width: `${delRate}%`,
                                    height: '100%',
                                    background: '#10b981'
                                  }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="text-muted small">{formattedDate}</td>
                          <td className="text-end">
                            <div className="d-inline-flex align-items-center gap-1">
                              <Link
                                to={`/campaigns/${c.hash_id || encodeHashId(c.id)}`}
                                className="btn btn-sm btn-outline-secondary"
                                title="View Campaign Details & Delivery Logs"
                                style={{ borderRadius: 8, padding: '0.35rem 0.65rem' }}
                              >
                                <i className="bi bi-eye"></i>
                              </Link>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                title="Download Campaign CSV Report"
                                style={{ borderRadius: 8, padding: '0.35rem 0.65rem' }}
                                disabled={downloadingId === c.id}
                                onClick={() => handleExportSingle(c.id, c.name)}
                              >
                                {downloadingId === c.id ? (
                                  <span className="spinner-border spinner-border-sm" role="status"></span>
                                ) : (
                                  <i className="bi bi-download"></i>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
