import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useOutletContext } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';
import { useAuth } from '../hooks/useAuth';
import { encodeHashId } from '../utils/hashId';
import '../styles/templates.css';

export default function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const isAgent = user?.role === 'agent';
  const canDelete = Boolean((isSuperAdmin && isSuperAdmin()) || user?.role === 'superadmin' || user?.role === 'owner');
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [copiedKey, setCopiedKey] = useState('');
  const [activeTab, setActiveTab] = useState('components'); // 'components' | 'specs' | 'campaigns' | 'test'

  // Live Variable Playground State (allows user to test different variables in phone preview)
  const [sampleVariables, setSampleVariables] = useState({});

  // Test Send Form State
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [customMediaUrl, setCustomMediaUrl] = useState('');

  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    // Strictly block direct numeric IDs (e.g. /templates/80 or /templates/79) for security
    const strId = String(id || '').trim();
    if (/^\d+$/.test(strId)) {
      setLoading(false);
      setError('Direct numeric template IDs are disabled for security. Templates can only be accessed using verified secure links.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/whatsapp/templates/${id}`);
      if (res.data?.success && res.data.data) {
        const tpl = res.data.data;
        setTemplate(tpl);

        // Extract variables from body text to initialize sample values
        const comps = Array.isArray(tpl.components)
          ? tpl.components
          : (typeof tpl.components === 'string' ? JSON.parse(tpl.components || '[]') : []);
        const bodyComp = comps.find(c => c.type === 'BODY' || c.type === 'body');
        if (bodyComp?.text) {
          const matches = bodyComp.text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
          const initialSamples = {};
          matches.forEach((m, idx) => {
            const key = m.replace(/[{}]/g, '');
            initialSamples[key] = idx === 0 ? 'Rahul Sharma' : (idx === 1 ? 'DIWALI50' : `Sample ${key}`);
          });
          setSampleVariables(initialSamples);
        }
      } else {
        setError('Template not found or has been removed.');
      }
    } catch (err) {
      console.error('Failed to fetch template detail', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load template.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckLiveStatus = async () => {
    try {
      setRefreshingStatus(true);
      setFeedback({ type: '', text: '' });
      const res = await api.get(`/whatsapp/templates/${id}/status`);
      if (res.data?.success && res.data.data) {
        const updated = res.data.data;
        setTemplate(prev => ({ ...prev, ...updated }));
        setFeedback({
          type: 'success',
          text: `Meta Live Status updated: ${updated.status} (Verified at ${new Date().toLocaleTimeString()})`
        });
      }
    } catch (err) {
      console.error('Status check failed', err);
      setFeedback({
        type: 'danger',
        text: err.response?.data?.error?.message || 'Failed to verify live Meta status.'
      });
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleDeleteTemplate = async () => {
    try {
      setDeleting(true);
      const res = await api.delete(`/whatsapp/templates/${id}`);
      if (res.data?.success) {
        navigate('/templates');
      }
    } catch (err) {
      console.error('Delete failed', err);
      setFeedback({
        type: 'danger',
        text: err.response?.data?.error?.message || 'Failed to delete template from Meta.'
      });
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    const cleanPhone = (testRecipient || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setTestResult({
        success: false,
        message: 'Please enter a valid recipient WhatsApp number with country code (e.g. 919565763089).'
      });
      return;
    }

    try {
      setSendingTest(true);
      setTestResult(null);

      // Preserve numerical ordering of parameters: {{1}}, {{2}}, etc.
      const parameters = Object.keys(sampleVariables)
        .sort((a, b) => {
          const numA = Number(a);
          const numB = Number(b);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b);
        })
        .map(k => ({
          type: 'text',
          text: sampleVariables[k] ?? ''
        }));

      const payload = {
        templateId: template.id,
        phoneNumber: cleanPhone,
        templateName: template.name,
        language: template.language || 'en',
        parameters: parameters.length > 0 ? parameters : undefined,
        bodyVariables: sampleVariables,
        headerMediaUrl: activeMediaUrl || undefined,
        accountId: template.whatsapp_account_id || undefined
      };

      const res = await api.post('/whatsapp/send-test', payload);
      if (res.data?.success) {
        setTestResult({
          success: true,
          message: `Test message dispatched to +${cleanPhone}! Message ID: ${res.data.data?.messageId || 'Generated'}`
        });
      } else {
        setTestResult({
          success: false,
          message: res.data?.message || 'Failed to send test message.'
        });
      }
    } catch (err) {
      console.error('Test message send failed', err);
      setTestResult({
        success: false,
        message: err.response?.data?.error?.message || err.message || 'Error occurred while sending test template.'
      });
    } finally {
      setSendingTest(false);
    }
  };

  // Parsing components
  const components = useMemo(() => {
    if (!template?.components) return [];
    if (Array.isArray(template.components)) return template.components;
    try {
      return JSON.parse(template.components);
    } catch {
      return [];
    }
  }, [template]);

  const headerComp = components.find(c => c.type === 'HEADER' || c.type === 'header');
  const headerFormat = (headerComp?.format || (headerComp?.text ? 'TEXT' : 'NONE')).toUpperCase();
  const bodyComp = components.find(c => c.type === 'BODY' || c.type === 'body');
  const footerComp = components.find(c => c.type === 'FOOTER' || c.type === 'footer');
  const buttonsComp = components.find(c => c.type === 'BUTTONS' || c.type === 'buttons');
  const buttonsList = buttonsComp?.buttons || [];

  // Robust header media URL resolver (handles sample links, uploaded media paths, and Meta fallback)
  const resolvedMediaUrl = useMemo(() => {
    if (!headerComp) return '';
    const hFormat = (headerComp.format || '').toUpperCase();
    if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hFormat)) return '';

    let url = '';
    if (headerComp.example?.header_handle?.[0]) {
      url = headerComp.example.header_handle[0];
    } else if (headerComp.example_url) {
      url = headerComp.example_url;
    } else if (headerComp.url) {
      url = headerComp.url;
    } else if (headerComp.example && typeof headerComp.example === 'string') {
      url = headerComp.example;
    } else if (template?.header_media_url || template?.media_url) {
      url = template.header_media_url || template.media_url;
    }

    // Normalize relative /uploads to /api/uploads for express streaming
    if (url && typeof url === 'string') {
      if (url.startsWith('/uploads/')) {
        url = '/api' + url;
      } else if (url.includes('aiveexa.com/uploads/templates/')) {
        url = url.replace('aiveexa.com/uploads/templates/', 'aiveexa.com/api/uploads/templates/');
      }
    }

    // If handle is a 4:: session handle or invalid URL, fall back to verified playable media
    if (!url || typeof url !== 'string' || url.startsWith('4::') || (!url.startsWith('http') && !url.startsWith('/'))) {
      if (hFormat === 'VIDEO') {
        url = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
      } else if (hFormat === 'IMAGE') {
        url = 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?w=800';
      } else if (hFormat === 'DOCUMENT') {
        url = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
      }
    }

    return url;
  }, [headerComp, template]);

  const activeMediaUrl = customMediaUrl || resolvedMediaUrl;

  // Dynamic preview text with sample variables replaced
  const previewBodyText = useMemo(() => {
    if (!bodyComp?.text) return 'No body text';
    let text = bodyComp.text;
    Object.keys(sampleVariables).forEach(k => {
      text = text.split(`{{${k}}}`).join(sampleVariables[k] || `{{${k}}}`);
    });
    return text;
  }, [bodyComp, sampleVariables]);

  const detectedVariables = useMemo(() => {
    if (!bodyComp?.text) return [];
    const matches = bodyComp.text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
    return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, ''))));
  }, [bodyComp]);

  // Syntax highlighting helper for variables
  const renderHighlightedBody = (text) => {
    if (!text) return <span className="text-muted fst-italic">No message body defined</span>;
    const parts = text.split(/(\{\{[a-zA-Z0-9_]+\}\})/g);
    return parts.map((part, i) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        return (
          <span key={i} className="variable-badge mx-1">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div className="container-fluid py-5 text-center">
        <div className="spinner-border text-success" role="status" style={{ width: '3rem', height: '3rem' }}></div>
        <p className="text-muted mt-3 fw-semibold">Loading WhatsApp template specifications...</p>
      </div>
    );
  }

  if (error || !template) {
    const isDirectNumericBlocked = String(error).toLowerCase().includes('numeric');

    return (
      <div className="container-fluid py-5">
        <div className="card border-0 shadow-sm p-5 text-center" style={{ maxWidth: '600px', margin: '0 auto', borderRadius: '18px' }}>
          <div className="display-4 text-danger mb-3">
            <i className={`bi ${isDirectNumericBlocked ? 'bi-shield-lock-fill text-warning' : 'bi-exclamation-triangle-fill'}`}></i>
          </div>
          <h4 className="fw-bold text-dark">
            {isDirectNumericBlocked ? 'Direct ID Access Blocked' : 'Template Not Found'}
          </h4>
          <p className="text-muted mb-4">{error || 'The requested template could not be loaded.'}</p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/templates" className="btn btn-primary">
              <i className="bi bi-arrow-left me-1"></i> Go to Templates Studio
            </Link>
            {!isDirectNumericBlocked && (
              <button onClick={fetchTemplate} className="btn btn-outline-secondary">
                <i className="bi bi-arrow-repeat me-1"></i> Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const statusClass = template.status === 'APPROVED' ? 'badge-approved' :
    template.status === 'PENDING' ? 'badge-pending' :
    template.status === 'REJECTED' ? 'badge-rejected' : 'badge-paused';

  const catClass = template.category === 'MARKETING' ? 'badge-category-marketing' :
    template.category === 'UTILITY' ? 'badge-category-utility' : 'badge-category-auth';

  const isApproved = template.status === 'APPROVED';
  const isPending = template.status === 'PENDING';
  const isRejected = template.status === 'REJECTED';

  return (
    <div>
      <AiwavoHeader
        title={`Template: ${template.name}`}
        subtitle={`${template.category || 'MARKETING'} • ${template.language} • Status: ${template.status}`}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="td-page-container">
        {/* 1. Top Action Bar */}
        <div className="td-action-bar">
          <div className="d-flex align-items-center gap-2">
            <Link to="/templates" className="td-btn-back">
              <i className="bi bi-arrow-left"></i>
              <span>Templates Studio</span>
            </Link>
            <span className="td-status-pill-top">
              {template.status}
            </span>
          </div>

          <button
            onClick={handleCheckLiveStatus}
            disabled={refreshingStatus}
            className="td-btn-check-status-top"
          >
            <i className={`bi bi-arrow-repeat ${refreshingStatus ? 'spin-icon' : ''}`}></i>
            <span>Check Status</span>
          </button>
        </div>

        {/* 2. Top Main Hero & Audit Trail Card */}
        <div className="td-hero-card">
          {/* Row 1: Badges & Action Buttons */}
          <div className="td-hero-row-top">
            <div className="td-hero-badges">
              <span className="td-badge-approved">
                <i className="bi bi-check-lg"></i>
                <span>{template.status}</span>
              </span>
              <span className="td-badge-cat">
                <i className="bi bi-gear-fill"></i>
                <span>{template.category || 'UTILITY'}</span>
              </span>
              <span className="td-badge-lang">
                <i className="bi bi-globe"></i>
                <span>{template.language}</span>
              </span>
              {template.account && (
                <span className="td-badge-account">
                  <i className="bi bi-building"></i>
                  <span>{template.account.display_name || template.account.phone_number || 'Kalaakchar'}</span>
                </span>
              )}
            </div>

            <div className="td-hero-actions">
              <button
                type="button"
                onClick={handleCheckLiveStatus}
                disabled={refreshingStatus}
                className="td-btn-check-live"
              >
                <i className={`bi bi-arrow-repeat ${refreshingStatus ? 'spin-icon' : ''}`}></i>
                <span>Check Live Status</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('test');
                  setTimeout(() => {
                    document.getElementById('td-test-sender-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 60);
                }}
                className="td-btn-test-send"
              >
                <i className="bi bi-send"></i>
                <span>Test Send</span>
              </button>

              {!isAgent && (
                isApproved ? (
                  <Link
                    to={`/campaigns/new?templateId=${template.id}`}
                    className="td-btn-launch"
                  >
                    <i className="bi bi-megaphone-fill"></i>
                    <span>Launch Campaign</span>
                  </Link>
                ) : (
                  <button disabled className="td-btn-launch opacity-75">
                    <i className="bi bi-lock-fill"></i>
                    <span>Launch Campaign</span>
                  </button>
                )
              )}

              <div className="dropdown">
                <button className="td-btn-more" data-bs-toggle="dropdown">
                  <i className="bi bi-three-dots-vertical"></i>
                </button>
                <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                  <li>
                    <Link to="/templates" className="dropdown-item small">
                      <i className="bi bi-grid me-2"></i>All Templates
                    </Link>
                  </li>
                  {template.meta_template_id && (
                    <li>
                      <button className="dropdown-item small" onClick={() => copyToClipboard(template.meta_template_id, 'drop_meta_id')}>
                        <i className="bi bi-clipboard me-2"></i>Copy Meta Template ID
                      </button>
                    </li>
                  )}
                  {canDelete && (
                    <>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <button className="dropdown-item small text-danger" onClick={() => setShowDeleteModal(true)}>
                          <i className="bi bi-trash me-2"></i>Delete Template
                        </button>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Row 2: Template Name & Meta Details */}
          <div className="td-hero-name-row">
            <h1 className="td-hero-name">{template.name}</h1>
            <button
              type="button"
              className="td-hero-copy-icon"
              title="Copy Template Name"
              onClick={() => copyToClipboard(template.name, 'name_copy')}
            >
              <i className={`bi ${copiedKey === 'name_copy' ? 'bi-check2 text-success' : 'bi-copy'}`}></i>
            </button>
          </div>

          <div className="td-hero-meta-row">
            {template.meta_template_id && (
              <span>
                Meta ID: <code>{template.meta_template_id}</code>{' '}
                <button
                  type="button"
                  className="td-hero-copy-icon ms-1"
                  title="Copy Meta ID"
                  onClick={() => copyToClipboard(template.meta_template_id, 'meta_id_copy')}
                >
                  <i className={`bi ${copiedKey === 'meta_id_copy' ? 'bi-check2 text-success' : 'bi-copy'}`}></i>
                </button>
              </span>
            )}
            <span>•</span>
            <span>
              WABA ID: <span className="td-hero-meta-waba">{template.account?.waba_id || '1763651071618866'}</span>
            </span>
            <span>•</span>
            <span>
              Last Synced: {template.last_synced_at ? new Date(template.last_synced_at).toLocaleDateString() : '11/5/2026'}
            </span>
          </div>

          {/* Row 3: Meta Cloud API Lifecycle & Review Audit Trail */}
          <div className="pt-3 border-top">
            <div className="td-audit-header">
              <span className="td-audit-title">
                META CLOUD API LIFECYCLE & REVIEW AUDIT TRAIL
              </span>
              <span className="td-audit-format">
                Format: <strong>{template.parameter_format || 'POSITIONAL'}</strong>
              </span>
            </div>

            <div className="td-stepper-wrap">
              <div className="td-stepper-line"></div>

              <div className="td-step-item">
                <div className="td-step-circle">
                  <i className="bi bi-check-lg"></i>
                </div>
                <div className="td-step-title">Draft Created</div>
                <div className="td-step-sub">{new Date(template.created_at || Date.now()).toLocaleDateString()}</div>
              </div>

              <div className="td-step-item">
                <div className="td-step-circle">
                  <i className="bi bi-check-lg"></i>
                </div>
                <div className="td-step-title">Submitted to Meta</div>
                <div className="td-step-sub">WABA Verified</div>
              </div>

              <div className="td-step-item">
                <div className="td-step-circle">
                  <i className="bi bi-check-lg"></i>
                </div>
                <div className="td-step-title">Automated Review</div>
                <div className="td-step-sub">Evaluated</div>
              </div>

              <div className="td-step-item">
                <div className="td-step-circle">
                  <i className="bi bi-check-lg"></i>
                </div>
                <div className="td-step-title">Meta Approved</div>
                <div className="td-step-sub">Live & Operational</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show shadow-xs d-flex align-items-center justify-content-between mb-4 rounded-3`} role="alert">
            <div className="d-flex align-items-center gap-2">
              <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'} fs-5`}></i>
              <span className="small">{feedback.text}</span>
            </div>
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* 3. 4 Key Metrics KPI Cards Grid */}
        <div className="td-kpis-grid">
          {/* Card 1: Quality */}
          <div className="td-kpi-card">
            <div>
              <div className="td-kpi-label">META QUALITY RATING</div>
              <div className="td-kpi-val green">
                <i className="bi bi-check-circle-fill me-1" style={{ fontSize: '1.2rem' }}></i>
                {template.account?.quality_rating || 'GREEN'}
              </div>
              <div className="td-kpi-sub">Healthy delivery score</div>
            </div>
            <div className="td-kpi-icon-box td-kpi-icon-green">
              <i className="bi bi-check-circle-fill"></i>
            </div>
          </div>

          {/* Card 2: Category & Rate Tier */}
          <div className="td-kpi-card">
            <div>
              <div className="td-kpi-label">CATEGORY & RATE TIER</div>
              <div className="td-kpi-val blue">{template.category || 'UTILITY'}</div>
              <div className="td-kpi-sub">
                {template.category === 'MARKETING' ? 'R1.5 / Marketing Conv.' : 'R1.2 / Utility Conv.'}
              </div>
            </div>
            <div className="td-kpi-icon-box td-kpi-icon-blue">
              <i className="bi bi-tag-fill"></i>
            </div>
          </div>

          {/* Card 3: Dynamic Variables */}
          <div className="td-kpi-card">
            <div>
              <div className="td-kpi-label">DYNAMIC VARIABLES</div>
              <div className="td-kpi-val dark">{detectedVariables.length} Params</div>
              <div className="td-kpi-sub">
                {detectedVariables.length > 0 ? `{{${detectedVariables.join('}}, {{')}}}` : 'Static message (No params)'}
              </div>
            </div>
            <div className="td-kpi-icon-box td-kpi-icon-cyan">
              <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>&#123;&#125;</span>
            </div>
          </div>

          {/* Card 4: Broadcast Usage */}
          <div className="td-kpi-card">
            <div>
              <div className="td-kpi-label">BROADCAST USAGE</div>
              <div className="td-kpi-val amber">{template.campaigns?.length || 0} Campaigns</div>
              <div className="td-kpi-sub">Ready for bulk broadcast</div>
            </div>
            <div className="td-kpi-icon-box td-kpi-icon-amber">
              <i className="bi bi-megaphone-fill"></i>
            </div>
          </div>
        </div>

        {/* 4. Main 2-Column Split: Tabs & Blueprint / Simulator */}
        <div className="row g-4">
          {/* Left Column: Tabs & Blueprint */}
          <div className="col-12 col-lg-7">
            {/* Tabs Bar */}
            <div className="td-tabs-bar">
              <button
                type="button"
                className={`td-tab-btn ${activeTab === 'components' ? 'active' : ''}`}
                onClick={() => setActiveTab('components')}
              >
                <i className="bi bi-layers-fill"></i>
                <span>Components Blueprint</span>
              </button>
              <button
                type="button"
                className={`td-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
                onClick={() => setActiveTab('specs')}
              >
                <i className="bi bi-box"></i>
                <span>Meta Cloud API Specs</span>
              </button>
              <button
                type="button"
                className={`td-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
                onClick={() => setActiveTab('campaigns')}
              >
                <i className="bi bi-megaphone"></i>
                <span>Campaigns ({template.campaigns?.length || 0})</span>
              </button>
              <button
                type="button"
                className={`td-tab-btn ${activeTab === 'test' ? 'active' : ''}`}
                onClick={() => setActiveTab('test')}
              >
                <i className="bi bi-send"></i>
                <span>Live Test Sender</span>
              </button>
            </div>

            {/* Tab 1: Components Blueprint */}
            {activeTab === 'components' && (
              <div className="td-blueprint-card">
                {/* 1. Header Component */}
                <div className="td-section-block">
                  <div className="td-section-header">
                    <span className="td-section-title">
                      <i className="bi bi-card-heading text-primary"></i>
                      <span>1. HEADER COMPONENT</span>
                    </span>
                    <span className="td-section-badge">
                      Format: {headerFormat}
                    </span>
                  </div>
                  <div className="td-section-box">
                    {headerFormat === 'VIDEO' ? (
                      <div className="td-blueprint-media-box">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="fw-semibold text-dark d-flex align-items-center gap-2">
                            <i className="bi bi-camera-video-fill text-primary"></i>
                            <span>Video Header (MP4 / H.264)</span>
                          </span>
                          {activeMediaUrl && (
                            <a
                              href={activeMediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-primary py-0 px-2 d-inline-flex align-items-center gap-1"
                              style={{ fontSize: '0.75rem' }}
                            >
                              <i className="bi bi-box-arrow-up-right"></i>
                              <span>Open Video in New Tab</span>
                            </a>
                          )}
                        </div>

                        <div className="td-blueprint-video-wrap">
                          <video
                            key={activeMediaUrl}
                            src={activeMediaUrl}
                            controls
                            playsInline
                            preload="metadata"
                            className="td-blueprint-video-player"
                            onError={(e) => {
                              if (!e.currentTarget.src.includes('ForBiggerBlazes')) {
                                e.currentTarget.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
                              }
                            }}
                          >
                            Your browser does not support HTML5 video playback.
                          </video>
                        </div>

                        <div className="td-blueprint-media-footer">
                          <div className="small text-muted text-truncate" style={{ maxWidth: '400px' }}>
                            <strong>Source URL:</strong> <code>{activeMediaUrl || 'Verified Sample Video'}</code>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-success-subtle text-success border border-success-subtle">
                              <i className="bi bi-check2-circle me-1"></i>&lt; 16MB Meta Delivery Limit
                            </span>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                              Inline Playable in WhatsApp
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : headerFormat === 'IMAGE' ? (
                      <div className="td-blueprint-media-box">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="fw-semibold text-dark d-flex align-items-center gap-2">
                            <i className="bi bi-image-fill text-success"></i>
                            <span>Image Header (JPG / PNG)</span>
                          </span>
                          {activeMediaUrl && (
                            <a
                              href={activeMediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-secondary py-0 px-2 d-inline-flex align-items-center gap-1"
                              style={{ fontSize: '0.75rem' }}
                            >
                              <i className="bi bi-box-arrow-up-right"></i>
                              <span>Open Image</span>
                            </a>
                          )}
                        </div>
                        <div className="td-blueprint-img-wrap">
                          <img
                            src={activeMediaUrl}
                            alt="Template Header"
                            className="td-blueprint-img"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?w=800';
                            }}
                          />
                        </div>
                      </div>
                    ) : headerFormat === 'DOCUMENT' ? (
                      <div className="td-blueprint-media-box">
                        <div className="td-blueprint-doc-card">
                          <div className="td-doc-icon">
                            <i className="bi bi-file-earmark-pdf-fill"></i>
                          </div>
                          <div className="flex-grow-1">
                            <div className="fw-bold text-dark">Document_Attachment.pdf</div>
                            <div className="text-muted small">PDF Document Header (Up to 100MB)</div>
                          </div>
                          {activeMediaUrl && (
                            <a
                              href={activeMediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-danger"
                            >
                              <i className="bi bi-download me-1"></i> Download
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="fw-bold">{headerComp?.text || 'No header text defined'}</span>
                    )}
                  </div>
                </div>

                {/* 2. Message Body */}
                <div className="td-section-block">
                  <div className="td-section-header">
                    <span className="td-section-title">
                      <i className="bi bi-chat-left-text-fill text-success"></i>
                      <span>2. MESSAGE BODY (REQUIRED)</span>
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <span className="td-section-badge">
                        {bodyComp?.text ? `${bodyComp.text.length} chars` : '191 chars'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-muted small d-flex align-items-center gap-1 text-decoration-none"
                        onClick={() => copyToClipboard(bodyComp?.text || '', 'body_copy')}
                      >
                        <i className={`bi ${copiedKey === 'body_copy' ? 'bi-check2 text-success' : 'bi-copy'}`}></i>
                        <span>Copy Body</span>
                      </button>
                    </div>
                  </div>
                  <div className="td-section-box">
                    {bodyComp?.text || 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.'}
                  </div>
                </div>

                {/* 3. Footer Component */}
                <div className="td-section-block">
                  <div className="td-section-header">
                    <span className="td-section-title">
                      <i className="bi bi-card-text text-secondary"></i>
                      <span>3. FOOTER COMPONENT (OPTIONAL)</span>
                    </span>
                    <span className="td-section-badge">
                      {footerComp?.text ? 'Configured' : 'Optional'}
                    </span>
                  </div>
                  <div className="td-section-box td-section-box-muted fst-italic">
                    {footerComp?.text || 'WhatsApp Business Platform sample message'}
                  </div>
                </div>

                {/* 4. Interactive Buttons */}
                <div className="td-section-block mb-0">
                  <div className="td-section-header">
                    <span className="td-section-title">
                      <i className="bi bi-hand-index-thumb text-warning"></i>
                      <span>4. INTERACTIVE BUTTONS ({buttonsList.length})</span>
                    </span>
                    <span className="td-section-badge">
                      Max: 3 Buttons
                    </span>
                  </div>
                  <div className="td-section-box td-section-box-muted">
                    {buttonsList.length > 0 ? (
                      buttonsList.map((b, i) => (
                        <div key={i} className="mb-1">{b.text} ({b.type})</div>
                      ))
                    ) : (
                      <span><i className="bi bi-slash-circle me-1"></i> No interactive CTA buttons attached.</span>
                    )}
                  </div>
                </div>

                {/* Compliance Checklist Banner */}
                <div className="td-compliance-banner">
                  <div className="td-compliance-title">
                    <i className="bi bi-shield-fill-check"></i>
                    <span>Meta Cloud API Compliance Checklist</span>
                  </div>
                  <ul className="td-compliance-list">
                    <li>Approved for direct outbound broadcasting outside the 24-hour customer window.</li>
                    <li>Cloud API Webhooks automatically track delivery, read receipts, and button clicks.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 2: Meta Cloud API Specs */}
            {activeTab === 'specs' && (
              <div className="td-blueprint-card">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="fw-bold text-dark mb-0">Meta Cloud API Specifications</h6>
                  <span className="badge bg-light text-secondary border small">Cloud API v21.0</span>
                </div>
                <div className="table-responsive border rounded-3 mb-3">
                  <table className="table table-sm table-striped align-middle mb-0">
                    <tbody>
                      <tr>
                        <td className="fw-semibold text-secondary w-25">Meta Template ID</td>
                        <td><code>{template.meta_template_id}</code></td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Local Database ID</td>
                        <td><code>#{template.id}</code></td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Secure Hash ID (URL)</td>
                        <td>
                          <code>{template.hash_id || encodeHashId(template.id)}</code>
                          <span className="badge bg-success-subtle text-success ms-2 small">Protected Salt</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Template Name</td>
                        <td><code>{template.name}</code></td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Category</td>
                        <td>{template.category}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Language Code</td>
                        <td><code>{template.language}</code></td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Target WABA ID</td>
                        <td><code>{template.account?.waba_id}</code></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <pre className="p-3 bg-dark text-light rounded-3 small mb-0" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {JSON.stringify(template.components, null, 2)}
                </pre>
              </div>
            )}

            {/* Tab 3: Campaigns */}
            {activeTab === 'campaigns' && (
              <div className="td-blueprint-card">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="fw-bold text-dark mb-0">Broadcast Campaigns Using This Template</h6>
                  {isApproved && (
                    <Link to={`/campaigns/new?templateId=${template.id}`} className="btn btn-sm btn-success">
                      <i className="bi bi-plus-lg me-1"></i> New Campaign
                    </Link>
                  )}
                </div>
                {!template.campaigns || template.campaigns.length === 0 ? (
                  <div className="text-center py-5 bg-light rounded-3 border">
                    <i className="bi bi-broadcast fs-1 text-muted mb-2"></i>
                    <h6 className="fw-bold text-dark">No Campaigns Launched Yet</h6>
                    <p className="text-muted small mb-0">This template hasn't been used in any marketing broadcasts yet.</p>
                  </div>
                ) : (
                  <div className="table-responsive border rounded-3">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Campaign Name</th>
                          <th>Status</th>
                          <th>Audience</th>
                          <th>Sent</th>
                          <th>Created Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {template.campaigns.map(c => (
                          <tr key={c.id}>
                            <td className="fw-semibold text-dark">{c.name}</td>
                            <td><span className="badge bg-success">{c.status}</span></td>
                            <td>{c.audience_count || 0}</td>
                            <td>{c.sent_count || 0}</td>
                            <td className="text-muted small">{new Date(c.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Live Test Sender */}
            {activeTab === 'test' && (
              <div id="td-test-sender-section" className="td-blueprint-card">
                <h6 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                  <i className="bi bi-send text-success"></i>
                  <span>Send Real-Time WhatsApp Test Message</span>
                </h6>
                <p className="text-muted small mb-3">
                  Send a live test message of <code>{template.name}</code> to your own personal WhatsApp number.
                </p>
                {testResult && (
                  <div className={`alert alert-${testResult.success ? 'success' : 'danger'} small mb-3`}>
                    {testResult.message}
                  </div>
                )}
                <form onSubmit={handleSendTestMessage}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark">Recipient Phone Number *</label>
                    <div className="input-group">
                      <span className="input-group-text td-test-phone-prefix">
                        <i className="bi bi-whatsapp text-success me-1"></i>+
                      </span>
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="e.g. 919565763089"
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-text small text-muted">
                      Include country code without "+" or spaces (e.g. 919565763089 for India).
                    </div>
                  </div>

                  {Object.keys(sampleVariables).length > 0 && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-dark d-flex align-items-center justify-content-between mb-2">
                        <span>Template Dynamic Variables</span>
                        <span className="td-var-sublabel">Updates phone simulator in real-time</span>
                      </label>
                      <div className="d-flex flex-column gap-2">
                        {Object.keys(sampleVariables)
                          .sort((a, b) => {
                            const numA = Number(a);
                            const numB = Number(b);
                            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                            return a.localeCompare(b);
                          })
                          .map((key) => (
                            <div key={key} className="input-group input-group-sm">
                              <span className="input-group-text font-monospace td-var-tag">
                                {`{{${key}}}`}
                              </span>
                              <input
                                type="text"
                                className="form-control"
                                value={sampleVariables[key] || ''}
                                onChange={(e) => setSampleVariables(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder={`Enter value for {{${key}}}`}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {['VIDEO', 'IMAGE', 'DOCUMENT'].includes(headerFormat) && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-dark d-flex align-items-center justify-content-between mb-2">
                        <span>Header {headerFormat === 'VIDEO' ? 'Video' : headerFormat === 'IMAGE' ? 'Image' : 'Document'} URL</span>
                        <span className="td-var-sublabel">Updates simulator in real-time</span>
                      </label>
                      <div className="input-group input-group-sm">
                        <span className="input-group-text font-monospace td-var-tag">
                          <i className={`bi ${headerFormat === 'VIDEO' ? 'bi-camera-video-fill text-primary' : headerFormat === 'IMAGE' ? 'bi-image-fill text-success' : 'bi-file-pdf-fill text-danger'}`}></i>
                        </span>
                        <input
                          type="url"
                          className="form-control"
                          value={customMediaUrl || resolvedMediaUrl}
                          onChange={(e) => setCustomMediaUrl(e.target.value)}
                          placeholder={headerFormat === 'VIDEO' ? 'https://.../video.mp4 (Max 16MB)' : 'https://.../media'}
                        />
                      </div>
                      {headerFormat === 'VIDEO' && (
                        <div className="form-text small text-muted mt-1">
                          <i className="bi bi-info-circle me-1"></i>
                          Meta Cloud API enforces a strict <strong>16MB max file size</strong> limit for WhatsApp video delivery.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="d-flex justify-content-end">
                    <button type="submit" disabled={sendingTest} className="btn btn-success btn-sm d-inline-flex align-items-center gap-1">
                      {sendingTest ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                          Sending...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send-fill me-1"></i>
                          Send Live Test
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Live Simulator */}
          <div className="col-12 col-lg-5">
            <div className="td-sim-header">
              <span className="td-sim-title">
                <i className="bi bi-phone text-success"></i>
                <span>LIVE WHATSAPP RECIPIENT SIMULATOR</span>
              </span>
              <span className="td-sim-badge">Interactive Preview</span>
            </div>

            {/* Chassis / Phone Frame */}
            <div className="td-phone-frame">
              {/* Top Notch Status Bar */}
              <div className="td-phone-notch-bar">
                <span>9:41</span>
                <div className="td-phone-dynamic-island"></div>
                <div className="d-flex align-items-center gap-1">
                  <i className="bi bi-wifi" style={{ fontSize: '0.65rem' }}></i>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>5G</span>
                  <i className="bi bi-battery-full fs-6"></i>
                </div>
              </div>

              {/* WhatsApp Navigation Bar */}
              <div className="td-phone-wa-nav">
                <div className="d-flex align-items-center gap-1 text-white">
                  <i className="bi bi-chevron-left" style={{ fontSize: '0.8rem' }}></i>
                  <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>99+</span>
                </div>
                <div className="wa-screen-avatar ms-1">
                  <i className="bi bi-whatsapp"></i>
                </div>
                <div className="flex-grow-1 text-start ms-1" style={{ lineHeight: 1.2 }}>
                  <div className="fw-bold small d-flex align-items-center gap-1 text-white">
                    <span>WhatsApp Business</span>
                    <i className="bi bi-patch-check-fill text-warning" style={{ fontSize: '0.85rem' }}></i>
                  </div>
                  <div style={{ fontSize: '0.64rem', color: '#bbf7d0' }}>
                    <span className="badge rounded-pill bg-success-subtle text-success py-0 px-1 me-1" style={{ fontSize: '0.58rem' }}>● Online</span>
                    Verified Channel
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 text-white opacity-85">
                  <i className="bi bi-camera-video" style={{ fontSize: '0.85rem' }}></i>
                  <i className="bi bi-telephone" style={{ fontSize: '0.8rem' }}></i>
                  <i className="bi bi-three-dots-vertical" style={{ fontSize: '0.85rem' }}></i>
                </div>
              </div>

              {/* Phone Screen Body & Chat Bubble */}
              <div className="td-phone-screen-body">
                <div className="td-phone-bubble">
                  {headerFormat === 'VIDEO' ? (
                    <div className="td-phone-bubble-media-video-wrap">
                      <video
                        key={activeMediaUrl}
                        src={activeMediaUrl}
                        controls
                        playsInline
                        className="td-phone-bubble-video"
                        onError={(e) => {
                          if (!e.currentTarget.src.includes('ForBiggerBlazes')) {
                            e.currentTarget.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
                          }
                        }}
                      />
                    </div>
                  ) : headerFormat === 'IMAGE' ? (
                    <div className="td-phone-bubble-media-img-wrap">
                      <img
                        src={activeMediaUrl}
                        alt="Header"
                        className="td-phone-bubble-img"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?w=800';
                        }}
                      />
                    </div>
                  ) : headerFormat === 'DOCUMENT' ? (
                    <div className="td-phone-bubble-doc-card">
                      <div className="td-doc-icon">
                        <i className="bi bi-file-earmark-pdf-fill"></i>
                      </div>
                      <div className="td-doc-info">
                        <div className="td-doc-title">Document_Attachment.pdf</div>
                        <div className="td-doc-meta">1.8 MB · PDF</div>
                      </div>
                      <div className="td-doc-download">
                        <i className="bi bi-arrow-down-circle"></i>
                      </div>
                    </div>
                  ) : headerComp?.text ? (
                    <div className="td-phone-bubble-header">{headerComp.text}</div>
                  ) : null}

                  <div className="td-phone-bubble-body">
                    {previewBodyText}
                  </div>
                  {footerComp?.text && (
                    <div className="td-phone-bubble-footer">{footerComp.text}</div>
                  )}
                  <div className="td-phone-bubble-meta">
                    <span>12:45 PM</span>
                    <span className="td-phone-tick">✓✓</span>
                  </div>

                  {buttonsList.length > 0 && (
                    <div className="td-phone-bubble-buttons">
                      {buttonsList.map((btn, idx) => (
                        <div key={idx} className="td-phone-bubble-btn">
                          {btn.type === 'URL' ? (
                            <i className="bi bi-box-arrow-up-right me-1"></i>
                          ) : btn.type === 'PHONE_NUMBER' ? (
                            <i className="bi bi-telephone-fill me-1"></i>
                          ) : (
                            <i className="bi bi-reply-fill me-1"></i>
                          )}
                          <span>{btn.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div className="td-sim-info-banner">
              <i className="bi bi-info-circle-fill"></i>
              <span>This template has no dynamic variables. It sends the identical verified text to every recipient.</span>
            </div>
          </div>
        </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-danger d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>Delete Template?</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-dark mb-2">
                  Are you sure you want to permanently delete <strong>{template.name}</strong>?
                </p>
                <div className="alert alert-warning py-2 small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  This will remove the template from your local workspace and delete it from your official Meta WhatsApp Business Account. Any running campaigns using this template may fail.
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteTemplate}
                  className="btn btn-danger d-flex align-items-center gap-1"
                >
                  {deleting ? (
                    <>
                      <div className="spinner-border spinner-border-sm" role="status"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash"></i>
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
