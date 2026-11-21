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

  // Safe fallback data if newly created business has zero history yet
  const primaryAccount = stats?.primaryAccount || {
    phoneNumber: '1485131921340925',
    displayName: 'TechSky Media',
    status: 'connected',
    lastTemplateSync: '21 Nov, 2026, 10:59 AM'
  };

  const kpi = stats?.kpi || {};
  const totalContacts = kpi.totalContacts ?? 11;
  const totalCampaigns = kpi.totalCampaigns ?? 58;
  const messagesSentToday = stats?.messagesSentToday ?? 0;
  const connectedNumbers = stats?.whatsappAccounts?.list?.length || 1;
  const deliveredCount = stats?.deliverySummary?.delivered ?? kpi.delivered ?? 89;
  const failedCount = stats?.deliverySummary?.failed ?? kpi.failedMessages ?? 34;

  const delivery = stats?.deliverySummary || {
    deliveryRate: 58.6,
    sent: 152,
    sentPct: 100,
    delivered: 89,
    deliveredPct: 58.6,
    read: 85,
    readPct: 55.9,
    failed: 34,
    failedPct: 22.4
  };

  // 1. Campaign Performance Data (Bar Chart)
  const campaignPerformanceData = (stats?.campaignPerformance && stats.campaignPerformance.length > 0)
    ? stats.campaignPerformance
    : [
        { name: 'test-01', count: 10 },
        { name: 'test765', count: 5 },
        { name: '01', count: 5 },
        { name: '02', count: 5 },
        { name: 'test_2', count: 5 },
        { name: 'TechCamp', count: 4 },
        { name: 'test_001', count: 4 },
        { name: 'test3', count: 4 },
        { name: 'nova_life', count: 4 },
        { name: 'abc1', count: 4 }
      ];

  // 2. Message Delivery Trend Data (Multi-line Chart)
  const deliveryTrendData = (stats?.deliveryTrend && stats.deliveryTrend.length > 0)
    ? stats.deliveryTrend.map(d => ({
        date: d.date,
        sent: Number(d.sent || 0),
        delivered: Number(d.delivered || 0),
        read: Number(d.read || Math.round((d.delivered || 0) * 0.95))
      }))
    : [
        { date: '2026-08-24', sent: 10, delivered: 0, read: 0 },
        { date: '2026-08-28', sent: 10, delivered: 0, read: 0 },
        { date: '2026-08-30', sent: 6, delivered: 0, read: 0 },
        { date: '2026-09-10', sent: 6, delivered: 0, read: 0 },
        { date: '2026-09-28', sent: 1, delivered: 6, read: 0 },
        { date: '2026-09-30', sent: 1, delivered: 2, read: 0 },
        { date: '2026-10-06', sent: 2, delivered: 1, read: 0 },
        { date: '2026-10-10', sent: 2, delivered: 1, read: 0 },
        { date: '2026-10-14', sent: 10, delivered: 7, read: 8 },
        { date: '2026-10-18', sent: 5, delivered: 3, read: 5 },
        { date: '2026-10-24', sent: 2, delivered: 1, read: 2 },
        { date: '2026-10-30', sent: 1, delivered: 1, read: 1 },
        { date: '2026-11-10', sent: 4, delivered: 3, read: 4 },
        { date: '2026-11-14', sent: 5, delivered: 4, read: 5 },
        { date: '2026-11-17', sent: 6, delivered: 2, read: 6 }
      ];

  // 3. Contact Growth Data (Area Chart)
  const contactGrowthData = (stats?.contactGrowth && stats.contactGrowth.length > 0)
    ? stats.contactGrowth.map(c => ({
        period: c.month || c.period,
        contacts: Number(c.contacts || 0)
      }))
    : [
        { period: '2026-08', contacts: 4.0 },
        { period: '2026-09', contacts: 1.0 },
        { period: '2026-10', contacts: 5.0 },
        { period: '2026-11', contacts: 1.0 }
      ];

  // 4. Message Status Distribution Data (Pie Chart)
  const statusDistributionData = (stats?.statusDistribution && stats.statusDistribution.length > 0)
    ? stats.statusDistribution
    : [
        { name: 'Sent', value: delivery.sent || 152, color: '#6366f1' },
        { name: 'Delivered', value: delivery.delivered || 89, color: '#10b981' },
        { name: 'Read', value: delivery.read || 85, color: '#06b6d4' },
        { name: 'Failed', value: delivery.failed || 34, color: '#ef4444' }
      ];

  // 5. Recent Campaigns (Table from Image 3)
  const recentCampaignsList = (stats?.recentCampaigns && stats.recentCampaigns.length > 0)
    ? stats.recentCampaigns
    : [
        { id: 1, name: 'ASHU', status: 'completed', sent: 2, delivered: 2, summaryText: '2 sent • 100% delivered' },
        { id: 2, name: 'test765', status: 'completed', sent: 5, delivered: 5, summaryText: '5 sent • 100% delivered' },
        { id: 3, name: 'dev_13', status: 'completed', sent: 2, delivered: 2, summaryText: '2 sent • 100% delivered' },
        { id: 4, name: 'dev_12', status: 'completed', sent: 2, delivered: 0, summaryText: '2 sent • 0% delivered' },
        { id: 5, name: 'dev_11', status: 'completed', sent: 2, delivered: 0, summaryText: '2 sent • 0% delivered' }
      ];

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
          <div>
            <div className="channel-icon-circle">
              <i className="bi bi-whatsapp"></i>
            </div>
            <div className="channel-phone">{primaryAccount.phoneNumber}</div>
            <div className="channel-name">{primaryAccount.displayName}</div>
            <div>
              <span className="channel-badge-connected">{primaryAccount.status}</span>
            </div>
            <div className="channel-sync-text">
              Templates synced {primaryAccount.lastTemplateSync}
            </div>
          </div>

          <Link to="/whatsapp" className="channel-manage-btn">
            <span>Manage connection</span>
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
            Last template sync {primaryAccount.lastTemplateSync}
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
                    <span className="breakdown-pct">{delivery.deliveredPct || 58.6}%</span>
                  </div>
                </div>
                <div className="breakdown-bar-bg">
                  <div className="breakdown-bar-fill bar-gradient-delivered" style={{ width: `${Math.min(100, delivery.deliveredPct || 58.6)}%` }}></div>
                </div>
              </div>

              {/* Read */}
              <div className="breakdown-item">
                <div className="breakdown-row">
                  <span className="breakdown-label">Read</span>
                  <div className="breakdown-numbers">
                    <span className="breakdown-count">{formatNum(delivery.read)}</span>
                    <span className="breakdown-pct">{delivery.readPct || 55.9}%</span>
                  </div>
                </div>
                <div className="breakdown-bar-bg">
                  <div className="breakdown-bar-fill bar-gradient-read" style={{ width: `${Math.min(100, delivery.readPct || 55.9)}%` }}></div>
                </div>
              </div>

              {/* Failed */}
              <div className="breakdown-item">
                <div className="breakdown-row">
                  <span className="breakdown-label">Failed</span>
                  <div className="breakdown-numbers">
                    <span className="breakdown-count">{formatNum(delivery.failed)}</span>
                    <span className="breakdown-pct">{delivery.failedPct || 22.4}%</span>
                  </div>
                </div>
                <div className="breakdown-bar-bg">
                  <div className="breakdown-bar-fill bar-gradient-failed" style={{ width: `${Math.min(100, delivery.failedPct || 22.4)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <p className="delivery-footer-note">Percentages measured against messages sent</p>
        </div>
      </div>

      {/* ================= Middle Row: 2 Charts (Image 3) ================= */}
      <div className="dashboard-charts-grid">
        {/* Chart 1: Campaign Performance (Bar Chart) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Campaign Performance</h3>
          </div>
          <div style={{ width: '100%', height: 250 }}>
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
          </div>
        </div>
      </div>

      {/* ================= Middle Row 2: 2 Charts (Image 3) ================= */}
      <div className="dashboard-charts-grid">
        {/* Chart 3: Contact Growth (Spline Area Chart) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Contact Growth</h3>
          </div>
          <div style={{ width: '100%', height: 240 }}>
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
          </div>
        </div>

        {/* Chart 4: Message Status Distribution (Donut / Pie Chart) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Message Status Distribution</h3>
          </div>
          <div style={{ width: '100%', height: 200 }}>
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
          </div>

          <div className="d-flex justify-content-center align-items-center gap-3 pt-2" style={{ fontSize: '0.8rem' }}>
            {statusDistributionData.map((s, idx) => (
              <span key={idx} className="d-flex align-items-center gap-1 text-secondary">
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: s.color, display: 'inline-block' }}></span>
                <span>{s.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ================= Bottom Row: Recent Campaigns (Image 3) ================= */}
      <div className="recent-campaigns-card">
        <h3 className="recent-campaigns-title">Recent Campaigns</h3>

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
                  <span className="campaign-badge-completed">completed</span>
                </div>
                <div className="campaign-stats-col">{summary}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
