import React, { useState, useEffect } from 'react';
import { Link, useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';
import { useAuth } from '../hooks/useAuth';

export default function Contacts() {
  const { user, isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'export') {
      navigate('/export', { replace: true });
    }
  }, [location.search, navigate]);
  const isAgent = user?.role === 'agent';
  const canDelete = Boolean((isSuperAdmin && isSuperAdmin()) || user?.role === 'superadmin' || user?.role === 'owner');
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [optedInFilter, setOptedInFilter] = useState('');

  // Contacts Pagination State
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsLimit, setContactsLimit] = useState(20);
  const [contactsPagination, setContactsPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [contactStats, setContactStats] = useState({ total: 0, optedIn: 0, unsubscribed: 0, suppressed: 0 });

  // Imported Excel & CSV Jobs State
  const [importJobs, setImportJobs] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importPage, setImportPage] = useState(1);
  const [importLimit, setImportLimit] = useState(10);
  const [importPagination, setImportPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  // Add Contact Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    consentProof: 'Explicit opt-in received from customer'
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  // Edit Tag Modal for Import Jobs
  const [editTagTargetJob, setEditTagTargetJob] = useState(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [replaceOldTagOnContacts, setReplaceOldTagOnContacts] = useState(false);
  const [updatingTag, setUpdatingTag] = useState(false);

  // Delete Import Job Modal
  const [deleteTargetJob, setDeleteTargetJob] = useState(null);
  const [alsoDeleteContacts, setAlsoDeleteContacts] = useState(false);
  const [deletingJob, setDeletingJob] = useState(false);

  // Reset contacts page when filters change
  useEffect(() => {
    setContactsPage(1);
  }, [selectedTag, optedInFilter]);

  // Fetch contacts whenever page, limit, or filters change
  useEffect(() => {
    fetchContacts();
  }, [contactsPage, contactsLimit, selectedTag, optedInFilter]);

  // Fetch imported files whenever page or limit changes
  useEffect(() => {
    fetchImportJobs();
  }, [importPage, importLimit]);

  // Fetch available tags once on mount
  useEffect(() => {
    fetchTags();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const params = {
        page: contactsPage,
        limit: contactsLimit,
        search,
        tag: selectedTag,
        optedIn: optedInFilter
      };
      const res = await api.get('/contacts', { params });
      if (res.data?.success) {
        setContacts(res.data.contacts || []);
        if (res.data.pagination) {
          setContactsPagination(res.data.pagination);
        }
        if (res.data.stats) {
          setContactStats(res.data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load contacts', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchImportJobs = async () => {
    try {
      setImportLoading(true);
      const res = await api.get('/imports', {
        params: { page: importPage, limit: importLimit }
      });
      if (res.data?.success) {
        const jobs = Array.isArray(res.data.data) ? res.data.data : res.data.jobs || [];
        setImportJobs(jobs);
        if (res.data.pagination) {
          setImportPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load import jobs', err);
    } finally {
      setImportLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await api.get('/contacts/tags');
      if (res.data?.success) setTags(res.data.data || []);
    } catch (err) {
      console.error('Failed to load tags', err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (contactsPage !== 1) {
      setContactsPage(1);
    } else {
      fetchContacts();
    }
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg({ type: '', text: '' });

    try {
      await api.post('/contacts', newContact);
      setShowAddModal(false);
      setNewContact({ name: '', phone: '', email: '', consentProof: 'Explicit opt-in received from customer' });
      setFeedbackMsg({ type: 'success', text: 'Contact created and verifiable consent recorded!' });
      fetchContacts();
    } catch (err) {
      setFeedbackMsg({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to create contact' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleConsent = async (contactId, currentStatus) => {
    const newStatus = !currentStatus;
    const confirmMsg = newStatus 
      ? 'Are you sure you want to re-subscribe this contact with fresh verified consent?' 
      : 'Are you sure you want to mark this contact as Opted Out? They will immediately be suppressed from all marketing broadcasts.';

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.patch(`/contacts/${contactId}/consent`, {
        optedIn: newStatus,
        reason: newStatus ? 'Verified consent re-acquired' : 'User requested unsubscribe via dashboard'
      });
      setFeedbackMsg({ type: 'success', text: 'Consent status updated in compliance records.' });
      fetchContacts();
    } catch (err) {
      setFeedbackMsg({ type: 'danger', text: 'Failed to update consent.' });
    }
  };

  const handleDelete = async (contactId) => {
    if (!window.confirm('Delete this contact record?')) return;
    try {
      await api.delete(`/contacts/${contactId}`);
      setFeedbackMsg({ type: 'success', text: 'Contact deleted.' });
      fetchContacts();
    } catch (err) {
      setFeedbackMsg({ type: 'danger', text: 'Failed to delete contact.' });
    }
  };

  // Change Tag Handlers
  const handleOpenEditTag = (job) => {
    setEditTagTargetJob(job);
    setNewTagInput(job.options?.batchTag || '');
    setReplaceOldTagOnContacts(false);
  };

  const handleSaveEditTag = async (e) => {
    e.preventDefault();
    if (!editTagTargetJob || !newTagInput.trim()) return;

    try {
      setUpdatingTag(true);
      const res = await api.patch(`/imports/${editTagTargetJob.id}/tag`, {
        newTag: newTagInput.trim(),
        replaceOldTag: replaceOldTagOnContacts
      });
      if (res.data?.success) {
        setFeedbackMsg({ type: 'success', text: res.data.message || 'Tag updated successfully!' });
        setEditTagTargetJob(null);
        fetchImportJobs();
        fetchContacts();
        fetchTags();
      }
    } catch (err) {
      setFeedbackMsg({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to update import tag' });
    } finally {
      setUpdatingTag(false);
    }
  };

  // Delete Import Job Handlers
  const handleConfirmDeleteJob = async () => {
    if (!deleteTargetJob) return;
    try {
      setDeletingJob(true);
      const res = await api.delete(`/imports/${deleteTargetJob.id}?deleteContacts=${alsoDeleteContacts}`);
      if (res.data?.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Import "${deleteTargetJob.file_name}" deleted.${alsoDeleteContacts ? ` Removed ${res.data.deletedContactsCount || 0} associated contact(s).` : ''}`
        });
        setDeleteTargetJob(null);
        fetchImportJobs();
        fetchContacts();
      }
    } catch (err) {
      setFeedbackMsg({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to delete import job' });
    } finally {
      setDeletingJob(false);
    }
  };

  const handleDownloadErrorReport = (jobId) => {
    window.open(`/api/imports/${jobId}/export-errors`, '_blank');
  };

  // KPI Metrics Calculation
  const totalContacts = contactStats.total || contactsPagination.total || contacts.length;
  const optedInCount = contactStats.optedIn ?? contacts.filter((c) => Boolean(c.is_opted_in)).length;
  const unsubscribedCount = contactStats.unsubscribed ?? contacts.filter((c) => !Boolean(c.is_opted_in)).length;
  const suppressedCount = contactStats.suppressed ?? contacts.filter((c) => !Boolean(c.is_opted_in) || c.status !== 'active').length;

  // Pagination helper calculations
  const contactsStart = contactsPagination.total === 0 ? 0 : (contactsPagination.page - 1) * contactsPagination.limit + 1;
  const contactsEnd = Math.min(contactsPagination.page * contactsPagination.limit, contactsPagination.total);

  const importsStart = importPagination.total === 0 ? 0 : (importPagination.page - 1) * importPagination.limit + 1;
  const importsEnd = Math.min(importPagination.page * importPagination.limit, importPagination.total);

  const getPageNumbers = (current, total) => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const getAvatarStyle = (name) => {
    const firstLetter = (name || 'A').trim()[0]?.toUpperCase() || 'A';
    const palette = [
      { bg: '#dcfce7', text: '#16a34a' }, // green
      { bg: '#f3e8ff', text: '#9333ea' }, // purple
      { bg: '#e0f2fe', text: '#0284c7' }, // blue
      { bg: '#ffedd5', text: '#ea580c' }, // orange
      { bg: '#fce7f3', text: '#db2777' }, // pink
      { bg: '#fef3c7', text: '#d97706' }  // amber
    ];
    const charCode = firstLetter.charCodeAt(0);
    return {
      letter: firstLetter,
      style: palette[charCode % palette.length]
    };
  };

  return (
    <div>
      <AiwavoHeader
        title="Contacts"
        subtitle="E.164 verified phone numbers with auditable WhatsApp consent records"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="cnt-page-container">
        {/* Feedback Alert */}
        {feedbackMsg.text && (
          <div className={`alert alert-${feedbackMsg.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
            <div className="d-flex align-items-center gap-2">
              <i className={`bi ${feedbackMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`}></i>
              <div>{feedbackMsg.text}</div>
            </div>
            <button type="button" className="btn-close" onClick={() => setFeedbackMsg({ type: '', text: '' })}></button>
          </div>
        )}

        {/* 1. Manage Your Contacts Hero Banner */}
        <div className="cnt-hero-banner">
          <div className="cnt-hero-left">
            <div className="cnt-hero-icon">
              <i className="bi bi-people-fill"></i>
            </div>
            <div>
              <h1 className="cnt-hero-title">Manage Your Contacts</h1>
              <p className="cnt-hero-subtitle">
                Add, import and manage your verified WhatsApp contacts with consent records.
              </p>
            </div>
          </div>

          <div className="cnt-hero-actions">
            {!isAgent && (
              <>
                <Link to="/contacts/groups" className="cnt-hero-btn-green-outline" title="Manage Contact Groups">
                  <i className="bi bi-folder-fill"></i>
                  <span>Contact Groups</span>
                </Link>

                <Link to="/imports" className="cnt-hero-btn-outline" title="Bulk Import Contacts from CSV / Excel">
                  <i className="bi bi-file-earmark-arrow-up"></i>
                  <span>Import CSV / Excel</span>
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="cnt-hero-btn-green-solid"
              title="Add Single Contact"
            >
              <i className="bi bi-person-plus-fill"></i>
              <span>Add Contact</span>
            </button>
          </div>
        </div>

        {/* 2. Four KPI Metric Cards */}
        <div className="cnt-kpi-grid">
          {/* Card 1: Total Contacts */}
          <div className="cnt-kpi-card">
            <div className="cnt-kpi-icon-circle" style={{ background: '#ecfdf5', color: '#10b981' }}>
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="cnt-kpi-info">
              <div className="cnt-kpi-val-row">
                <span className="cnt-kpi-value">{totalContacts.toLocaleString()}</span>
                <span className="cnt-kpi-trend">Live</span>
              </div>
              <span className="cnt-kpi-label">Total Contacts</span>
            </div>
          </div>

          {/* Card 2: Opted-in Contacts */}
          <div className="cnt-kpi-card">
            <div className="cnt-kpi-icon-circle" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="cnt-kpi-info">
              <div className="cnt-kpi-val-row">
                <span className="cnt-kpi-value">{optedInCount.toLocaleString()}</span>
              </div>
              <span className="cnt-kpi-label">Opted-in Contacts</span>
            </div>
          </div>

          {/* Card 3: Unsubscribed */}
          <div className="cnt-kpi-card">
            <div className="cnt-kpi-icon-circle" style={{ background: '#eff6ff', color: '#3b82f6' }}>
              <i className="bi bi-person-slash"></i>
            </div>
            <div className="cnt-kpi-info">
              <div className="cnt-kpi-val-row">
                <span className="cnt-kpi-value">{unsubscribedCount.toLocaleString()}</span>
              </div>
              <span className="cnt-kpi-label">Unsubscribed</span>
            </div>
          </div>

          {/* Card 4: Suppressed (Do Not Contact) */}
          <div className="cnt-kpi-card">
            <div className="cnt-kpi-icon-circle" style={{ background: '#fef2f2', color: '#ef4444' }}>
              <i className="bi bi-shield-x"></i>
            </div>
            <div className="cnt-kpi-info">
              <div className="cnt-kpi-val-row">
                <span className="cnt-kpi-value">{suppressedCount.toLocaleString()}</span>
              </div>
              <span className="cnt-kpi-label">Suppressed (Do Not Contact)</span>
            </div>
          </div>
        </div>

        {/* 3. Search and Filter Bar */}
        <div className="cnt-search-card">
          <form onSubmit={handleSearchSubmit} className="cnt-filter-form">
            <div className="cnt-search-input-wrap">
              <i className="bi bi-search text-muted"></i>
              <input
                type="text"
                placeholder="Search by phone, customer name, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="cnt-select"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="">All Segment Tags</option>
              {tags.map((t) => (
                <option key={t.id || t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              className="cnt-select"
              value={optedInFilter}
              onChange={(e) => setOptedInFilter(e.target.value)}
            >
              <option value="">All Consent Status</option>
              <option value="true">Opted In Only</option>
              <option value="false">Unsubscribed Only</option>
            </select>

            <button type="submit" className="cnt-btn-filter">
              <i className="bi bi-funnel-fill"></i>
              <span>Filter</span>
            </button>
          </form>
        </div>

        {/* 4. Contacts Data Table Card with Pagination */}
        <div className="cnt-table-card mb-4">
          <div className="cnt-table-header-row">
            <div>
              <h5 className="cnt-table-title">Contacts Directory ({contactsPagination.total.toLocaleString()})</h5>
              <span className="cnt-table-subtext">Verified contacts strictly scoped to your workspace</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={fetchContacts}
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                title="Refresh contacts"
              >
                <i className="bi bi-arrow-clockwise"></i>
                <span className="d-none d-sm-inline">Refresh</span>
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="cnt-table">
              <thead>
                <tr>
                  <th>Customer / Name</th>
                  <th>Phone (E.164)</th>
                  <th>Tags</th>
                  <th>Marketing Eligibility</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5">
                      <div className="spinner-border text-success" role="status"></div>
                      <div className="text-muted small mt-2">Loading contacts...</div>
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      No contacts found matching your search. Add contacts manually or upload a CSV / Excel file!
                    </td>
                  </tr>
                ) : (
                  contacts.map((c) => {
                    const isOptedIn = Boolean(c.is_opted_in);
                    const { letter, style: avatarStyle } = getAvatarStyle(c.name);

                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="cnt-customer-col">
                            <div
                              className="cnt-avatar-circle"
                              style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.text }}
                            >
                              {letter}
                            </div>
                            <div>
                              <div className="cnt-customer-name">
                                {c.name || 'Anonymous Customer'}
                              </div>
                              <div className="cnt-customer-email">
                                {c.email || 'No email provided'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="cnt-phone-val">
                            +{String(c.phone || '').replace(/^\+/, '')}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {c.tags && c.tags.length > 0 ? (
                              c.tags.map((t) => (
                                <span
                                  key={t.id || t.name}
                                  className="badge"
                                  style={{
                                    backgroundColor: `${t.color || '#0d6efd'}20`,
                                    color: t.color || '#0d6efd',
                                    fontWeight: 600,
                                    borderRadius: '6px'
                                  }}
                                >
                                  {t.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted small">No tags</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {isOptedIn && c.status === 'active' ? (
                            <span className="cnt-eligibility-eligible">
                              <i className="bi bi-circle-fill" style={{ fontSize: '7px' }}></i>
                              Eligible for Broadcast
                            </span>
                          ) : (
                            <span className="cnt-eligibility-suppressed">
                              <i className="bi bi-circle-fill" style={{ fontSize: '7px' }}></i>
                              Suppressed (No Send)
                            </span>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="cnt-actions-wrap">
                            <Link
                              to={`/inbox?contactId=${c.id}&phone=${encodeURIComponent(c.phone || '')}&name=${encodeURIComponent(c.name || '')}`}
                              className="cnt-btn-chat"
                              title="Open in WhatsApp Inbox & Send Template"
                            >
                              <i className="bi bi-whatsapp"></i>
                              <span>Template / Chat</span>
                            </Link>

                            <Link
                              to={`/contacts/${c.id}`}
                              className="cnt-btn-view"
                              title="View Contact Profile & History"
                            >
                              <i className="bi bi-eye"></i>
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleToggleConsent(c.id, isOptedIn)}
                              className={isOptedIn ? 'cnt-btn-optout' : 'cnt-btn-optin'}
                              title={isOptedIn ? 'Mark as Unsubscribed' : 'Restore Consent'}
                            >
                              {isOptedIn ? 'Opt-Out' : 'Opt-In'}
                            </button>

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDelete(c.id)}
                                className="cnt-btn-delete"
                                title="Delete Contact"
                              >
                                <i className="bi bi-trash3"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Contacts Pagination Footer */}
          <div className="cnt-pagination-footer">
            <div className="cnt-pagination-left">
              <span>
                Showing <strong>{contactsStart}</strong> to <strong>{contactsEnd}</strong> of <strong>{contactsPagination.total.toLocaleString()}</strong> contacts
              </span>
              <div className="d-flex align-items-center gap-1 ms-2">
                <label className="small text-muted mb-0">Rows:</label>
                <select
                  className="cnt-pagination-select"
                  value={contactsLimit}
                  onChange={(e) => {
                    setContactsLimit(Number(e.target.value));
                    setContactsPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="cnt-pagination-buttons">
              <button
                type="button"
                className="cnt-btn-page"
                disabled={contactsPage <= 1}
                onClick={() => setContactsPage(p => Math.max(1, p - 1))}
                title="Previous Page"
              >
                <i className="bi bi-chevron-left me-1"></i> Prev
              </button>

              {getPageNumbers(contactsPagination.page, contactsPagination.totalPages).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`cnt-btn-page ${p === contactsPagination.page ? 'active' : ''}`}
                  onClick={() => setContactsPage(p)}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className="cnt-btn-page"
                disabled={contactsPage >= contactsPagination.totalPages}
                onClick={() => setContactsPage(p => Math.min(contactsPagination.totalPages, p + 1))}
                title="Next Page"
              >
                Next <i className="bi bi-chevron-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>

        {/* 5. Imported Excel & CSV Files Section with Pagination (Hidden for Support Agents) */}
        {!isAgent && (
          <div className="cnt-table-card mb-4">
            <div className="cnt-table-header-row">
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem'
                }}
              >
                <i className="bi bi-file-earmark-spreadsheet-fill"></i>
              </div>
              <div>
                <h5 className="cnt-table-title">Imported Excel & CSV Files ({importPagination.total.toLocaleString()})</h5>
                <span className="cnt-table-subtext">Background ingestion history, batch tags, audit logs, and rollback controls</span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={fetchImportJobs}
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                title="Refresh Imports History"
              >
                <i className="bi bi-arrow-clockwise"></i>
                <span className="d-none d-sm-inline">Refresh</span>
              </button>

              <Link
                to="/imports"
                className="btn btn-sm btn-success d-inline-flex align-items-center gap-1 fw-semibold px-3"
                title="Upload New Excel or CSV File"
              >
                <i className="bi bi-cloud-arrow-up-fill"></i>
                <span>Upload Excel / CSV</span>
              </Link>
            </div>
          </div>

          <div className="table-responsive">
            <table className="cnt-table align-middle">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Format</th>
                  <th>Batch Tag</th>
                  <th>Total Rows</th>
                  <th>Imported / Updated</th>
                  <th>Failed / Ineligible</th>
                  <th>Status</th>
                  <th>Upload Date</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {importLoading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-5">
                      <div className="spinner-border text-success" role="status"></div>
                      <div className="text-muted small mt-2">Loading import history...</div>
                    </td>
                  </tr>
                ) : importJobs.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-5 text-muted">
                      No Excel or CSV files imported yet. Click <strong>"Upload Excel / CSV"</strong> above to ingest up to 100,000 contacts.
                    </td>
                  </tr>
                ) : (
                  importJobs.map((job) => {
                    const isXlsx = job.file_type === 'xlsx' || (job.file_name && job.file_name.endsWith('.xlsx'));
                    return (
                      <tr key={job.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <i className={`bi ${isXlsx ? 'bi-file-earmark-excel-fill text-success' : 'bi-file-earmark-text-fill text-primary'} fs-5`}></i>
                            <div>
                              <div className="fw-bold text-dark">{job.file_name}</div>
                              <div className="text-muted small">Job #{job.id}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${isXlsx ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'} uppercase`}>
                            {job.file_type ? job.file_type.toUpperCase() : (isXlsx ? 'XLSX' : 'CSV')}
                          </span>
                        </td>
                        <td>
                          {job.options?.batchTag ? (
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1">
                              <i className="bi bi-tag-fill" style={{ fontSize: '10px' }}></i>
                              <span>{job.options.batchTag}</span>
                            </span>
                          ) : (
                            <span className="text-muted small fst-italic">No tag</span>
                          )}
                        </td>
                        <td>
                          <strong>{Number(job.total_rows || 0).toLocaleString()}</strong>
                        </td>
                        <td>
                          <span className="text-success fw-bold">
                            {Number(job.successful_rows || 0).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          {Number(job.failed_rows || 0) > 0 ? (
                            <span className="text-danger fw-bold">
                              {Number(job.failed_rows).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted small">0</span>
                          )}
                        </td>
                        <td>
                          {job.status === 'processing' ? (
                            <span className="badge bg-primary d-inline-flex align-items-center gap-1">
                              <span className="spinner-border spinner-border-sm" style={{ width: '10px', height: '10px' }} role="status"></span>
                              Processing ({job.processed_rows || 0}/{job.total_rows || 0})
                            </span>
                          ) : job.status === 'pending' ? (
                            <span className="badge bg-secondary d-inline-flex align-items-center gap-1">
                              <i className="bi bi-clock"></i> Queued
                            </span>
                          ) : job.status === 'completed' ? (
                            <span className="badge bg-success">
                              <i className="bi bi-check-circle me-1"></i> Completed
                            </span>
                          ) : job.status === 'cancelled' ? (
                            <span className="badge bg-secondary">Cancelled</span>
                          ) : (
                            <span className="badge bg-danger">
                              <i className="bi bi-x-circle me-1"></i> Failed
                            </span>
                          )}
                        </td>
                        <td className="text-muted small">
                          {job.created_at ? new Date(job.created_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="text-end">
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            {/* Change Tag button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditTag(job)}
                              className="btn btn-sm btn-outline-secondary p-1 px-2"
                              title="Change / Assign Tag to this Import"
                            >
                              <i className="bi bi-tag-fill me-1"></i>
                              <span className="small">Tag</span>
                            </button>

                            {/* Error report button if failures exist */}
                            {Number(job.failed_rows || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => handleDownloadErrorReport(job.id)}
                                className="btn btn-sm btn-outline-danger p-1 px-2"
                                title="Download Ineligible / Error Rows CSV"
                              >
                                <i className="bi bi-download me-1"></i>
                                <span className="small">Errors</span>
                              </button>
                            )}

                            {/* Delete import button (Only Owner / Super Admin) */}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTargetJob(job);
                                  setAlsoDeleteContacts(false);
                                }}
                                className="btn btn-sm btn-outline-danger p-1 px-2"
                                title="Delete Import Job & Rollback Contacts"
                              >
                                <i className="bi bi-trash3"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Imported Files Pagination Footer */}
          <div className="cnt-pagination-footer">
            <div className="cnt-pagination-left">
              <span>
                Showing <strong>{importsStart}</strong> to <strong>{importsEnd}</strong> of <strong>{importPagination.total.toLocaleString()}</strong> files
              </span>
              <div className="d-flex align-items-center gap-1 ms-2">
                <label className="small text-muted mb-0">Rows:</label>
                <select
                  className="cnt-pagination-select"
                  value={importLimit}
                  onChange={(e) => {
                    setImportLimit(Number(e.target.value));
                    setImportPage(1);
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
            </div>

            <div className="cnt-pagination-buttons">
              <button
                type="button"
                className="cnt-btn-page"
                disabled={importPage <= 1}
                onClick={() => setImportPage(p => Math.max(1, p - 1))}
                title="Previous Page"
              >
                <i className="bi bi-chevron-left me-1"></i> Prev
              </button>

              {getPageNumbers(importPagination.page, importPagination.totalPages).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`cnt-btn-page ${p === importPagination.page ? 'active' : ''}`}
                  onClick={() => setImportPage(p)}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className="cnt-btn-page"
                disabled={importPage >= importPagination.totalPages}
                onClick={() => setImportPage(p => Math.min(importPagination.totalPages, p + 1))}
                title="Next Page"
              >
                Next <i className="bi bi-chevron-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Change Past Import Tag Modal */}
        {editTagTargetJob && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-tag-fill text-primary"></i>
                    <span>Change Past Import Tag</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    disabled={updatingTag}
                    onClick={() => setEditTagTargetJob(null)}
                  ></button>
                </div>
                <form onSubmit={handleSaveEditTag}>
                  <div className="modal-body p-4">
                    <div className="p-3 bg-light rounded-3 mb-3 small border">
                      <div><strong>File Name:</strong> {editTagTargetJob.file_name}</div>
                      <div><strong>Current Tag:</strong> <span className="badge bg-secondary ms-1">{editTagTargetJob.options?.batchTag || 'None'}</span></div>
                      <div><strong>Total Contacts:</strong> {Number(editTagTargetJob.successful_rows || editTagTargetJob.total_rows || 0).toLocaleString()}</div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-dark">Naya Tag Select Karein ya Type Karein</label>
                      <input
                        type="text"
                        className="form-control mb-2"
                        placeholder="e.g. Festive_Offer, High_Value, November_Leads"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        autoFocus
                        required
                      />

                      {tags && tags.length > 0 && (
                        <div>
                          <div className="text-muted small mb-1">Existing Tags (Click to select):</div>
                          <div className="d-flex flex-wrap gap-1">
                            {tags.slice(0, 15).map(t => (
                              <button
                                key={t.id || t.name}
                                type="button"
                                onClick={() => setNewTagInput(t.name)}
                                className={`badge border text-decoration-none ${newTagInput.toLowerCase() === t.name.toLowerCase() ? 'bg-primary text-white border-primary' : 'bg-light text-dark border-secondary-subtle'}`}
                                style={{ cursor: 'pointer' }}
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {editTagTargetJob.options?.batchTag && (
                      <div className="form-check p-3 bg-light rounded-2 border">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="replaceOldTagCheck"
                          checked={replaceOldTagOnContacts}
                          onChange={(e) => setReplaceOldTagOnContacts(e.target.checked)}
                        />
                        <label className="form-check-label small text-dark" htmlFor="replaceOldTagCheck">
                          Purana Tag (<code>{editTagTargetJob.options.batchTag}</code>) contacts se hata kar naya tag lagayein (Replace Tag)
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="modal-footer border-top bg-light">
                    <button
                      type="button"
                      className="btn btn-secondary rounded-3"
                      disabled={updatingTag}
                      onClick={() => setEditTagTargetJob(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updatingTag || !newTagInput.trim()}
                      className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-1"
                    >
                      {updatingTag ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Updating Contacts...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check2"></i>
                          <span>Save & Update Tag</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Import Job Modal */}
        {deleteTargetJob && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-bold text-danger d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    <span>Delete Import File Record</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    disabled={deletingJob}
                    onClick={() => setDeleteTargetJob(null)}
                  ></button>
                </div>
                <div className="modal-body p-4">
                  <p className="text-dark mb-3">
                    Kya aap <strong>"{deleteTargetJob.file_name}"</strong> (Job #{deleteTargetJob.id}) ko import history se delete karna chahte hain?
                  </p>

                  <div className="form-check p-3 bg-danger-subtle rounded-3 border border-danger-subtle mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="alsoDeleteContactsCheck"
                      checked={alsoDeleteContacts}
                      onChange={(e) => setAlsoDeleteContacts(e.target.checked)}
                    />
                    <label className="form-check-label text-dark small fw-semibold" htmlFor="alsoDeleteContactsCheck">
                      Is file se import hue saare contacts bhi Contacts list se delete karein (Rollback Contacts)
                    </label>
                    <div className="text-muted small mt-1" style={{ fontSize: '0.78rem' }}>
                      Agarka box uncheck rahega to sirf import queue ka record delete hoga, contacts database me surakshit rahenge.
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary rounded-3"
                    disabled={deletingJob}
                    onClick={() => setDeleteTargetJob(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deletingJob}
                    onClick={handleConfirmDeleteJob}
                    className="btn btn-danger rounded-3 d-inline-flex align-items-center gap-1"
                  >
                    {deletingJob ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-trash3-fill"></i>
                        <span>Confirm Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Single Contact Modal */}
        {showAddModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-bold">Add Single Contact</h5>
                  <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
                </div>
                <form onSubmit={handleCreateContact}>
                  <div className="modal-body p-4">
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Mobile Phone (e.g. 9876543210)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="9876543210 or +919876543210"
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        required
                      />
                      <div className="form-text small">Automatically normalized to standard E.164 format.</div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Customer Full Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Vikram Malhotra"
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Email Address (Optional)</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="vikram@example.com"
                        value={newContact.email}
                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-danger">Compliance Consent Evidence *</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={newContact.consentProof}
                        onChange={(e) => setNewContact({ ...newContact, consentProof: e.target.value })}
                        required
                      ></textarea>
                      <div className="form-text text-muted small">
                        WhatsApp rules require explicit consent evidence (e.g., website opt-in checkbox, store loyalty card).
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer border-top bg-light">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="btn btn-cf-primary">
                      {submitting ? 'Saving...' : 'Add & Verify Consent'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
