import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import '../styles/pixelDashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('All Time');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch real data from backend MySQL API
  const fetchDashboardData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await api.get('/analytics/dashboard', {
        params: { timeRange }
      });
      if (res.data?.success && res.data?.data) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data from backend:', err);
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 600);
      }
    }
  }, [timeRange]);

  // Initial load and timeRange change
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh interval (every 30 seconds when toggle is active)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  // Format currency or large numbers
  const formatNum = (val) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n.toLocaleString();
  };

  // Real data parsed directly from database
  const primaryAccount = stats?.primaryAccount || (stats?.accounts && stats.accounts[0]) || null;

  const kpi = stats?.kpis || stats?.kpi || {};
  const totalContacts = kpi.totalContacts ?? 0;
  const totalCampaigns = kpi.totalCampaigns ?? 0;
  const messagesSentToday = stats?.messagesSentToday ?? kpi.messagesSentToday ?? 0;
  const connectedNumbers = stats?.accounts?.length ?? stats?.whatsappAccounts?.list?.length ?? (primaryAccount ? 1 : 0);
  const deliveredCount = stats?.deliverySummary?.delivered ?? kpi.deliveredMessages ?? kpi.delivered ?? 0;
  const failedCount = stats?.deliverySummary?.failed ?? kpi.failedMessages ?? 0;

  const delivery = stats?.deliverySummary || {
    deliveryRate: 0,
    sent: 0,
    sentPct: 100,
    delivered: 0,
    deliveredPct: 0,
    read: 0,
    readPct: 0,
    failed: 0,
    failedPct: 0
  };

  // 1. Campaign Performance Data (Bar Chart) - Real database campaigns only
  const campaignPerformanceData = (stats?.campaignPerformance && stats.campaignPerformance.length > 0)
    ? stats.campaignPerformance.map(c => ({
        name: c.name,
        count: Number(c.count ?? c.sent ?? 0)
      }))
    : [];

  // 2. Message Delivery Trend Data (Multi-line Chart) - Real daily database metrics
  const deliveryTrendData = (stats?.deliveryTrend && stats.deliveryTrend.length > 0)
    ? stats.deliveryTrend.map(d => ({
        date: d.date,
        sent: Number(d.sent || 0),
        delivered: Number(d.delivered || 0),
        read: Number(d.read || 0)
      }))
    : [];

  // 3. Contact Growth Data (Area Chart) - Real contacts growth
  const contactGrowthData = (stats?.contactGrowth && stats.contactGrowth.length > 0)
    ? stats.contactGrowth.map(c => ({
        period: c.period || c.date || c.month,
        contacts: Number(c.contacts || 0)
      }))
    : [];

  // 4. Message Status Distribution Data (Pie Chart)
  const hasStatusData = stats?.statusDistribution && stats.statusDistribution.some(s => Number(s.value || 0) > 0);
  const statusDistributionData = hasStatusData
    ? stats.statusDistribution.map(s => ({
        name: s.name,
        value: Number(s.value || 0),
        color: s.color
      }))
    : [
        { name: 'Sent', value: delivery.sent || 0, color: '#6366f1' },
        { name: 'Delivered', value: delivery.delivered || 0, color: '#10b981' },
        { name: 'Read', value: delivery.read || 0, color: '#06b6d4' },
        { name: 'Failed', value: delivery.failed || 0, color: '#ef4444' }
      ];

  // 5. Recent Campaigns - Real database campaigns only
  const recentCampaignsList = stats?.recentCampaigns || [];

  return (
    <div className="dashboard-viewport">
      {/* ================= Header Bar ================= */}
      <div className="dashboard-top-bar">
        <h1 className="dashboard-title">Dashboard</h1>

        <div className="dashboard-controls">
          {/* Auto-refresh Toggle Switch */}
          <label className="auto-refresh-toggle" onClick={() => setAutoRefresh(prev => !prev)}>
            <span className={`switch-pill ${autoRefresh ? 'checked' : ''}`}></span>
            <span>Auto-refresh</span>
          </label>

          {/* Time Range Dropdown */}
          <div className="dashboard-select-wrap">
            <select
              className="dashboard-select"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="All Time">All Time</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Month">This Month</option>
            </select>
            <i className="bi bi-chevron-down dashboard-select-arrow"></i>
          </div>

          {/* Refresh Button with Spinner on Click */}
          <button
            type="button"
            className={`dashboard-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={() => fetchDashboardData(true)}
            title="Refresh dashboard data"
            aria-label="Refresh data"
          >
            <i className="bi bi-arrow-clockwise fs-5"></i>
          </button>
        </div>
      </div>

      {/* ================= Top 3-Column Hero Section ================= */}
      <div className="dashboard-hero-grid">
        {/* Col 1: Active WhatsApp Channel Card */}
        <div className="dashboard-channel-card">
          {primaryAccount ? (
            <div>
              <div className="channel-icon-circle">
                <i className="bi bi-whatsapp"></i>
              </div>
              <div className="channel-phone">{primaryAccount.phoneNumber || primaryAccount.phone || 'Connected Line'}</div>
              <div className="channel-name">{primaryAccount.displayName || primaryAccount.name || 'WhatsApp Business'}</div>
              <div>
                <span className={primaryAccount.status === 'connected' ? 'channel-badge-connected' : 'badge bg-secondary'}>
                  {primaryAccount.status || 'connected'}
                </span>
              </div>
              <div className="channel-sync-text">
                Templates synced {primaryAccount.lastTemplateSync || 'via Meta Cloud API'}
              </div>
            </div>
          ) : (
            <div>
              <div className="channel-icon-circle" style={{ background: '#f1f5f9', color: '#64748b' }}>
                <i className="bi bi-whatsapp"></i>
              </div>
              <div className="channel-phone">No Channel Connected</div>
              <div className="channel-name">WhatsApp Business</div>
              <div>
                <span className="badge bg-light text-secondary border">Not Connected</span>
              </div>
              <div className="channel-sync-text">
                Connect a phone number to start broadcasts.
              </div>
            </div>
          )}

          <Link to="/whatsapp" className="channel-manage-btn">
            <span>{primaryAccount ? 'Manage connection' : 'Connect WhatsApp'}</span>
            <i className="bi bi-arrow-right"></i>
          </Link>
        </div>

        {/* Col 2: 6 KPI Cards (2x3 Grid) */}
        <div className="kpi-container">
          <div className="kpi-grid">
            {/* Total Contacts */}
            <div className="kpi-card">
              <div className="kpi-icon-wrap kpi-icon-purple">
                <i className="bi bi-people"></i>
              </div>
              <div className="kpi-details">
                <div className="kpi-label">Total Contacts</div>
                <div className="kpi-value">{formatNum(totalContacts)}</div>
              </div>
            </div>

            {/* Total Campaigns */}
            <div className="kpi-card">
              <div className="kpi-icon-wrap kpi-icon-purple">
                <i className="bi bi-megaphone"></i>
              </div>
              <div className="kpi-details">
                <div className="kpi-label">Total Campaigns</div>
                <div className="kpi-value">{formatNum(totalCampaigns)}</div>
              </div>
            </div>

            {/* Messages Sent Today */}
            <div className="kpi-card">
              <div className="kpi-icon-wrap kpi-icon-purple">
                <i className="bi bi-send"></i>
              </div>
              <div className="kpi-details">
                <div className="kpi-label">Messages Sent Today</div>
                <div className="kpi-value">{formatNum(messagesSentToday)}</div>
              </div>
            </div>

            {/* Connected Numbers */}
            <div className="kpi-card">
              <div className="kpi-icon-wrap kpi-icon-purple">
                <i className="bi bi-whatsapp"></i>
              </div>
              <div className="kpi-details">
                <div className="kpi-label">Connected Numbers</div>
                <div className="kpi-value">{connectedNumbers}</div>
              </div>
            </div>

            {/* Delivered */}
            <div className="kpi-card">
              <div className="kpi-icon-wrap kpi-icon-purple">
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="kpi-details">
                <div className="kpi-label">Delivered</div>
                <div className="kpi-value">{formatNum(deliveredCount)}</div>
              </div>
            </div>

            {/* Failed */}
            <div className="kpi-card kpi-card-failed">
              <div className="kpi-icon-wrap kpi-icon-red">
                <i className="bi bi-x-circle"></i>
              </div>
              <div className="kpi-details">
                <div className="kpi-label">Failed</div>
                <div className="kpi-value">{formatNum(failedCount)}</div>
              </div>
            </div>
          </div>

          <div className="kpi-sync-footer">
            {primaryAccount?.lastTemplateSync ? `Last template sync ${primaryAccount.lastTemplateSync}` : 'Templates synced via Meta Cloud API'}
          </div>
        </div>

        {/* Col 3: DELIVERY Summary Card */}
        <div className="dashboard-delivery-card">
          <div>
            <div className="delivery-header">DELIVERY</div>
            <div className="delivery-rate-row">
              <div className="delivery-percentage">{delivery.deliveryRate}%</div>
              <div className="delivery-subtext">delivery rate</div>
            </div>

            <div className="delivery-breakdown">
              {/* Sent */}
              <div className="breakdown-item">
                <div className="breakdown-row">
                  <span className="breakdown-label">Sent</span>
                  <div className="breakdown-numbers">
                    <span className="breakdown-count">{formatNum(delivery.sent)}</span>
                    <span className="breakdown-pct">{delivery.sentPct || 100.0}%</span>
                  </div>
                </div>
                <div className="breakdown-bar-bg">
                  <div className="breakdown-bar-fill bar-gradient-sent" style={{ width: `${Math.min(100, delivery.sentPct || 100)}%` }}></div>
                </div>
              </div>

              {/* Delivered */}
              <div className="breakdown-item">
                <div className="breakdown-row">
                  <span className="breakdown-label">Delivered</span>
                  <div className="breakdown-numbers">
                    <span className="breakdown-count">{formatNum(delivery.delivered)}</span>
                    <span className="breakdown-pct">{delivery.deliveredPct || 0}%</span>
                  </div>
                </div>
                <div className="breakdown-bar-bg">
                  <div className="breakdown-bar-fill bar-gradient-delivered" style={{ width: `${Math.min(100, delivery.deliveredPct || 0)}%` }}></div>
                </div>
              </div>

              {/* Read */}
              <div className="breakdown-item">
                <div className="breakdown-row">
                  <span className="breakdown-label">Read</span>
                  <div className="breakdown-numbers">
                    <span className="breakdown-count">{formatNum(delivery.read)}</span>
                    <span className="breakdown-pct">{delivery.readPct || 0}%</span>
                  </div>
                </div>
                <div className="breakdown-bar-bg">
                  <div className="breakdown-bar-fill bar-gradient-read" style={{ width: `${Math.min(100, delivery.readPct || 0)}%` }}></div>
                </div>
              </div>

              {/* Failed */}
              <div className="breakdown-item">
                <div className="breakdown-row">
                  <span className="breakdown-label">Failed</span>
                  <div className="breakdown-numbers">
                    <span className="breakdown-count">{formatNum(delivery.failed)}</span>
                    <span className="breakdown-pct">{delivery.failedPct || 0}%</span>
                  </div>
                </div>
                <div className="breakdown-bar-bg">
                  <div className="breakdown-bar-fill bar-gradient-failed" style={{ width: `${Math.min(100, delivery.failedPct || 0)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <p className="delivery-footer-note">Percentages measured against messages sent</p>
        </div>
      </div>

      {/* ================= Middle Row: 2 Charts ================= */}
      <div className="dashboard-charts-grid">
        {/* Chart 1: Campaign Performance (Bar Chart) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Campaign Performance</h3>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            {campaignPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(val) => [`${val} Messages`, 'Count']}
                  />
                  <Bar dataKey="count" fill="#5c5cf2" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center py-4 text-muted">
                <i className="bi bi-bar-chart-line fs-1 text-secondary mb-2 opacity-50"></i>
                <div className="fw-semibold text-dark">No campaign data yet</div>
                <div className="small text-secondary">Launch your first broadcast campaign to track deliverability here.</div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Message Delivery Trend (Line Chart) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Message Delivery Trend</h3>
            <div className="chart-legend-row">
              <span><span className="legend-indicator" style={{ backgroundColor: '#6366f1' }}></span>Sent</span>
              <span><span className="legend-indicator" style={{ backgroundColor: '#10b981' }}></span>Delivered</span>
              <span><span className="legend-indicator" style={{ backgroundColor: '#06b6d4' }}></span>Read</span>
            </div>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            {deliveryTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deliveryTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    angle={-35}
                    textAnchor="end"
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Line type="monotone" dataKey="sent" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="read" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center py-4 text-muted">
                <i className="bi bi-graph-up fs-1 text-secondary mb-2 opacity-50"></i>
                <div className="fw-semibold text-dark">No delivery activity yet</div>
                <div className="small text-secondary">Delivery metrics will be tracked over time as messages are sent.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= Middle Row 2: 2 Charts ================= */}
      <div className="dashboard-charts-grid">
        {/* Chart 3: Contact Growth (Spline Area Chart) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Contact Growth</h3>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            {contactGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={contactGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <defs>
                    <linearGradient id="contactGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(val) => [`${val} Contacts`, 'Growth']}
                  />
                  <Area type="monotone" dataKey="contacts" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#contactGradient)" dot={{ r: 4, fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center py-4 text-muted">
                <i className="bi bi-people fs-1 text-secondary mb-2 opacity-50"></i>
                <div className="fw-semibold text-dark">No contacts added yet</div>
                <div className="small text-secondary">Add contacts or import CSV to track list growth here.</div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 4: Message Status Distribution (Donut / Pie Chart) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Message Status Distribution</h3>
          </div>
          <div style={{ width: '100%', height: 200 }}>
            {hasStatusData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#ffffff"
                  >
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(val, name) => [`${val} Messages`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center py-4 text-muted">
                <i className="bi bi-pie-chart fs-1 text-secondary mb-2 opacity-50"></i>
                <div className="fw-semibold text-dark">No message activity yet</div>
                <div className="small text-secondary">Status distribution will appear when messages are sent.</div>
              </div>
            )}
          </div>

          {hasStatusData && (
            <div className="d-flex justify-content-center align-items-center gap-3 pt-2" style={{ fontSize: '0.8rem' }}>
              {statusDistributionData.map((s, idx) => (
                <span key={idx} className="d-flex align-items-center gap-1 text-secondary">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: s.color, display: 'inline-block' }}></span>
                  <span>{s.name} ({s.value})</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= Bottom Row: Recent Campaigns ================= */}
      <div className="recent-campaigns-card">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="recent-campaigns-title m-0">Recent Campaigns</h3>
          <Link to="/campaigns" className="small text-primary text-decoration-none fw-semibold">
            View All Campaigns &rarr;
          </Link>
        </div>

        {recentCampaignsList.length > 0 ? (
          <div className="recent-campaigns-list">
            {recentCampaignsList.map((c, idx) => {
              const sent = Number(c.sent || 0);
              const del = Number(c.delivered || 0);
              const rate = sent > 0 ? Math.round((del / sent) * 100) : (del > 0 ? 100 : 0);
              const summary = c.summaryText || `${sent} sent • ${rate}% delivered`;

              return (
                <div key={c.id || idx} className="recent-campaign-row">
                  <div className="campaign-name-col">{c.name}</div>
                  <div className="campaign-status-col">
                    <span className={`campaign-badge-${c.status === 'completed' ? 'completed' : 'pending'}`}>
                      {c.status || 'completed'}
                    </span>
                  </div>
                  <div className="campaign-stats-col">{summary}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-muted">
            <i className="bi bi-megaphone fs-2 text-secondary mb-2 d-block opacity-50"></i>
            <div className="fw-semibold text-dark mb-1">No campaigns found</div>
            <div className="small text-secondary mb-3">You haven't run any WhatsApp broadcast campaigns yet.</div>
            <Link to="/campaigns/new" className="btn btn-sm btn-primary px-3">
              <i className="bi bi-plus-lg me-1"></i> Create Campaign
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
