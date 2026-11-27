import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import AiwavoHeader from '../components/AiwavoHeader';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import '../styles/settings.css';

export default function Settings() {
  const { user, business, checkAuth } = useAuth();
  const isOwner = ['owner', 'superadmin'].includes((user?.role || '').toLowerCase());
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;

  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`;
  const [verifyToken, setVerifyToken] = useState('campaignflow_meta_verify_token_xyz');

  // Workspace Profile State
  const [workspaceForm, setWorkspaceForm] = useState({
    name: business?.name || '',
    timezone: business?.timezone || 'Asia/Kolkata'
  });
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  // Owner Meta Developer App Config State
  const [metaConfig, setMetaConfig] = useState({
    metaAppId: '',
    metaAppSecret: '',
    embeddedSignupConfigId: '',
    graphApiVersion: 'v21.0',
    webhookVerifyToken: 'campaignflow_secure_webhook_token_2026',
    isEnabled: true,
    useEnvFallback: true
  });
  const [metaStatus, setMetaStatus] = useState(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [testingMeta, setTestingMeta] = useState(false);
  const [metaTestResult, setMetaTestResult] = useState(null);

  useEffect(() => {
    setWorkspaceForm({
      name: business?.name || '',
      timezone: business?.timezone || 'Asia/Kolkata'
    });
  }, [business]);

  useEffect(() => {
    if (!isOwner) return;
    api.get('/meta/platform-config')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          const d = res.data.data;
          setMetaStatus(d);
          if (d.webhookVerifyToken) setVerifyToken(d.webhookVerifyToken);
          setMetaConfig({
            metaAppId: d.metaAppId || '',
            metaAppSecret: '',
            embeddedSignupConfigId: d.embeddedSignupConfigId || '',
            graphApiVersion: d.graphApiVersion || 'v21.0',
            webhookVerifyToken: d.webhookVerifyToken || 'campaignflow_secure_webhook_token_2026',
            isEnabled: d.isEnabled !== undefined ? d.isEnabled : true,
            useEnvFallback: d.useEnvFallback !== undefined ? d.useEnvFallback : true
          });
        }
      })
      .catch(() => {});
  }, [isOwner]);

  const handleSaveWorkspace = async (e) => {
    e.preventDefault();
    setSavingWorkspace(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.patch('/auth/workspace', workspaceForm);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: 'Workspace profile updated successfully!' });
        if (checkAuth) await checkAuth();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to update workspace profile.' });
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleSaveMetaConfig = async (e) => {
    e.preventDefault();
    setSavingMeta(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/meta/platform-config', metaConfig);
      if (res.data?.success) {
        setMetaStatus(res.data.data);
        if (res.data.data?.webhookVerifyToken) setVerifyToken(res.data.data.webhookVerifyToken);
        setMetaConfig((prev) => ({ ...prev, metaAppSecret: '' }));
        setFeedback({ type: 'success', text: 'Meta Developer App configuration saved and encrypted at rest!' });
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to save Meta configuration.' });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleTestMetaConnection = async () => {
    setTestingMeta(true);
    setMetaTestResult(null);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/meta/platform-config/test');
      setMetaTestResult(res.data?.data);
      if (res.data?.data?.success) {
        setFeedback({ type: 'success', text: `Meta Graph API verified! Connected as "${res.data.data.appName}".` });
      } else {
        setFeedback({ type: 'warning', text: `Verification failed: ${res.data?.data?.message || 'Unknown error'}` });
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Meta API verification failed';
      setMetaTestResult({ success: false, message: msg });
      setFeedback({ type: 'danger', text: msg });
    } finally {
      setTestingMeta(false);
    }
  };

  // Security & Masking State
  const [isVerified, setIsVerified] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordPlain, setShowPasswordPlain] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // 'COPY_URL' | 'COPY_TOKEN' | 'TOGGLE_URL' | 'TOGGLE_TOKEN'

  // Feedback Toasts
  const [copiedField, setCopiedField] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const MASKED_STRING = '••••••••••••••••••••••••••••••••••••••••';

  // Trigger copy or reveal with password verification gate
  const requestProtectedAction = (actionType) => {
    if (isVerified) {
      executeAction(actionType);
      return;
    }

    setPendingAction(actionType);
    setPasswordInput('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const executeAction = (actionType) => {
    if (actionType === 'COPY_URL') {
      navigator.clipboard.writeText(webhookUrl);
      setCopiedField('URL');
      setFeedback({ type: 'success', text: 'Callback URL copied to clipboard!' });
      setTimeout(() => setCopiedField(null), 2500);
      setTimeout(() => setFeedback({ type: '', text: '' }), 3500);
    } else if (actionType === 'COPY_TOKEN') {
      navigator.clipboard.writeText(verifyToken);
      setCopiedField('TOKEN');
      setFeedback({ type: 'success', text: 'Verify Token copied to clipboard!' });
      setTimeout(() => setCopiedField(null), 2500);
      setTimeout(() => setFeedback({ type: '', text: '' }), 3500);
    } else if (actionType === 'TOGGLE_URL') {
      setShowUrl((prev) => !prev);
    } else if (actionType === 'TOGGLE_TOKEN') {
      setShowToken((prev) => !prev);
    }
  };

  // Submit Password Verification
  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError('Please enter your account password.');
      return;
    }

    try {
      setVerifying(true);
      setPasswordError('');

      const res = await api.post('/auth/verify-password', { password: passwordInput });
      if (res.data?.success) {
        setIsVerified(true);
        setShowPasswordModal(false);

        // Auto reveal both fields for user convenience
        setShowUrl(true);
        setShowToken(true);

        // Execute the intended action
        if (pendingAction) {
          executeAction(pendingAction);
        }
      }
    } catch (err) {
      setPasswordError(
        err.response?.data?.error?.message || 'Incorrect password. Please enter your valid account password.'
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <AiwavoHeader
        title="Settings"
        subtitle="Platform configuration, tenant profile & Meta Webhook callback"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="settings-page-container">
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4`} role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>
            {feedback.text}
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* 1. Hero Banner */}
        <div className="settings-hero-banner">
          <div className="settings-hero-left">
            <div className="settings-hero-icon">
              <i className="bi bi-gear-fill"></i>
            </div>
            <div>
              <h1 className="settings-hero-title">Workspace & API Configuration</h1>
              <p className="settings-hero-subtitle">
                Manage your tenant environment, security policies, and official Meta Cloud API Webhook endpoints.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Settings Grid */}
        <div className="row g-4">
          {/* Workspace Profile */}
          <div className="col-12 col-lg-6">
            <div className="settings-card">
              <div className="settings-card-header">
                <h5 className="settings-card-title">
                  <i className="bi bi-building text-success"></i>
                  <span>Workspace Profile</span>
                </h5>
                <span className="badge bg-success-subtle text-success fw-bold px-2 py-1">Single-Company Workspace</span>
              </div>
              <form onSubmit={handleSaveWorkspace} className="settings-card-body">
                <div className="mb-3">
                  <label className="settings-label">Workspace Name</label>
                  <input
                    type="text"
                    className="settings-input"
                    value={workspaceForm.name}
                    onChange={(e) => setWorkspaceForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="settings-label">Workspace Identifier</label>
                  <input type="text" className="settings-input font-monospace" value={business?.slug || ''} readOnly />
                </div>
                <div className="mb-3">
                  <label className="settings-label">Workspace Timezone</label>
                  <select
                    className="settings-input"
                    value={workspaceForm.timezone}
                    onChange={(e) => setWorkspaceForm(prev => ({ ...prev, timezone: e.target.value }))}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  </select>
                </div>
                <div className="d-flex align-items-center justify-content-between pt-2">
                  <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 fw-bold">
                    <i className="bi bi-patch-check-fill me-1"></i> {business?.status || 'Active'}
                  </span>
                  <button
                    type="submit"
                    disabled={savingWorkspace}
                    className="btn btn-success btn-sm px-3 fw-semibold"
                    style={{ backgroundColor: '#00a859', borderColor: '#00a859' }}
                  >
                    {savingWorkspace ? 'Saving...' : 'Save Workspace'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Meta Webhook Integration Guide */}
          <div className="col-12 col-lg-6">
            <div className="settings-card">
              <div className="settings-card-header">
                <h5 className="settings-card-title">
                  <i className="bi bi-shield-lock-fill text-primary"></i>
                  <span>Meta Cloud API Webhook Setup</span>
                </h5>
                <span className="badge bg-primary-subtle text-primary fw-bold px-2 py-1">v21.0 Required</span>
              </div>
              <div className="settings-card-body">
                <p className="text-muted small mb-3">
                  Configure your Meta Developer App Webhook settings with these endpoints to receive live message
                  delivery statuses and customer replies.
                </p>

                {/* Callback URL */}
                <div className="mb-3">
                  <label className="settings-label">
                    <span>Callback URL</span>
                    {copiedField === 'URL' && (
                      <span className="text-success small fw-bold">
                        <i className="bi bi-check-circle me-1"></i> Copied!
                      </span>
                    )}
                  </label>
                  <div className="d-flex">
                    <input
                      type="text"
                      className={`settings-input font-monospace small ${!showUrl ? 'settings-input-masked' : ''}`}
                      style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                      value={showUrl ? webhookUrl : MASKED_STRING}
                      readOnly
                    />
                    <button
                      type="button"
                      className="settings-reveal-btn"
                      onClick={() => requestProtectedAction('TOGGLE_URL')}
                      title={showUrl ? 'Hide URL' : 'Reveal URL (Requires Password)'}
                    >
                      <i className={`bi ${showUrl ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                    </button>
                    <button
                      type="button"
                      className="settings-copy-btn"
                      onClick={() => requestProtectedAction('COPY_URL')}
                      title="Copy Callback URL"
                    >
                      <i className={`bi ${copiedField === 'URL' ? 'bi-check2' : 'bi-clipboard'}`}></i>
                      <span>{copiedField === 'URL' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Verify Token */}
                <div className="mb-3">
                  <label className="settings-label">
                    <span>Verify Token</span>
                    {copiedField === 'TOKEN' && (
                      <span className="text-success small fw-bold">
                        <i className="bi bi-check-circle me-1"></i> Copied!
                      </span>
                    )}
                  </label>
                  <div className="d-flex">
                    <input
                      type="text"
                      className={`settings-input font-monospace small ${!showToken ? 'settings-input-masked' : ''}`}
                      style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                      value={showToken ? verifyToken : MASKED_STRING}
                      readOnly
                    />
                    <button
                      type="button"
                      className="settings-reveal-btn"
                      onClick={() => requestProtectedAction('TOGGLE_TOKEN')}
                      title={showToken ? 'Hide Token' : 'Reveal Token (Requires Password)'}
                    >
                      <i className={`bi ${showToken ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                    </button>
                    <button
                      type="button"
                      className="settings-copy-btn"
                      onClick={() => requestProtectedAction('COPY_TOKEN')}
                      title="Copy Verify Token"
                    >
                      <i className={`bi ${copiedField === 'TOKEN' ? 'bi-check2' : 'bi-clipboard'}`}></i>
                      <span>{copiedField === 'TOKEN' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-light rounded-3 small border">
                  <div className="fw-bold text-dark mb-1">
                    <i className="bi bi-info-circle-fill text-primary me-1"></i>
                    Webhook Subscriptions to Enable:
                  </div>
                  <ul className="mb-0 text-muted ps-3">
                    <li>
                      <code>messages</code> (Receives delivery, read statuses, and STOP commands)
                    </li>
                    <li>
                      <code>message_template_status_update</code> (Receives template approval changes)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Owner Meta Developer App Configuration */}
          {isOwner && (
            <div className="col-12">
              <div className="settings-card">
                <div className="settings-card-header">
                  <h5 className="settings-card-title">
                    <i className="bi bi-gear-wide-connected text-primary"></i>
                    <span>Meta Developer App Configuration (Owner)</span>
                  </h5>
                  <span className={`badge ${metaStatus?.readinessStatus === 'ready' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'} fw-bold px-2 py-1`}>
                    {metaStatus?.readinessStatus === 'ready' ? 'Ready' : 'Configure App'}
                  </span>
                </div>
                <form onSubmit={handleSaveMetaConfig} className="settings-card-body">
                  <p className="text-muted small mb-3">
                    Configure your Meta Developer App credentials used for Facebook Embedded Signup and Cloud API calls. Secrets are encrypted at rest.
                  </p>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="settings-label">Meta App ID</label>
                      <input
                        type="text"
                        className="settings-input font-monospace"
                        placeholder="e.g. 1504824461464867"
                        value={metaConfig.metaAppId}
                        onChange={(e) => setMetaConfig(prev => ({ ...prev, metaAppId: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="settings-label">
                        Meta App Secret {metaStatus?.appSecretConfigured && <span className="text-success small">(Saved)</span>}
                      </label>
                      <input
                        type="password"
                        className="settings-input font-monospace"
                        placeholder={metaStatus?.appSecretConfigured ? 'Leave blank to keep existing secret' : 'Enter Meta App Secret'}
                        value={metaConfig.metaAppSecret}
                        onChange={(e) => setMetaConfig(prev => ({ ...prev, metaAppSecret: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="settings-label">Embedded Signup Config ID</label>
                      <input
                        type="text"
                        className="settings-input font-monospace"
                        placeholder="Optional Meta Config ID"
                        value={metaConfig.embeddedSignupConfigId}
                        onChange={(e) => setMetaConfig(prev => ({ ...prev, embeddedSignupConfigId: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="settings-label">Graph API Version</label>
                      <input
                        type="text"
                        className="settings-input font-monospace"
                        value={metaConfig.graphApiVersion}
                        onChange={(e) => setMetaConfig(prev => ({ ...prev, graphApiVersion: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="settings-label">Webhook Verify Token</label>
                      <input
                        type="text"
                        className="settings-input font-monospace"
                        value={metaConfig.webhookVerifyToken}
                        onChange={(e) => setMetaConfig(prev => ({ ...prev, webhookVerifyToken: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 d-flex align-items-end">
                      <div className="form-check form-switch mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="useEnvFallbackSwitch"
                          checked={metaConfig.useEnvFallback}
                          onChange={(e) => setMetaConfig(prev => ({ ...prev, useEnvFallback: e.target.checked }))}
                        />
                        <label className="form-check-label small fw-semibold" htmlFor="useEnvFallbackSwitch">
                          Use server .env fallback when DB fields empty
                        </label>
                      </div>
                    </div>
                  </div>

                  {metaTestResult && (
                    <div className={`alert ${metaTestResult.success ? 'alert-success' : 'alert-warning'} py-2 px-3 small mt-3 mb-0`}>
                      {metaTestResult.message || (metaTestResult.success ? `Connected as ${metaTestResult.appName}` : 'Test failed')}
                    </div>
                  )}

                  <div className="d-flex flex-wrap gap-2 mt-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingMeta}
                      className="btn btn-primary btn-sm px-3 fw-semibold"
                    >
                      {savingMeta ? 'Saving...' : 'Save Meta App Config'}
                    </button>
                    <button
                      type="button"
                      disabled={testingMeta}
                      onClick={handleTestMetaConnection}
                      className="btn btn-outline-secondary btn-sm px-3 fw-semibold"
                    >
                      {testingMeta ? 'Testing...' : 'Test Meta Connection'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* 3. Password Verification Security Modal */}
        {showPasswordModal && (
          <div className="settings-modal-overlay">
            <div className="settings-modal-dialog">
              <div className="settings-modal-header">
                <h5 className="settings-modal-title">
                  <i className="bi bi-shield-lock-fill text-success"></i>
                  <span>Security Verification Required</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPasswordModal(false)}
                ></button>
              </div>

              <form onSubmit={handleVerifyPassword}>
                <div className="settings-modal-body">
                  <p className="text-muted small mb-3">
                    Meta Cloud API Webhook credentials provide direct webhook access to your workspace. Please verify
                    your account password to copy and decrypt these credentials.
                  </p>

                  {passwordError && (
                    <div className="alert alert-danger py-2 px-3 small mb-3">
                      <i className="bi bi-exclamation-triangle-fill me-1"></i>
                      {passwordError}
                    </div>
                  )}

                  <div className="mb-2">
                    <label className="form-label small fw-bold text-dark">Account Password</label>
                    <div className="input-group">
                      <input
                        type={showPasswordPlain ? 'text' : 'password'}
                        className="form-control"
                        placeholder="Enter your login password"
                        value={passwordInput}
                        autoFocus
                        onChange={(e) => setPasswordInput(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPasswordPlain((p) => !p)}
                        title={showPasswordPlain ? 'Hide password' : 'Show password'}
                      >
                        <i className={`bi ${showPasswordPlain ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-modal-footer">
                  <button
                    type="button"
                    className="btn btn-light px-3 fw-semibold"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={verifying}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success px-4 fw-bold d-inline-flex align-items-center gap-2"
                    style={{ backgroundColor: '#00a859', borderColor: '#00a859' }}
                    disabled={verifying}
                  >
                    {verifying && <span className="spinner-border spinner-border-sm" role="status"></span>}
                    <span>{verifying ? 'Verifying...' : 'Verify & Copy'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
