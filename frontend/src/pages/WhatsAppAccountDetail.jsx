import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function WhatsAppAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const canManage = (isSuperAdmin ? isSuperAdmin() : false) || ['superadmin', 'owner', 'admin'].includes((user?.role || '').toLowerCase());

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [copiedKey, setCopiedKey] = useState('');

  // Disconnect / Delete modals
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  // SuperAdmin Live Test Messenger
  const [testForm, setTestForm] = useState({
    recipientPhone: '919565763089',
    messageType: 'template',
    templateName: 'hello_world',
    textBody: 'Hello from CampaignFlow WhatsApp Cloud API!'
  });
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Analytics Metrics (Hooks must always execute unconditionally at top level)
  const totalSent = account?.stats?.totalSent || 0;
  const totalDelivered = account?.stats?.totalDelivered || 0;
  const totalRead = account?.stats?.totalRead || 0;
  const totalFailed = account?.stats?.totalFailed || 0;
  const totalConversations = account?.stats?.totalConversations || 0;

  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;

  // Donut Pie Chart Data
  const pieData = useMemo(() => {
    const list = [
      { name: 'Read', value: totalRead, color: '#198754' },
      { name: 'Delivered', value: Math.max(0, totalDelivered - totalRead), color: '#25D366' },
      { name: 'Sent (In Transit)', value: Math.max(0, totalSent - totalDelivered), color: '#0d6efd' },
      { name: 'Failed', value: totalFailed, color: '#dc3545' }
    ].filter(d => d.value > 0);
    return list;
  }, [totalRead, totalDelivered, totalSent, totalFailed]);

  // Bar Chart Data (Delivery Funnel)
  const barData = useMemo(() => {
    return [
      { name: 'Sent', count: totalSent, fill: '#0d6efd' },
      { name: 'Delivered', count: totalDelivered, fill: '#25D366' },
      { name: 'Read', count: totalRead, fill: '#198754' },
      { name: 'Conversations', count: totalConversations, fill: '#6f42c1' },
      { name: 'Failed', count: totalFailed, fill: '#dc3545' }
    ];
  }, [totalSent, totalDelivered, totalRead, totalConversations, totalFailed]);

  useEffect(() => {
    fetchAccountDetail();
  }, [id]);

  const fetchAccountDetail = async () => {
    // Strictly block direct numeric IDs (e.g. /whatsapp/accounts/4) for security
    const strId = String(id || '').trim();
    if (/^\d+$/.test(strId)) {
      setLoading(false);
      setError('Direct numeric account IDs are disabled for security. Accounts can only be accessed using verified secure links.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/whatsapp/accounts/${id}`);
      if (res.data?.success && res.data?.data) {
        setAccount(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to load WhatsApp Account details');
      }
    } catch (err) {
      console.error('Failed to load WhatsApp account detail:', err);
      setError(err.response?.data?.message || 'WhatsApp Account not found or unauthorized');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setVerifying(true);
      setFeedback({ type: '', text: '' });
      const res = await api.post(`/whatsapp/accounts/${id}/verify`);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: '✅ Meta Graph API connection verified and status updated!' });
        await fetchAccountDetail();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Verification failed.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleSetPrimary = async () => {
    try {
      setSettingPrimary(true);
      setFeedback({ type: '', text: '' });
      const res = await api.post(`/whatsapp/accounts/${id}/primary`);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: `⭐ ${account.phone_number || account.display_name} is now your Primary Default sender!` });
        await fetchAccountDetail();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to set as primary account.' });
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleSyncTemplates = async () => {
    try {
      setSyncingTemplates(true);
      setFeedback({ type: '', text: '' });
      const res = await api.post('/whatsapp/templates/sync');
      if (res.data?.success) {
        setFeedback({ type: 'success', text: `✅ Templates synced with Meta! Total: ${res.data.data?.syncedCount || 0}` });
        await fetchAccountDetail();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to sync templates.' });
    } finally {
      setSyncingTemplates(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setActionInProgress(true);
      await api.delete(`/whatsapp/accounts/${id}`);
      setFeedback({ type: 'success', text: 'WhatsApp account disconnected.' });
      setShowDisconnectModal(false);
      navigate('/whatsapp');
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to disconnect account.' });
      setShowDisconnectModal(false);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeletePermanent = async () => {
    try {
      setActionInProgress(true);
      await api.delete(`/whatsapp/accounts/${id}/permanent`);
      setShowDeleteModal(false);
      navigate('/whatsapp');
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to delete account permanently.' });
      setShowDeleteModal(false);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    try {
      setSendingTest(true);
      setTestResult(null);
      const res = await api.post(`/whatsapp/accounts/${id}/test-message`, testForm);
      if (res.data?.success) {
        setTestResult({ success: true, message: `Message sent successfully! Meta Message ID: ${res.data.data?.meta_message_id || res.data.data?.id || 'delivered'}` });
      } else {
        setTestResult({ success: false, message: res.data?.message || 'Failed to send test message' });
      }
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.message || 'Test message failed to send' });
    } finally {
      setSendingTest(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status" style={{ width: '3rem', height: '3rem' }}></div>
        <p className="mt-3 text-muted fw-semibold">Loading WhatsApp Number Details...</p>
      </div>
    );
  }

  if (error || !account) {
    const isDirectNumericBlocked = String(error).toLowerCase().includes('numeric');

    return (
      <div className="container py-5">
        <div className="alert alert-danger shadow-sm p-4 text-center rounded-3">
          <i className={`bi ${isDirectNumericBlocked ? 'bi-shield-lock-fill text-warning' : 'bi-exclamation-triangle-fill'} fs-2 mb-2 d-block`}></i>
          <h4>{isDirectNumericBlocked ? 'Direct ID Access Blocked' : 'Unable to Load WhatsApp Account'}</h4>
          <p className="text-muted">{error || 'This account may have been removed or deactivated by SuperAdmin.'}</p>
          <Link to="/whatsapp" className="btn btn-primary mt-2">
            <i className="bi bi-arrow-left me-1"></i> Back to WhatsApp Accounts
          </Link>
        </div>
      </div>
    );
  }

  const qualityColor =
    account.quality_rating === 'GREEN' ? 'success' :
    account.quality_rating === 'YELLOW' ? 'warning' :
    account.quality_rating === 'RED' ? 'danger' : 'secondary';

  const isConnected = account.status === 'connected';

  return (
    <div>
      {/* Back Navigation Bar */}
      <div className="mb-3">
        <Link to="/whatsapp" className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 shadow-xs">
          <i className="bi bi-arrow-left"></i>
          <span>Back to All Connected WhatsApp Numbers</span>
        </Link>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px', background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)' }}>
        <div className="card-body p-4 p-md-5">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm"
                style={{
                  width: '68px',
                  height: '68px',
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  fontSize: '2.2rem',
                  flexShrink: 0
                }}
              >
                <i className="bi bi-whatsapp"></i>
              </div>

              <div>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <h3 className="fw-bold text-dark mb-0 font-monospace">
                    {account.phone_number || account.display_name || 'WhatsApp Number'}
                  </h3>
                  {account.is_primary ? (
                    <span className="badge bg-warning text-dark border border-warning shadow-xs">
                      ⭐ Primary Default Sender
                    </span>
                  ) : (
                    <button
                      className="btn btn-xs btn-outline-secondary py-0 px-2"
                      onClick={handleSetPrimary}
                      disabled={settingPrimary}
                      title="Set as workspace primary sender"
                    >
                      {settingPrimary ? 'Setting...' : 'Set as Primary'}
                    </button>
                  )}
                  <span className={`badge ${isConnected ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                    <i className={`bi ${isConnected ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                    {account.status?.toUpperCase()}
                  </span>
                  <span className="badge bg-light text-dark border">
                    Admin Status: <strong className="text-success">{account.admin_status || 'ACTIVE'}</strong>
                  </span>
                </div>

                <div className="text-secondary small">
                  <strong>Verified Name:</strong> {account.verified_name || account.display_name || 'WhatsApp Business Account'}
                </div>
              </div>
            </div>

            {/* Quick Header Actions */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              <button
                className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1 shadow-xs"
                onClick={handleVerify}
                disabled={verifying}
              >
                <i className={`bi bi-arrow-repeat ${verifying ? 'spin' : ''}`}></i>
                <span>{verifying ? 'Verifying...' : 'Live Health Check'}</span>
              </button>
              <Link to="/inbox" className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 shadow-xs">
                <i className="bi bi-chat-dots-fill"></i>
                <span>Open Inbox</span>
              </Link>
              <Link to="/campaigns/new" className="btn btn-success btn-sm d-inline-flex align-items-center gap-1 shadow-xs">
                <i className="bi bi-megaphone-fill"></i>
                <span>Launch Campaign</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-green">
              <i className="bi bi-broadcast"></i>
            </div>
            <div>
              <div className="stat-label">Connection Status</div>
              <div className="stat-value text-success text-capitalize">{account.status || 'Connected'}</div>
              <div className="small text-muted">Cloud API v21.0 Live</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <i className="bi bi-shield-check"></i>
            </div>
            <div>
              <div className="stat-label">Quality Rating</div>
              <div className="stat-value text-primary">{account.quality_rating || 'GREEN'}</div>
              <div className="small text-muted">{account.messaging_limit_tier || 'STANDARD TIER'}</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-blue">
              <i className="bi bi-file-earmark-text"></i>
            </div>
            <div>
              <div className="stat-label">Synced Templates</div>
              <div className="stat-value">{account.stats?.totalTemplates || 0}</div>
              <div className="small text-muted">Approved & Ready to send</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-purple">
              <i className="bi bi-send-check"></i>
            </div>
            <div>
              <div className="stat-label">Broadcast Campaigns</div>
              <div className="stat-value">{account.stats?.totalCampaigns || 0}</div>
              <div className="small text-muted">Sent from this workspace</div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance & Delivery Analytics Visuals */}
      <div className="row g-4 mb-4">
        {/* Donut Pie Chart: Delivery Breakdown */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '14px' }}>
            <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between">
              <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-pie-chart-fill text-success"></i>
                <span>Message Delivery Distribution</span>
              </h6>
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                {deliveryRate}% Delivery Rate
              </span>
            </div>
            <div className="card-body d-flex flex-column align-items-center justify-content-center p-3">
              {pieData.length > 0 ? (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`wa-pie-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconSize={10} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-4 text-muted small">
                  <i className="bi bi-broadcast fs-3 d-block mb-2 text-secondary"></i>
                  No broadcast messages sent from this WhatsApp number yet.
                </div>
              )}
              <div className="w-100 border-top pt-2 mt-2 d-flex justify-content-around text-center small text-muted">
                <div>
                  <div className="fw-bold text-dark">{totalSent}</div>
                  <div>Sent</div>
                </div>
                <div>
                  <div className="fw-bold text-success">{totalDelivered}</div>
                  <div>Delivered</div>
                </div>
                <div>
                  <div className="fw-bold text-warning">{totalRead}</div>
                  <div>Read ({readRate}%)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bar Chart: Message Traffic Funnel */}
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '14px' }}>
            <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between">
              <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-bar-chart-fill text-primary"></i>
                <span>Channel Traffic & Conversions</span>
              </h6>
              <span className="small text-muted">
                Real-time Meta Webhooks
              </span>
            </div>
            <div className="card-body p-3">
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={barData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                    />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {barData.map((entry, index) => (
                        <Cell key={`wa-bar-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
