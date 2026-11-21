import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/exportContacts.css';

export default function ExportContacts() {
  const [groups, setGroups] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');

  const [matchingCount, setMatchingCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);

  const [stats, setStats] = useState({
    totalContacts: 0,
    optedInContacts: 0,
    groupsCount: 0,
    tagsCount: 0
  });

  const [exporting, setExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null); // 'csv' or 'excel'
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Initial load: groups, tags, and stats
  useEffect(() => {
    loadFilterOptions();
    loadOverallStats();
  }, []);

  // Update matching count when filters change
  useEffect(() => {
    loadMatchingCount();
  }, [selectedGroup, selectedTag]);

  const loadFilterOptions = async () => {
    try {
      const [groupsRes, tagsRes] = await Promise.allSettled([
        api.get('/contact-groups'),
        api.get('/contacts/tags')
      ]);

      if (groupsRes.status === 'fulfilled' && groupsRes.value.data?.success) {
        setGroups(groupsRes.value.data.data || []);
      }
      if (tagsRes.status === 'fulfilled' && tagsRes.value.data?.success) {
        setTags(tagsRes.value.data.data || []);
      }
    } catch (err) {
      console.error('[ExportContacts] Failed to load filter options:', err);
    }
  };

  const loadOverallStats = async () => {
    try {
      const res = await api.get('/contacts', { params: { limit: 1 } });
      if (res.data?.success) {
        setStats({
          totalContacts: res.data.pagination?.total || 0,
          optedInContacts: res.data.stats?.optedIn || 0,
          groupsCount: groups.length,
          tagsCount: tags.length
        });
      }
    } catch (_) {}
  };

  const loadMatchingCount = async () => {
    try {
      setLoadingCount(true);
      const params = {};
      if (selectedGroup && selectedGroup !== 'all') params.groupId = selectedGroup;
      if (selectedTag && selectedTag !== 'all') params.tagId = selectedTag;

      const res = await api.get('/contacts/export/count', { params });
      if (res.data?.success) {
        setMatchingCount(res.data.count);
      }
    } catch (err) {
      console.error('[ExportContacts] Error counting contacts:', err);
    } finally {
      setLoadingCount(false);
    }
  };

  const handleExport = async (format = 'csv') => {
    try {
      setExporting(true);
      setExportingFormat(format);
      setFeedback({ type: '', text: '' });

      const params = { format };
      if (selectedGroup && selectedGroup !== 'all') params.groupId = selectedGroup;
      if (selectedTag && selectedTag !== 'all') params.tagId = selectedTag;

      const res = await api.get('/contacts/export', {
        params,
        responseType: 'blob'
      });

      const isExcel = format === 'excel';
      const mimeType = isExcel
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8;';

      const blob = new Blob([res.data], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `contacts_export_${dateStr}.${isExcel ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setFeedback({
        type: 'success',
        text: `Successfully exported ${matchingCount} contacts as ${isExcel ? 'Excel (.xlsx)' : 'CSV'}.`
      });
    } catch (err) {
      console.error('[ExportContacts] Export failed:', err);
      setFeedback({
        type: 'danger',
        text: 'Failed to export contacts. Please try again or verify filters.'
      });
    } finally {
      setExporting(false);
      setExportingFormat(null);
    }
  };

  return (
    <div className="exp-page-container">
      {/* Feedback Toast */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`}></i>
            <div>{feedback.text}</div>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Hero Title Bar */}
      <div className="exp-hero-banner">
        <div className="exp-hero-left">
          <div className="exp-brand-square">
            <i className="bi bi-file-earmark-arrow-down-fill"></i>
          </div>
          <div>
            <h1 className="exp-hero-title">
              Export Contacts
            </h1>
            <p className="exp-hero-subtitle">
              Export your customer phone directory filtered by group or tag into CSV and Excel formats.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="exp-kpi-grid">
        <div className="exp-kpi-card">
          <div className="exp-kpi-icon-circle purple">
            <i className="bi bi-people-fill"></i>
          </div>
          <div>
            <span className="exp-kpi-value">{stats.totalContacts}</span>
            <span className="exp-kpi-label">Total Contacts</span>
          </div>
        </div>

        <div className="exp-kpi-card">
          <div className="exp-kpi-icon-circle green">
            <i className="bi bi-patch-check-fill"></i>
          </div>
          <div>
            <span className="exp-kpi-value">{stats.optedInContacts}</span>
            <span className="exp-kpi-label">WhatsApp Opted-In</span>
          </div>
        </div>

        <div className="exp-kpi-card">
          <div className="exp-kpi-icon-circle blue">
            <i className="bi bi-collection-fill"></i>
          </div>
          <div>
            <span className="exp-kpi-value">{groups.length}</span>
            <span className="exp-kpi-label">Contact Groups</span>
          </div>
        </div>

        <div className="exp-kpi-card">
          <div className="exp-kpi-icon-circle amber">
            <i className="bi bi-tags-fill"></i>
          </div>
          <div>
            <span className="exp-kpi-value">{tags.length}</span>
            <span className="exp-kpi-label">Tags</span>
          </div>
        </div>
      </div>

      {/* Main Export Card Matching User Screenshot */}
      <div className="exp-card-main">
        <h3 className="exp-card-title">Export Contacts</h3>

        <div className="row g-4 mb-4">
          <div className="col-12 col-md-6">
            <label className="form-label text-secondary fw-semibold small mb-2">Group (optional)</label>
            <select
              className="form-select exp-select-input"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="all">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.member_count !== undefined ? `(${g.member_count})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label text-secondary fw-semibold small mb-2">Tag (optional)</label>
            <select
              className="form-select exp-select-input"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="all">All Tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Filter Matching Count */}
        <div className="mb-4">
          <span className="badge px-3 py-2 fw-semibold" style={{ background: '#f5f0ff', color: '#7c3aed', fontSize: '0.84rem', border: '1px solid #e9d5ff', borderRadius: '8px' }}>
            <i className="bi bi-funnel-fill me-1"></i>
            {loadingCount ? 'Calculating...' : `${matchingCount} contact${matchingCount === 1 ? '' : 's'} match selected filters`}
          </span>
        </div>

        {/* Action Buttons: Export CSV (green) and Export Excel (purple) */}
        <div className="d-flex flex-wrap align-items-center gap-3">
          <button
            type="button"
            className="exp-btn-csv"
            disabled={exporting || matchingCount === 0}
            onClick={() => handleExport('csv')}
          >
            {exportingFormat === 'csv' ? (
              <span className="spinner-border spinner-border-sm" role="status"></span>
            ) : (
              <i className="bi bi-download"></i>
            )}
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="exp-btn-excel"
            disabled={exporting || matchingCount === 0}
            onClick={() => handleExport('excel')}
          >
            {exportingFormat === 'excel' ? (
              <span className="spinner-border spinner-border-sm" role="status"></span>
            ) : (
              <i className="bi bi-file-earmark-excel-fill"></i>
            )}
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Helpful Instructions Card */}
      <div className="card border-0 shadow-sm rounded-4 p-4" style={{ background: '#ffffff', border: '1px solid #eef2f6' }}>
        <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-info-circle-fill text-primary"></i>
          <span>Export File Specifications</span>
        </h6>
        <div className="row g-3 small text-secondary">
          <div className="col-12 col-md-6">
            <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="fw-bold text-dark mb-1">CSV Format (.csv)</div>
              <div>Standard comma-separated format compatible with Google Sheets, CRMs, marketing tools, and any text editor.</div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="fw-bold text-dark mb-1">Excel Format (.xlsx)</div>
              <div>Native Microsoft Excel spreadsheet with styled header columns, auto-width formatting, and UTF-8 encoding.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
