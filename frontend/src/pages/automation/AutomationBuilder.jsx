import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import HowItStartsTab from './tabs/HowItStartsTab';
import MessagesBuilderTab from './tabs/MessagesBuilderTab';
import FallbackCallbackTab from './tabs/FallbackCallbackTab';
import ReviewPublishTab from './tabs/ReviewPublishTab';
import ResultsTab from './tabs/ResultsTab';
import '../../styles/automations.css';

export default function AutomationBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('messages');
  const [automation, setAutomation] = useState(null);
  const [definition, setDefinition] = useState({
    triggers: { keywords: ['menu'], buttonId: null },
    steps: [],
    fallback: {}
  });

  const [whatsappAccounts, setWhatsappAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadAutomationData();
    loadAccounts();
  }, [id]);

  const loadAutomationData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/automations/${id}`);
      if (res.data?.success && res.data?.data) {
        const auto = res.data.data;
        setAutomation(auto);
        if (auto.draft_definition) {
          setDefinition(auto.draft_definition);
        }
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to load automation' });
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get('/whatsapp/accounts');
      if (res.data?.success && res.data?.data) {
        setWhatsappAccounts(res.data.data.accounts || res.data.data || []);
      }
    } catch (_) {}
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.put(`/automations/${id}`, {
        name: automation.name,
        purpose: automation.purpose,
        whatsappAccountId: automation.whatsapp_account_id,
        definition
      });
      if (res.data?.success) {
        setAutomation(res.data.data);
        setFeedback({ type: 'success', message: 'Draft saved successfully!' });
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to save draft' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setFeedback(null);
    try {
      // 1. Save draft changes first
      await api.put(`/automations/${id}`, {
        name: automation.name,
        purpose: automation.purpose,
        whatsappAccountId: automation.whatsapp_account_id,
        definition
      });

      // 2. Publish
      const res = await api.post(`/automations/${id}/publish`);
      if (res.data?.success) {
        setAutomation(res.data.data);
        setFeedback({ type: 'success', message: res.data.message || 'Automation published successfully!' });
        setActiveTab('results');
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to publish automation' });
    } finally {
      setPublishing(false);
    }
  };

  const handlePauseToggle = async () => {
    try {
      const res = await api.post(`/automations/${id}/pause`);
      if (res.data?.success) {
        setAutomation(res.data.data);
        setFeedback({ type: 'info', message: res.data.message });
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to toggle pause status' });
    }
  };

  if (loading) {
    return (
      <div className="builder-wrapper align-items-center justify-content-center p-5">
        <div className="spinner-border text-success" role="status"></div>
        <div className="text-muted small mt-2">Loading Automation Builder...</div>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="builder-wrapper align-items-center justify-content-center p-5 text-center">
        <i className="bi bi-exclamation-circle text-danger fs-1 mb-2"></i>
        <h5 className="fw-bold">Automation Not Found</h5>
        <button className="btn btn-emerald mt-2" onClick={() => navigate('/automations')}>
          Back to Automations
        </button>
      </div>
    );
  }

  return (
    <div className="builder-wrapper">
      {/* Top Header Bar */}
      <div className="builder-topbar">
        <div className="builder-topbar-left">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm me-2"
            onClick={() => navigate('/automations')}
            title="Back to Automations List"
          >
            <i className="bi bi-arrow-left"></i>
          </button>

          <input
            type="text"
            className="builder-name-input"
            value={automation.name || ''}
            onChange={(e) => setAutomation({ ...automation, name: e.target.value })}
            placeholder="Automation Name"
          />

          <span className={`status-badge ${automation.status}`}>
            {automation.status === 'published' ? '🟢 Published' : automation.status === 'paused' ? '⏸️ Paused' : '⚪ Draft'}
          </span>
        </div>

        <div className="d-flex align-items-center gap-2">
          {automation.status === 'published' && (
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={handlePauseToggle}
            >
              <i className="bi bi-pause-fill me-1"></i> Pause
            </button>
          )}

          {automation.status === 'paused' && (
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={handlePauseToggle}
            >
              <i className="bi bi-play-fill me-1"></i> Resume
            </button>
          )}

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary px-3"
            onClick={handleSaveDraft}
            disabled={saving || publishing}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            type="button"
            className="btn btn-sm btn-emerald px-3"
            onClick={() => setActiveTab('review')}
            disabled={publishing}
          >
            <i className="bi bi-send-check-fill me-1"></i> Publish
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div className={`alert alert-${feedback.type} m-3 mb-0 alert-dismissible fade show py-2 small d-flex align-items-center justify-content-between`} role="alert">
          <div>
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'} me-2`}></i>
            {feedback.message}
          </div>
          <button type="button" className="btn-close py-2" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {/* 5 Navigation Tabs Bar */}
      <div className="builder-tabs-bar">
        <button
          type="button"
          className={`builder-tab-btn ${activeTab === 'starts' ? 'active' : ''}`}
          onClick={() => setActiveTab('starts')}
        >
          <i className="bi bi-lightning-charge"></i> 1. How It Starts
        </button>

        <button
          type="button"
          className={`builder-tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          <i className="bi bi-chat-dots"></i> 2. Messages
          <span className="badge bg-light text-muted border ms-1" style={{ fontSize: '0.7rem' }}>
            {(definition.steps || []).length}
          </span>
        </button>

        <button
          type="button"
          className={`builder-tab-btn ${activeTab === 'fallback' ? 'active' : ''}`}
          onClick={() => setActiveTab('fallback')}
        >
          <i className="bi bi-arrow-return-right"></i> 3. Fallback & Call Back
        </button>

        <button
          type="button"
          className={`builder-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          <i className="bi bi-clipboard-check"></i> 4. Review & Publish
        </button>

        <button
          type="button"
          className={`builder-tab-btn ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          <i className="bi bi-graph-up-arrow"></i> 5. Results
        </button>
      </div>

      {/* Active Tab Pane Component */}
      <div className="flex-grow-1 overflow-auto">
        {activeTab === 'starts' && (
          <HowItStartsTab
            definition={definition}
            onChange={setDefinition}
            whatsappAccounts={whatsappAccounts}
            currentAccountId={automation.whatsapp_account_id}
            onAccountChange={(accId) => setAutomation({ ...automation, whatsapp_account_id: accId })}
          />
        )}

        {activeTab === 'messages' && (
          <MessagesBuilderTab
            definition={definition}
            onChange={setDefinition}
          />
        )}

        {activeTab === 'fallback' && (
          <FallbackCallbackTab
            definition={definition}
            onChange={setDefinition}
          />
        )}

        {activeTab === 'review' && (
          <ReviewPublishTab
            automation={automation}
            definition={definition}
            onSaveDraft={handleSaveDraft}
            onPublish={handlePublish}
            saving={saving}
            publishing={publishing}
          />
        )}

        {activeTab === 'results' && (
          <ResultsTab automationId={automation.id} />
        )}
      </div>
    </div>
  );
}
