import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import OverviewTab from './tabs/OverviewTab';
import MessagesTab from './tabs/MessagesTab';
import CampaignsTab from './tabs/CampaignsTab';
import NumbersTab from './tabs/NumbersTab';
import ContactsTab from './tabs/ContactsTab';
import ConversationsTab from './tabs/ConversationsTab';
import TemplatesTab from './tabs/TemplatesTab';
import RevenueTab from './tabs/RevenueTab';

import '../../styles/analytics.css';

export default function Analytics() {
  const { user, isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const isSuper = isSuperAdmin ? (typeof isSuperAdmin === 'function' ? isSuperAdmin() : isSuperAdmin) : (user?.role === 'superadmin');

  // URL / Tab state
  const currentTab = searchParams.get('tab') || 'overview';

  // Global Filter State
  const [period, setPeriod] = useState(searchParams.get('period') || 'last_7_days');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [numberId, setNumberId] = useState(searchParams.get('numberId') || 'all');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);

  // Available Numbers for Filter
  const [numbersList, setNumbersList] = useState([]);

  // Data & Loading States
  const [tabData, setTabData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Fetch Numbers for Dropdown Filter
  useEffect(() => {
    const fetchNumbers = async () => {
      try {
        const res = await api.get('/whatsapp/accounts');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setNumbersList(res.data.data);
        }
      } catch (_) {}
    };
    fetchNumbers();
  }, []);

  // Fetch Analytics Data based on active tab and filters
  const fetchAnalyticsData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      setLoading(true);

      const params = {
        period,
        numberId: numberId !== 'all' ? numberId : undefined,
        status: status !== 'all' ? status : undefined,
        search: search.trim() || undefined,
        page,
        limit: 20
      };

      if (period === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      let endpoint = `/analytics/${currentTab}`;
      if (currentTab === 'revenue' && !isSuper) {
        endpoint = '/analytics/overview';
      }

      const res = await api.get(endpoint, { params });
      if (res.data?.success) {
        setTabData(res.data.data);
      }
    } catch (err) {
      console.error('[Analytics] Failed to fetch data:', err);
      showToast('danger', err.response?.data?.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setTimeout(() => {
          setRefreshing(false);
          showToast('success', 'Analytics data refreshed.');
        }, 500);
      }
    }
  }, [currentTab, period, startDate, endDate, numberId, status, search, page, isSuper]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Handle Tab Switch
  const handleTabChange = (tabKey) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', tabKey);
      return p;
    });
    setPage(1);
  };

  // Handle Period Preset Change
  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setPage(1);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('period', newPeriod);
      if (newPeriod !== 'custom') {
        p.delete('startDate');
        p.delete('endDate');
      }
      return p;
    });
  };

  // Reset Filters
  const handleResetFilters = () => {
    setPeriod('last_7_days');
    setStartDate('');
    setEndDate('');
    setNumberId('all');
    setStatus('all');
    setSearch('');
    setPage(1);
    setSearchParams({ tab: currentTab, period: 'last_7_days' });
    showToast('info', 'Filters reset to default (Last 7 Days).');
  };

  // Export Trigger
  const handleExport = async (type = 'messages', format = 'csv') => {
    try {
      const params = {
        type,
        format,
        period,
        numberId: numberId !== 'all' ? numberId : undefined,
        status: status !== 'all' ? status : undefined,
        search: search.trim() || undefined
      };
      if (period === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await api.get('/analytics/export', {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `analytics_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      showToast('success', `Exported ${type} analytics as CSV.`);
    } catch (err) {
      console.error('[Analytics] Export failed:', err);
      showToast('danger', 'Failed to generate export file.');
    }
  };

  // Tabs definitions
  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'bi-speedometer2' },
    { key: 'messages', label: 'Messages', icon: 'bi-chat-left-dots' },
    { key: 'campaigns', label: 'Campaigns', icon: 'bi-send' },
    { key: 'numbers', label: 'Numbers', icon: 'bi-telephone' },
    { key: 'contacts', label: 'Contacts', icon: 'bi-people' },
    { key: 'conversations', label: 'Conversations', icon: 'bi-chat-dots' },
    { key: 'templates', label: 'Templates', icon: 'bi-file-earmark-text' },
    ...(isSuper ? [{ key: 'revenue', label: 'Revenue', icon: 'bi-currency-dollar', superAdminOnly: true }] : [])
  ];

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
        {/* Top Hero Banner (Matching Organize Your Contacts design system) */}
        <div className="cg-hero-banner">
          <div className="cg-hero-left">
            <div className="cg-hero-icon">
              <i className="bi bi-graph-up-arrow"></i>
            </div>
            <div>
              <h1 className="cg-hero-title">Analytics & Intelligence</h1>
              <p className="cg-hero-subtitle">
                Real-time WhatsApp marketing, delivery metrics, campaign performance, and revenue intelligence.
              </p>
            </div>
          </div>
          <div className="cg-hero-actions">
            <button
              type="button"
              onClick={() => fetchAnalyticsData(true)}
              className="cg-hero-btn-refresh"
              title="Refresh Analytics Data"
              disabled={refreshing}
            >
              <i className={`bi bi-arrow-clockwise ${refreshing ? 'spin' : ''}`}></i>
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport(currentTab === 'campaigns' ? 'campaigns' : (currentTab === 'numbers' ? 'numbers' : 'messages'), 'csv')}
              className="cg-hero-btn-create"
              title="Export Current View Data"
            >
              <i className="bi bi-download"></i>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="an-filter-bar">
          <div className="an-filter-left">
            {/* Period Preset Pills */}
            <div className="an-period-presets">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'last_7_days', label: 'Last 7 Days' },
                { id: 'last_30_days', label: 'Last 30 Days' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'this_year', label: 'This Year' },
                { id: 'custom', label: 'Custom' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`an-preset-btn ${period === p.id ? 'active' : ''}`}
                  onClick={() => handlePeriodChange(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {period === 'custom' && (
              <div className="an-date-inputs">
                <input
                  type="date"
                  className="an-date-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Start Date"
                />
                <span className="text-secondary small">to</span>
                <input
                  type="date"
                  className="an-date-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="End Date"
                />
              </div>
            )}

            {/* WhatsApp Line Selector */}
            <select
              className="an-filter-select"
              value={numberId}
              onChange={(e) => {
                setNumberId(e.target.value);
                setPage(1);
              }}
              title="Filter by WhatsApp Line"
            >
              <option value="all">All WhatsApp Lines</option>
              {numbersList.map(num => (
                <option key={num.id} value={num.id}>
                  {num.display_name || num.phone_number} ({num.phone_number})
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters CTA */}
          <button
            type="button"
            className="btn btn-sm btn-link text-secondary text-decoration-none d-flex align-items-center gap-1"
            onClick={handleResetFilters}
            title="Reset to default date range"
          >
            <i className="bi bi-arrow-counterclockwise"></i>
            <span>Reset Filters</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="an-tabs-nav">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              className={`an-tab-item ${currentTab === t.key ? 'active' : ''}`}
              onClick={() => handleTabChange(t.key)}
            >
              <i className={`bi ${t.icon}`}></i>
              <span>{t.label}</span>
              {t.superAdminOnly && (
                <span className="an-tab-badge">Admin</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div>
          {currentTab === 'overview' && (
            <OverviewTab data={tabData} loading={loading} />
          )}

          {currentTab === 'messages' && (
            <MessagesTab
              data={tabData}
              loading={loading}
              filters={{ search, status, page }}
              onFilterChange={(newFilters) => {
                if (newFilters.search !== undefined) setSearch(newFilters.search);
                if (newFilters.status !== undefined) setStatus(newFilters.status);
                if (newFilters.page !== undefined) setPage(newFilters.page);
              }}
              onExport={handleExport}
            />
          )}

          {currentTab === 'campaigns' && (
            <CampaignsTab data={tabData} loading={loading} onExport={handleExport} />
          )}

          {currentTab === 'numbers' && (
            <NumbersTab data={tabData} loading={loading} onExport={handleExport} />
          )}

          {currentTab === 'contacts' && (
            <ContactsTab data={tabData} loading={loading} />
          )}

          {currentTab === 'conversations' && (
            <ConversationsTab data={tabData} loading={loading} />
          )}

          {currentTab === 'templates' && (
            <TemplatesTab data={tabData} loading={loading} />
          )}

          {currentTab === 'revenue' && isSuper && (
            <RevenueTab data={tabData} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}
