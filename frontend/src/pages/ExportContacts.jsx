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
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

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

  const refreshAll = () => {
    loadFilterOptions();
    loadOverallStats();
    loadMatchingCount();
    showToast('success', 'Filters and stats refreshed.');
  };

  const handleExport = async (format = 'csv') => {
    try {
      setExporting(true);
      setExportingFormat(format);

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

      showToast('success', `Successfully exported ${matchingCount} contacts as ${isExcel ? 'Excel (.xlsx)' : 'CSV'}.`);
    } catch (err) {
      console.error('[ExportContacts] Export failed:', err);
      showToast('danger', 'Failed to export contacts. Please try again or verify filters.');
    } finally {
      setExporting(false);
      setExportingFormat(null);
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
        {/* Top Hero Banner (Matching Organize Your Contacts) */}
        <div className="cg-hero-banner">
          <div className="cg-hero-left">
            <div className="cg-hero-icon">
              <i className="bi bi-file-earmark-arrow-down-fill"></i>
            </div>
            <div>
              <h1 className="cg-hero-title">Export Contacts</h1>
              <p className="cg-hero-subtitle">
                Export your customer phone directory filtered by group or tag into CSV and Excel formats.
              </p>
            </div>
          </div>
          <div className="cg-hero-actions">
            <button
              type="button"
              onClick={refreshAll}
              className="cg-hero-btn-refresh"
              title="Refresh options"
            >
              <i className="bi bi-arrow-clockwise"></i>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 3 Stats Cards Row (Matching Organize Your Contacts) */}
        <div className="cg-stats-grid">
          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-blue">
              <i className="bi bi-people-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Total Contacts</div>
              <div className="cg-stat-value">{stats.totalContacts}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-green">
              <i className="bi bi-patch-check-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">WhatsApp Opted-In</div>
              <div className="cg-stat-value">{stats.optedInContacts}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
              <i className="bi bi-send-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Broadcast Ready</div>
              <div className="cg-stat-value text-green">100%</div>
            </div>
          </div>
        </div>

        {/* Main Export Card (Matching Organize Your Contacts layout) */}
        <div className="cg-card">
          <div className="cg-card-header">
            <h2 className="cg-card-title">Export Contacts</h2>
          </div>

          <div className="cg-card-body pt-2">
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
              <span className="badge px-3 py-2 fw-semibold" style={{ background: '#f5f0ff', color: '#7c3aed', fontSize: '0.86rem', border: '1px solid #e9d5ff', borderRadius: '8px' }}>
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
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
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
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                ) : (
                  <i className="bi bi-file-earmark-excel-fill"></i>
                )}
                <span>Export Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Helpful Specifications Card */}
        <div className="cg-card">
          <div className="cg-card-header pb-2">
            <h6 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
              <i className="bi bi-info-circle-fill text-primary"></i>
              <span>Export File Specifications</span>
            </h6>
          </div>
          <div className="cg-card-body pt-3">
            <div className="row g-3 small text-secondary">
              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #E5EAF2' }}>
                  <div className="fw-bold text-dark mb-1">CSV Format (.csv)</div>
                  <div>Standard comma-separated format compatible with Google Sheets, CRMs, marketing tools, and any text editor.</div>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #E5EAF2' }}>
                  <div className="fw-bold text-dark mb-1">Excel Format (.xlsx)</div>
                  <div>Native Microsoft Excel spreadsheet with styled header columns, auto-width formatting, and UTF-8 encoding.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
