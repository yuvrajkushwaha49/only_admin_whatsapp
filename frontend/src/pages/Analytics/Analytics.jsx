import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import OverviewTab from './tabs/OverviewTab';
import CampaignsTab from './tabs/CampaignsTab';
import MessagesTab from './tabs/MessagesTab';
import TemplatesTab from './tabs/TemplatesTab';
import '../../styles/analytics.css';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('Last 7 Days');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const [dashboardStats, setDashboardStats] = useState(null);
  const [campaignsData, setCampaignsData] = useState(null);
  const [messagesData, setMessagesData] = useState(null);
  const [templatesData, setTemplatesData] = useState(null);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadAllData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setLoading(true);

      const [dashRes, campRes, msgRes, tplRes] = await Promise.allSettled([
        api.get('/analytics/dashboard', { params: { timeRange } }),
        api.get('/analytics/campaigns', { params: { timeRange } }),
        api.get('/analytics/messages', { params: { timeRange } }),
        api.get('/analytics/templates')
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.data?.success) {
        setDashboardStats(dashRes.value.data.data);
      }
      if (campRes.status === 'fulfilled' && campRes.value.data?.success) {
        setCampaignsData(campRes.value.data.data);
      }
      if (msgRes.status === 'fulfilled' && msgRes.value.data?.success) {
        setMessagesData(msgRes.value.data.data);
      }
      if (tplRes.status === 'fulfilled' && tplRes.value.data?.success) {
        setTemplatesData(tplRes.value.data.data);
      }

      if (isManual) {
        showToast('success', 'Analytics data refreshed from database.');
      }
    } catch (err) {
      console.error('[Analytics] Error fetching analytics data:', err);
      showToast('danger', 'Failed to fetch analytics from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [timeRange]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const res = await api.get('/analytics/export', {
        params: { timeRange },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `analytics_report_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      showToast('success', 'Analytics report exported successfully.');
    } catch (err) {
      console.error('[Analytics] Export failed:', err);
      showToast('danger', 'Failed to export analytics report.');
    } finally {
      setExporting(false);
    }
  };

  const totalSent = Number(dashboardStats?.kpis?.messagesSent || 0);
  const deliveryRate = Number(dashboardStats?.kpis?.deliveryRate || 0);
  const readRate = Number(dashboardStats?.kpis?.readRate || 0);

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
              <i className="bi bi-graph-up-arrow"></i>
            </div>
            <div>
              <h1 className="cg-hero-title">Analytics & Performance</h1>
              <p className="cg-hero-subtitle">
                Track real-time delivery rates, message volume, and WhatsApp campaign performance.
              </p>
            </div>
          </div>

          <div className="cg-hero-actions">
            <select
              className="form-select form-select-sm"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
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
              <option value="Today">Today</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Month">This Month</option>
            </select>

            <button
              type="button"
              onClick={() => loadAllData(true)}
              disabled={refreshing}
              className="cg-hero-btn-refresh"
              title="Refresh analytics from database"
            >
              <i className={`bi bi-arrow-clockwise ${refreshing ? 'spin' : ''}`}></i>
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="cg-hero-btn-create"
              style={{ background: '#00a884', borderColor: '#00a884' }}
              title="Export CSV Report"
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
              <i className="bi bi-send-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Total Messages Sent</div>
              <div className="cg-stat-value">{totalSent.toLocaleString()}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-green">
              <i className="bi bi-patch-check-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Delivery Success Rate</div>
              <div className="cg-stat-value text-green">{deliveryRate}%</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
              <i className="bi bi-eye-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Read Engagement Rate</div>
              <div className="cg-stat-value" style={{ color: '#0284c7' }}>{readRate}%</div>
            </div>
          </div>
        </div>

        {/* Main Content Card Container (Exact match with Organize Your Contacts) */}
        <div className="cg-card">
          <div className="cg-card-header pb-3 border-bottom mb-4">
            <h2 className="cg-card-title">
              {activeTab === 'overview' && 'Performance Overview'}
              {activeTab === 'campaigns' && `Campaign Analytics (${campaignsData?.campaigns?.length || 0})`}
              {activeTab === 'messages' && '24-Hour Message Volume & Peak Hours'}
              {activeTab === 'templates' && `Template Performance (${templatesData?.templates?.length || 0})`}
            </h2>

            {/* Pill Tab Switcher */}
            <div className="analytics-nav-tabs m-0 border-0 p-0">
              <button
                type="button"
                className={`analytics-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <i className="bi bi-speedometer2"></i>
                <span>Overview</span>
              </button>

              <button
                type="button"
                className={`analytics-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
                onClick={() => setActiveTab('campaigns')}
              >
                <i className="bi bi-send"></i>
                <span>Campaigns</span>
              </button>

              <button
                type="button"
                className={`analytics-tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
                onClick={() => setActiveTab('messages')}
              >
                <i className="bi bi-clock-history"></i>
                <span>Activity</span>
              </button>

              <button
                type="button"
                className={`analytics-tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
                onClick={() => setActiveTab('templates')}
              >
                <i className="bi bi-file-earmark-text"></i>
                <span>Templates</span>
              </button>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="cg-card-body">
            {activeTab === 'overview' && (
              <OverviewTab stats={dashboardStats} loading={loading} />
            )}

            {activeTab === 'campaigns' && (
              <CampaignsTab campaignsData={campaignsData} loading={loading} />
            )}

            {activeTab === 'messages' && (
              <MessagesTab messagesData={messagesData} loading={loading} />
            )}

            {activeTab === 'templates' && (
              <TemplatesTab templatesData={templatesData} loading={loading} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
