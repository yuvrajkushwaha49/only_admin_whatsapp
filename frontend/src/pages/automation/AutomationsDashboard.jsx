import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import NewAutomationModal from './NewAutomationModal';
import '../../styles/automations.css';

export default function AutomationsDashboard() {
  const navigate = useNavigate();

  const [automations, setAutomations] = useState([]);
  const [stats, setStats] = useState({
    totalAutomations: 0,
    publishedCount: 0,
    draftCount: 0,
    totalConversations: 0,
    totalCallbacks: 0
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadAutomations();
  }, [statusFilter]);

  const loadAutomations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/automations', {
        params: { search, status: statusFilter }
      });
      if (res.data?.success && res.data?.data) {
        setAutomations(res.data.data);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to load automations' });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAutomations();
  };

  const handleDuplicate = async (autoId) => {
    try {
      const res = await api.post(`/automations/${autoId}/duplicate`);
      if (res.data?.success && res.data?.data) {
        setFeedback({ type: 'success', message: 'Automation duplicated as draft.' });
        loadAutomations();
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to duplicate' });
    }
  };

  const handleTogglePause = async (autoId) => {
    try {
      const res = await api.post(`/automations/${autoId}/pause`);
      if (res.data?.success) {
        setFeedback({ type: 'info', message: res.data.message });
        loadAutomations();
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to toggle status' });
    }
  };

  const handleDelete = async (autoId, autoName) => {
    if (!window.confirm(`Are you sure you want to delete automation "${autoName}"?`)) return;

    try {
      const res = await api.delete(`/automations/${autoId}`);
      if (res.data?.success) {
        setFeedback({ type: 'success', message: 'Automation deleted.' });
        loadAutomations();
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to delete' });
    }
  };

  const handleCreated = (newAuto) => {
    setShowNewModal(false);
    navigate(`/automations/${newAuto.hashId || newAuto.id}/builder`);
  };

  return (
    <div className="automation-page-container">
      {/* 1. Hero Title Banner (Matching Aiveexa Brand Style) */}
      <div className="auto-hero-banner">
        <div className="auto-hero-left">
          <div className="auto-brand-square">
            <i className="bi bi-robot"></i>
          </div>
          <div>
            <h1 className="auto-hero-title">
              <span>Automation Messages</span>
              <span className="auto-role-tag">Live Bot Engine</span>
            </h1>
            <p className="auto-hero-subtitle">
              Automatic WhatsApp conversations that explain products, answer common questions, and collect call-back requests.
            </p>
          </div>
        </div>

        <div className="auto-hero-actions">
          <button
            type="button"
            className="btn btn-outline-secondary d-flex align-items-center gap-2"
            onClick={() => setShowHowItWorks(!showHowItWorks)}
          >
            <i className="bi bi-lightbulb text-warning"></i>
            <span>How This Works</span>
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary d-flex align-items-center gap-2"
            onClick={() => navigate('/products')}
            title="Browse Product Catalogue & Library"
          >
            <i className="bi bi-box-seam text-success"></i>
            <span>Product Library</span>
          </button>
          <button
            type="button"
            className="btn-emerald-brand"
            onClick={() => setShowNewModal(true)}
          >
            <i className="bi bi-plus-lg"></i>
            <span>New Automation</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Alert */}
      {feedback && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show d-flex align-items-center mb-4`} role="alert">
          <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2 fs-5`}></i>
          <div className="flex-grow-1">{feedback.message}</div>
          <button type="button" className="btn-close" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {/* 2. Expandable Info Panel */}
      {showHowItWorks && (
        <div className="auto-how-it-works-card">
          <div className="auto-how-it-works-toggle" onClick={() => setShowHowItWorks(!showHowItWorks)}>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-lightbulb-fill text-warning"></i>
              <span className="fw-bold">How Conversational WhatsApp Automation Works</span>
            </div>
            <i className="bi bi-chevron-up"></i>
          </div>

          <div className="auto-how-it-works-content">
            <p className="mb-2">
              Automations respond immediately whenever a customer triggers your keyword (e.g. <code>menu</code>, <code>price</code>) or taps a button from your campaign broadcast.
            </p>
            <div className="auto-how-it-works-steps">
              <div className="auto-hiw-step-box">
                <div className="auto-hiw-step-num">Step 1: Triggers</div>
                <div>Customer sends a matching keyword or taps an interactive campaign button.</div>
              </div>
              <div className="auto-hiw-step-box">
                <div className="auto-hiw-step-num">Step 2: Guided Chat</div>
                <div>Your bot sends sequential interactive messages with quick reply options.</div>
              </div>
              <div className="auto-hiw-step-box">
                <div className="auto-hiw-step-num">Step 3: Call Back & Handover</div>
                <div>Unexpected replies trigger a callback offer, or seamless transfer to human team.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Four KPI Metric Cards (Matching wa-kpi-grid & ib-kpi-grid) */}
      <div className="auto-kpi-grid">
        <div className="auto-kpi-card">
          <div className="auto-kpi-icon-circle green">
            <i className="bi bi-send-check-fill"></i>
          </div>
          <div className="auto-kpi-info">
            <span className="auto-kpi-value">{stats.publishedCount || 0}</span>
            <span className="auto-kpi-label">Published Live</span>
          </div>
        </div>

        <div className="auto-kpi-card">
          <div className="auto-kpi-icon-circle purple">
            <i className="bi bi-file-earmark-code-fill"></i>
          </div>
          <div className="auto-kpi-info">
            <span className="auto-kpi-value">{stats.draftCount || 0}</span>
            <span className="auto-kpi-label">Draft Flows</span>
          </div>
        </div>

        <div className="auto-kpi-card">
          <div className="auto-kpi-icon-circle blue">
            <i className="bi bi-chat-dots-fill"></i>
          </div>
          <div className="auto-kpi-info">
            <span className="auto-kpi-value">{stats.totalConversations || 0}</span>
            <span className="auto-kpi-label">Conversations Handled</span>
          </div>
        </div>

        <div className="auto-kpi-card">
          <div className="auto-kpi-icon-circle amber">
            <i className="bi bi-telephone-inbound-fill"></i>
          </div>
          <div className="auto-kpi-info">
            <span className="auto-kpi-value">{stats.totalCallbacks || 0}</span>
            <span className="auto-kpi-label">Callback Leads</span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      <div className="auto-filter-bar">
        <form onSubmit={handleSearchSubmit} className="auto-search-box">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="auto-search-input"
            placeholder="Search automations by name or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <div className="auto-filter-tabs">
          <button
            type="button"
            className={`auto-tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Automations
            <span className="badge bg-light text-dark ms-1">{automations.length}</span>
          </button>
          <button
            type="button"
            className={`auto-tab-btn ${statusFilter === 'published' ? 'active' : ''}`}
            onClick={() => setStatusFilter('published')}
          >
            <i className="bi bi-check-circle me-1"></i>
            Published
          </button>
          <button
            type="button"
            className={`auto-tab-btn ${statusFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setStatusFilter('draft')}
          >
            <i className="bi bi-pencil-square me-1"></i>
            Drafts
          </button>
          <button
            type="button"
            className={`auto-tab-btn ${statusFilter === 'paused' ? 'active' : ''}`}
            onClick={() => setStatusFilter('paused')}
          >
            <i className="bi bi-pause-circle me-1"></i>
            Paused
          </button>
        </div>
      </div>

      {/* 5. Main Automations Table Card */}
      <div className="auto-content-card">
        <div className="table-responsive">
          <table className="table auto-table align-middle mb-0">
            <thead className="auto-table-head">
              <tr>
                <th className="ps-4">Automation Name</th>
                <th>Status</th>
                <th>Starts With (Triggers)</th>
                <th>Conversations</th>
                <th>Callbacks</th>
                <th>Updated</th>
                <th className="pe-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2 text-success" role="status"></span>
                    Loading automations...
                  </td>
                </tr>
              ) : automations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <div className="text-muted mb-3">
                      <i className="bi bi-robot display-4 opacity-50"></i>
                    </div>
                    <h5 className="fw-bold text-dark mb-1">No automations found</h5>
                    <p className="text-muted small mb-3 max-w-md mx-auto" style={{ maxWidth: '420px' }}>
                      {search || statusFilter !== 'ALL'
                        ? 'No automations match your search filter. Try clearing filters.'
                        : 'Create your first automated WhatsApp workflow to guide customers and generate leads.'}
                    </p>
                    <button
                      type="button"
                      className="btn-emerald-brand btn-sm"
                      onClick={() => setShowNewModal(true)}
                    >
                      <i className="bi bi-plus-lg me-1"></i> Create Automation
                    </button>
                  </td>
                </tr>
              ) : (
                automations.map((auto) => {
                  const keywords = auto.triggers?.keywords || [];
                  const updatedDate = auto.updated_at ? new Date(auto.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

                  return (
                    <tr key={auto.id}>
                      <td className="ps-4">
                        <div
                          className="fw-bold text-dark text-decoration-none"
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/automations/${auto.hashId || auto.id}/builder`)}
                        >
                          {auto.name}
                        </div>
                        {auto.purpose && (
                          <div className="text-muted text-truncate small" style={{ maxWidth: '300px', fontSize: '0.785rem' }}>
                            {auto.purpose}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className={`auto-status-pill ${auto.status}`}>
                          {auto.status === 'published' ? '● Published' : auto.status === 'paused' ? '⏸ Paused' : '○ Draft'}
                        </span>
                      </td>

                      <td>
                        {keywords.length > 0 ? (
                          <span className="badge bg-light text-dark border small">
                            <i className="bi bi-chat-text text-muted me-1"></i>
                            {keywords.slice(0, 2).join(', ')}
                            {keywords.length > 2 && ` +${keywords.length - 2} more`}
                          </span>
                        ) : auto.triggers?.buttonId ? (
                          <span className="badge bg-light text-dark border small">
                            <i className="bi bi-grid text-warning me-1"></i> Button #{auto.triggers.buttonId}
                          </span>
                        ) : (
                          <span className="text-muted small">No trigger</span>
                        )}
                      </td>

                      <td className="fw-semibold text-dark">
                        {auto.total_conversations || 0}
                      </td>

                      <td className="fw-semibold text-success">
                        {auto.total_callbacks || 0}
                      </td>

                      <td className="text-muted small">
                        {updatedDate}
                      </td>

                      <td className="pe-4 text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => navigate(`/automations/${auto.hashId || auto.id}/builder`)}
                            title="Edit Automation"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => handleDuplicate(auto.id)}
                            title="Duplicate"
                          >
                            <i className="bi bi-copy"></i>
                          </button>

                          {auto.status === 'published' ? (
                            <button
                              type="button"
                              className="btn btn-outline-warning"
                              onClick={() => handleTogglePause(auto.id)}
                              title="Pause"
                            >
                              <i className="bi bi-pause-fill"></i>
                            </button>
                          ) : auto.status === 'paused' ? (
                            <button
                              type="button"
                              className="btn btn-outline-success"
                              onClick={() => handleTogglePause(auto.id)}
                              title="Resume"
                            >
                              <i className="bi bi-play-fill"></i>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={() => handleDelete(auto.id, auto.name)}
                            title="Delete"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Automation Modal */}
      <NewAutomationModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
