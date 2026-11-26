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
    <div className="automation-container">
      {/* Page Header */}
      <div className="automation-header">
        <div>
          <h1 className="automation-title">
            <i className="bi bi-robot text-success"></i> Automation messages
          </h1>
          <p className="automation-subtitle">
            Automatic WhatsApp conversations that explain products, answer common questions and collect call-back requests.
          </p>
        </div>

        <div className="automation-actions">
          <button
            type="button"
            className="btn btn-outline-secondary d-flex align-items-center gap-2"
            onClick={() => navigate('/products')}
            title="Browse Product Catalogue & Library"
          >
            <i className="bi bi-box-seam text-success"></i> Product Library
          </button>

          <button
            type="button"
            className="btn btn-emerald"
            onClick={() => setShowNewModal(true)}
          >
            <i className="bi bi-plus-lg"></i> New Automation
          </button>
        </div>
      </div>

      {/* Global Feedback Alert */}
      {feedback && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show py-2 small d-flex align-items-center justify-content-between mb-4`} role="alert">
          <div>
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'} me-2`}></i>
            {feedback.message}
          </div>
          <button type="button" className="btn-close py-2" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {/* How This Works Expandable Panel */}
      <div className="how-it-works-card">
        <div className="how-it-works-toggle" onClick={() => setShowHowItWorks(!showHowItWorks)}>
          <span>
            <i className="bi bi-lightbulb-fill text-warning me-2"></i>
            How This Works — Conversational WhatsApp Automation Guide
          </span>
          <i className={`bi ${showHowItWorks ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
        </div>

        {showHowItWorks && (
          <div className="how-it-works-content">
            <p className="mb-2">
              Automations respond immediately whenever a customer triggers your keyword (e.g. <code>menu</code>, <code>price</code>) or taps a button from your campaign broadcast.
            </p>
            <div className="how-it-works-steps">
              <div className="hiw-step-box">
                <div className="hiw-step-num">Step 1: Triggers</div>
                <div>Customer sends a matching keyword or taps an interactive campaign button.</div>
              </div>
              <div className="hiw-step-box">
                <div className="hiw-step-num">Step 2: Guided Chat</div>
                <div>Your bot sends sequential interactive messages with quick reply options.</div>
              </div>
              <div className="hiw-step-box">
                <div className="hiw-step-num">Step 3: Call Back & Handover</div>
                <div>Unexpected replies trigger a callback offer, or seamless transfer to human team.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Automation Usage Stats Grid */}
      <div className="automation-stats-grid">
        <div className="auto-stat-card">
          <div className="auto-stat-icon bg-success-subtle text-success">
            <i className="bi bi-send-check"></i>
          </div>
          <div>
            <div className="auto-stat-val">{stats.publishedCount || 0}</div>
            <div className="auto-stat-label">Published Live</div>
          </div>
        </div>

        <div className="auto-stat-card">
          <div className="auto-stat-icon bg-light text-secondary">
            <i className="bi bi-file-earmark"></i>
          </div>
          <div>
            <div className="auto-stat-val">{stats.draftCount || 0}</div>
            <div className="auto-stat-label">Drafts</div>
          </div>
        </div>

        <div className="auto-stat-card">
          <div className="auto-stat-icon bg-primary-subtle text-primary">
            <i className="bi bi-chat-left-dots"></i>
          </div>
          <div>
            <div className="auto-stat-val">{stats.totalConversations || 0}</div>
            <div className="auto-stat-label">Conversations Handled</div>
          </div>
        </div>

        <div className="auto-stat-card">
          <div className="auto-stat-icon bg-warning-subtle text-warning">
            <i className="bi bi-telephone-inbound"></i>
          </div>
          <div>
            <div className="auto-stat-val">{stats.totalCallbacks || 0}</div>
            <div className="auto-stat-label">Callbacks Generated</div>
          </div>
        </div>
      </div>

      {/* Automations Table Card */}
      <div className="automations-table-card">
        {/* Table Toolbar */}
        <div className="table-toolbar">
          <form onSubmit={handleSearchSubmit} className="search-input-wrap">
            <i className="bi bi-search"></i>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search automations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <div className="d-flex align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>

        {/* Automations Listing Table */}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.875rem' }}>
            <thead className="table-light">
              <tr>
                <th className="ps-4">Automation Name</th>
                <th>Status</th>
                <th>Starts With</th>
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
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Loading automations...
                  </td>
                </tr>
              ) : automations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <i className="bi bi-robot text-muted fs-1 d-block mb-2"></i>
                    <h6 className="fw-bold text-dark mb-1">No automations found</h6>
                    <p className="text-muted small mb-3">
                      Create your first automated WhatsApp workflow to guide customers and generate leads.
                    </p>
                    <button
                      type="button"
                      className="btn btn-emerald btn-sm"
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
                          className="fw-bold text-dark text-decoration-none cursor-pointer"
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/automations/${auto.hashId || auto.id}/builder`)}
                        >
                          {auto.name}
                        </div>
                        {auto.purpose && (
                          <div className="text-muted text-truncate small" style={{ maxWidth: '300px', fontSize: '0.775rem' }}>
                            {auto.purpose}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className={`status-badge ${auto.status}`}>
                          {auto.status === 'published' ? '🟢 Published' : auto.status === 'paused' ? '⏸️ Paused' : '⚪ Draft'}
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
