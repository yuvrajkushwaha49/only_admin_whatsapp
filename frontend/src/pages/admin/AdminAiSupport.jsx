import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import '../../styles/adminDashboard.css';

export default function AdminAiSupport() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [kbStatus, setKbStatus] = useState(null);
  const [settings, setSettings] = useState({
    ai_chat_enabled: 'true',
    gemini_model: 'gemini-1.5-flash',
    ai_temperature: '0.3',
    ai_max_tokens: '1000',
    rate_limit_per_minute: '20',
    has_gemini_key: false
  });
  const [reindexing, setReindexing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedConvMessages, setSelectedConvMessages] = useState([]);
  const [convModalLoading, setConvModalLoading] = useState(false);
  const [searchConv, setSearchConv] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, convsRes, kbRes, settingsRes] = await Promise.all([
        api.get('/ai/admin/analytics?timeRange=30d').catch(() => ({ data: {} })),
        api.get('/ai/admin/conversations?limit=30').catch(() => ({ data: {} })),
        api.get('/ai/admin/knowledge-base/status').catch(() => ({ data: {} })),
        api.get('/ai/admin/settings').catch(() => ({ data: {} }))
      ]);

      if (analyticsRes.data?.success) setAnalytics(analyticsRes.data);
      if (convsRes.data?.success) setConversations(convsRes.data.conversations || []);
      if (kbRes.data?.success) setKbStatus(kbRes.data.status || {});
      if (settingsRes.data?.success) setSettings(settingsRes.data.settings || {});
    } catch (err) {
      console.error('Failed to load AI Admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGlobalAi = async () => {
    const nextVal = settings.ai_chat_enabled === 'true' ? 'false' : 'true';
    try {
      await api.post('/ai/admin/settings', { ai_chat_enabled: nextVal });
      setSettings(prev => ({ ...prev, ai_chat_enabled: nextVal }));
      setStatusMessage({ type: 'success', text: `AI Support Assistant ${nextVal === 'true' ? 'enabled' : 'disabled'} globally.` });
    } catch (err) {
      setStatusMessage({ type: 'danger', text: 'Failed to update AI status.' });
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setStatusMessage(null);
    try {
      await api.post('/ai/admin/settings', settings);
      setStatusMessage({ type: 'success', text: 'AI configuration settings saved successfully.' });
    } catch (err) {
      setStatusMessage({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to save settings.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReindexKnowledgeBase = async () => {
    setReindexing(true);
    setStatusMessage(null);
    try {
      const res = await api.post('/ai/admin/knowledge-base/reindex');
      if (res.data?.success) {
        setStatusMessage({
          type: 'success',
          text: `Knowledge Base indexed successfully! (${res.data.indexedFiles} documents, ${res.data.totalChunks} chunks)`
        });
        const kbRes = await api.get('/ai/admin/knowledge-base/status');
        if (kbRes.data?.success) setKbStatus(kbRes.data.status);
      }
    } catch (err) {
      setStatusMessage({ type: 'danger', text: 'Failed to re-index knowledge base.' });
    } finally {
      setReindexing(false);
    }
  };

  const handleInspectConversation = async (conv) => {
    setSelectedConversation(conv);
    setConvModalLoading(true);
    try {
      const res = await api.get(`/ai/conversations/${conv.id}`);
      if (res.data?.success) {
        setSelectedConvMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch conversation messages:', err);
    } finally {
      setConvModalLoading(false);
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchConv) return true;
    const s = searchConv.toLowerCase();
    return (
      (c.conversation_title && c.conversation_title.toLowerCase().includes(s)) ||
      (c.business_name && c.business_name.toLowerCase().includes(s)) ||
      (c.user_name && c.user_name.toLowerCase().includes(s))
    );
  });

  const summary = analytics?.summary || {};

  return (
    <div className="admin-page-container p-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-robot text-primary"></i>
            <span>AI Support Assistant Center</span>
          </h2>
          <p className="text-muted mb-0">
            Monitor conversations, knowledge base indexing, usage costs, and configure Google Gemini settings.
          </p>
        </div>

        {/* Global Chatbot Switch */}
        <div className="d-flex align-items-center gap-3 bg-white p-2 px-3 rounded-3 shadow-sm border">
          <div className="d-flex align-items-center gap-2">
            <span className={`badge ${settings.ai_chat_enabled === 'true' ? 'bg-success' : 'bg-secondary'}`}>
              {settings.ai_chat_enabled === 'true' ? 'ACTIVE' : 'DISABLED'}
            </span>
            <span className="small fw-semibold text-dark">Global AI Support</span>
          </div>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={settings.ai_chat_enabled === 'true'}
              onChange={handleToggleGlobalAi}
              style={{ cursor: 'pointer', width: '2.4em', height: '1.2em' }}
            />
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={`alert alert-${statusMessage.type} alert-dismissible fade show`} role="alert">
          {statusMessage.text}
          <button type="button" className="btn-close" onClick={() => setStatusMessage(null)}></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs admin-custom-tabs mb-4">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="bi bi-speedometer2 me-2"></i> Overview & KPIs
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'conversations' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversations')}
          >
            <i className="bi bi-chat-left-dots me-2"></i> Conversations ({conversations.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'knowledge' ? 'active' : ''}`}
            onClick={() => setActiveTab('knowledge')}
          >
            <i className="bi bi-book me-2"></i> Knowledge Base ({kbStatus?.totalDocuments || 0})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <i className="bi bi-gear-fill me-2"></i> AI & Model Settings
          </button>
        </li>
      </ul>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted mt-2">Loading AI Support Center...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              {/* KPI Stat Cards */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="text-muted small fw-semibold">Total Conversations</span>
                      <div className="rounded-circle bg-primary-subtle p-2 text-primary">
                        <i className="bi bi-chat-text fs-5"></i>
                      </div>
                    </div>
                    <h3 className="fw-bold mb-0">{summary.totalConversations || 0}</h3>
                    <span className="small text-muted mt-1">Across all client workspaces</span>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="text-muted small fw-semibold">Total AI Requests</span>
                      <div className="rounded-circle bg-success-subtle p-2 text-success">
                        <i className="bi bi-cpu fs-5"></i>
                      </div>
                    </div>
                    <h3 className="fw-bold mb-0">{summary.totalRequests || 0}</h3>
                    <span className="small text-success mt-1">
                      {summary.successfulRequests || 0} Successful · {summary.blockedRequests || 0} Guarded
                    </span>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="text-muted small fw-semibold">Estimated Cost (USD)</span>
                      <div className="rounded-circle bg-warning-subtle p-2 text-warning">
                        <i className="bi bi-currency-dollar fs-5"></i>
                      </div>
                    </div>
                    <h3 className="fw-bold mb-0">${summary.totalEstimatedCost || '0.0000'}</h3>
                    <span className="small text-muted mt-1">
                      {summary.totalTokens ? (summary.totalTokens / 1000).toFixed(1) + 'k' : '0'} Tokens Used
                    </span>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="text-muted small fw-semibold">Helpful Feedback</span>
                      <div className="rounded-circle bg-info-subtle p-2 text-info">
                        <i className="bi bi-hand-thumbs-up fs-5"></i>
                      </div>
                    </div>
                    <h3 className="fw-bold mb-0">{summary.helpfulPercentage || 100}%</h3>
                    <span className="small text-muted mt-1">Client satisfaction rating</span>
                  </div>
                </div>
              </div>

              {/* Status Overview Grid */}
              <div className="row g-4">
                <div className="col-12 col-lg-6">
                  <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-shield-check text-success"></i>
                      <span>AI Service Readiness & Health</span>
                    </h5>
                    <ul className="list-group list-group-flush">
                      <li className="list-group-item px-0 d-flex justify-content-between align-items-center">
                        <span>Google Gemini Provider:</span>
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                          Connected (Official SDK)
                        </span>
                      </li>
                      <li className="list-group-item px-0 d-flex justify-content-between align-items-center">
                        <span>Active AI Model:</span>
                        <code>{settings.gemini_model || 'gemini-1.5-flash'}</code>
                      </li>
                      <li className="list-group-item px-0 d-flex justify-content-between align-items-center">
                        <span>Gemini API Key:</span>
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                          {settings.has_gemini_key ? 'Configured in Backend .env' : 'Fallback Synthesizer Active'}
                        </span>
                      </li>
                      <li className="list-group-item px-0 d-flex justify-content-between align-items-center">
                        <span>Knowledge Base Status:</span>
                        <span className="fw-semibold text-dark">
                          {kbStatus?.totalDocuments || 0} Documents ({kbStatus?.totalChunks || 0} Chunks)
                        </span>
                      </li>
                      <li className="list-group-item px-0 d-flex justify-content-between align-items-center">
                        <span>Avg AI Response Time:</span>
                        <span className="fw-semibold">{summary.avgResponseTimeMs || 0} ms</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-layers-fill text-primary"></i>
                      <span>Knowledge Base Topic Coverage</span>
                    </h5>
                    <div className="row g-2">
                      {kbStatus?.categories && kbStatus.categories.map((cat, i) => (
                        <div key={i} className="col-6">
                          <div className="p-2 border rounded-2 d-flex justify-content-between align-items-center bg-light">
                            <span className="text-capitalize small fw-semibold">{cat.category}</span>
                            <span className="badge bg-secondary">{cat.count} files</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                        onClick={handleReindexKnowledgeBase}
                        disabled={reindexing}
                      >
                        <i className={`bi bi-arrow-repeat ${reindexing ? 'spin' : ''}`}></i>
                        <span>{reindexing ? 'Re-indexing...' : 'Re-index Knowledge Base'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONVERSATIONS */}
          {activeTab === 'conversations' && (
            <div className="card border-0 shadow-sm rounded-3 bg-white p-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <h5 className="fw-bold mb-0">Customer Support Conversations</h5>
                <div style={{ maxWidth: '300px' }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search by title, business, user..."
                    value={searchConv}
                    onChange={(e) => setSearchConv(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>ID</th>
                      <th>Conversation Title</th>
                      <th>Business Workspace</th>
                      <th>User</th>
                      <th>Messages</th>
                      <th>Created At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConversations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-muted">
                          No conversations found.
                        </td>
                      </tr>
                    ) : (
                      filteredConversations.map((conv) => (
                        <tr key={conv.id}>
                          <td>#{conv.id}</td>
                          <td className="fw-semibold text-dark">{conv.conversation_title}</td>
                          <td>
                            <span className="badge bg-light text-dark border">
                              {conv.business_name || `Tenant #${conv.tenant_id}`}
                            </span>
                          </td>
                          <td>
                            <div className="small fw-semibold">{conv.user_name || 'User'}</div>
                            <div className="small text-muted">{conv.user_email}</div>
                          </td>
                          <td>
                            <span className="badge bg-secondary-subtle text-secondary">
                              {conv.message_count || 1} msgs
                            </span>
                          </td>
                          <td className="small text-muted">
                            {new Date(conv.created_at).toLocaleString()}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                              onClick={() => handleInspectConversation(conv)}
                            >
                              <i className="bi bi-eye"></i>
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: KNOWLEDGE BASE */}
          {activeTab === 'knowledge' && (
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
              <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                  <h5 className="fw-bold mb-1">Grounding Knowledge Base</h5>
                  <p className="text-muted small mb-0">
                    All markdown documentation files indexed for grounded search in <code>/backend/knowledge-base/</code>.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary d-flex align-items-center gap-2"
                  onClick={handleReindexKnowledgeBase}
                  disabled={reindexing}
                >
                  <i className={`bi bi-arrow-repeat ${reindexing ? 'spin' : ''}`}></i>
                  <span>{reindexing ? 'Indexing Documents...' : 'Re-index Knowledge Base Now'}</span>
                </button>
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-3 border">
                    <span className="text-muted small">Total Document Files</span>
                    <h3 className="fw-bold mb-0">{kbStatus?.totalDocuments || 0}</h3>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-3 border">
                    <span className="text-muted small">Total Indexed Chunks</span>
                    <h3 className="fw-bold mb-0">{kbStatus?.totalChunks || 0}</h3>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-3 border">
                    <span className="text-muted small">Last Full Indexing</span>
                    <h5 className="fw-bold mb-0 text-dark">
                      {kbStatus?.lastIndexedAt ? new Date(kbStatus.lastIndexedAt).toLocaleString() : 'Never'}
                    </h5>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h6 className="fw-bold mb-3">Indexed Category Breakdown</h6>
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Category</th>
                        <th>Documents</th>
                        <th>Search Engine Support</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kbStatus?.categories && kbStatus.categories.map((c, i) => (
                        <tr key={i}>
                          <td className="fw-semibold text-capitalize">{c.category}</td>
                          <td>{c.count} files</td>
                          <td>MySQL FULLTEXT + Token Search</td>
                          <td><span className="badge bg-success">Indexed</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4" style={{ maxWidth: '800px' }}>
              <h5 className="fw-bold mb-1">AI Assistant Configuration</h5>
              <p className="text-muted small mb-4">
                Tune Gemini model parameters, token boundaries, and request rate limits.
              </p>

              <form onSubmit={handleSaveSettings}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Gemini Model</label>
                  <select
                    className="form-select"
                    value={settings.gemini_model || 'gemini-1.5-flash'}
                    onChange={(e) => setSettings({ ...settings, gemini_model: e.target.value })}
                  >
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Cost-Efficient - Recommended)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (High Reasoning Capability)</option>
                    <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Experimental Next-Gen)</option>
                  </select>
                  <small className="text-muted">The official model used for processing customer queries.</small>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small">Creativity Temperature (0.0 to 1.0)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.0"
                      max="1.0"
                      className="form-control"
                      value={settings.ai_temperature || '0.3'}
                      onChange={(e) => setSettings({ ...settings, ai_temperature: e.target.value })}
                    />
                    <small className="text-muted">Lower values (0.2 - 0.4) ensure high factual precision.</small>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small">Max Output Tokens</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.ai_max_tokens || '1000'}
                      onChange={(e) => setSettings({ ...settings, ai_max_tokens: e.target.value })}
                    />
                    <small className="text-muted">Maximum token length per response.</small>
                  </div>
                </div>

                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small">Rate Limit (Requests per minute per user)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.rate_limit_per_minute || '20'}
                      onChange={(e) => setSettings({ ...settings, rate_limit_per_minute: e.target.value })}
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                    {savingSettings ? 'Saving...' : 'Save AI Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* Inspect Conversation Modal */}
      {selectedConversation && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title fw-bold">Conversation #{selectedConversation.id}</h5>
                  <span className="small text-muted">
                    {selectedConversation.business_name} ({selectedConversation.user_email})
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedConversation(null)}
                ></button>
              </div>
              <div className="modal-body bg-light">
                {convModalLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status"></div>
                  </div>
                ) : selectedConvMessages.length === 0 ? (
                  <p className="text-muted text-center py-4">No messages recorded in this conversation.</p>
                ) : (
                  selectedConvMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`d-flex mb-3 ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
                    >
                      <div
                        className={`p-3 rounded-3 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white text-dark'}`}
                        style={{ maxWidth: '80%' }}
                      >
                        <div className="small fw-bold opacity-75 mb-1">
                          {msg.role === 'user' ? 'User' : 'AI Support Assistant'} · {new Date(msg.createdAt).toLocaleTimeString()}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedConversation(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
