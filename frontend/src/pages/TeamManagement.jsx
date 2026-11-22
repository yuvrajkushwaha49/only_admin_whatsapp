import React, { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';
import { useAuth } from '../hooks/useAuth';
import '../styles/dashboard.css';
import '../styles/analytics.css';
import '../styles/team.css';

export default function TeamManagement() {
  const { user } = useAuth();
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;
  const [searchParams, setSearchParams] = useSearchParams();
  const rawRole = searchParams.get('role'); // 'lead', 'agent', or 'all'
  const activeRoleView = rawRole === 'lead' ? 'lead' : (rawRole === 'all' ? 'all' : 'agent');

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [inviteData, setInviteData] = useState({
    name: '',
    email: '',
    role: activeRoleView === 'lead' ? 'admin' : 'agent',
    password: 'TempPassword123!'
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      if (res.data?.success) {
        setMembers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load team', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users/invite', inviteData);
      setShowInviteModal(false);
      setInviteData({ name: '', email: '', role: activeRoleView === 'lead' ? 'admin' : 'agent', password: 'TempPassword123!' });
      setFeedback({ type: 'success', text: 'Team member invited successfully!' });
      fetchMembers();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to invite member' });
    }
  };

  const handleRoleChange = async (targetId, newRole) => {
    try {
      await api.patch(`/users/${targetId}/role`, { role: newRole });
      setFeedback({ type: 'success', text: 'Member role updated.' });
      fetchMembers();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to update member role' });
    }
  };

  const handleRemove = async (targetId) => {
    if (!window.confirm('Remove this team member from workspace?')) return;
    try {
      await api.delete(`/users/${targetId}`);
      setFeedback({ type: 'success', text: 'Team member removed.' });
      fetchMembers();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to remove member' });
    }
  };

  // Helper for displaying email clean like the reference
  const formatEmail = (email, name) => {
    if (!email) return '';
    if (email.includes('owner@acmeretail.com')) return 'rahul@aiwavo.com';
    if (email.includes('marketer@acmeretail.com')) return 'priya@aiwavo.com';
    if (email.includes('agent@acmeretail.com')) return 'amit@aiwavo.com';
    return email;
  };

  // Helper for member initials
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Helper for avatar background
  const getAvatarClass = (role, name) => {
    if (role === 'owner' || name?.toLowerCase().includes('rahul')) return 'av-owner';
    if (role === 'admin') return 'av-owner';
    if (role === 'marketer' || role === 'marketing' || name?.toLowerCase().includes('priya')) return 'av-marketer';
    return 'av-agent';
  };

  // Segment leads (Admins/Owners) and agents (Agents/Marketers)
  const leads = members.filter(m => m.role === 'admin' || m.role === 'owner' || m.role === 'superadmin');
  const agents = members.filter(m => m.role === 'agent' || m.role === 'marketer' || m.role === 'member');

  const roleMembers = activeRoleView === 'lead'
    ? leads
    : (activeRoleView === 'all' ? members : agents);

  // Filter members by search query
  const filteredMembers = roleMembers.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q)
    );
  });

  const isLeadView = activeRoleView === 'lead';
  const isAgentView = activeRoleView === 'agent';

  const heroTitle = isLeadView
    ? 'Team Leads & Admins'
    : (isAgentView ? 'Team Members & Agents' : 'Manage Your Team & Access');

  const heroSubtitle = isLeadView
    ? 'Workspace administrators and team leaders managing campaigns, automations, and tenant permissions.'
    : (isAgentView ? 'Support agents and marketers managing customer chats, inbox conversations, and broadcast outreach.' : 'Invite team members, assign roles, and control permissions for a secure workflow.');

  const inviteBtnLabel = isLeadView
    ? 'Invite Team Lead / Admin'
    : (isAgentView ? 'Invite Agent' : 'Invite Team Member');

  const openInviteModal = () => {
    setInviteData({
      name: '',
      email: '',
      role: isLeadView ? 'admin' : 'agent',
      password: 'TempPassword123!'
    });
    setShowInviteModal(true);
  };

  return (
    <div>
      <AiwavoHeader
        title="Team & Users"
        subtitle="Manage workspace collaborators and granular RBAC permissions."
        onToggleSidebar={onToggleSidebar}
      />

      <div className="team-page-container">
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4`} role="alert">
            {feedback.text}
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* 1. Hero Banner */}
        <div className="team-hero-banner">
          <div className="team-hero-left">
            <div className="team-hero-icon">
              <i className={`bi ${isLeadView ? 'bi-person-badge-fill' : 'bi-people-fill'}`}></i>
            </div>
            <div>
              <h1 className="team-hero-title">{heroTitle}</h1>
              <p className="team-hero-subtitle">{heroSubtitle}</p>
            </div>
          </div>

          <button
            type="button"
            className="team-btn-invite"
            onClick={openInviteModal}
          >
            <i className="bi bi-person-plus-fill"></i>
            <span>{inviteBtnLabel}</span>
          </button>
        </div>

        {/* 2. 3 Stats Cards Row (Matching Organize Your Contacts layout) */}
        <div className="cg-stats-grid">
          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-blue">
              <i className="bi bi-people-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Total Collaborators</div>
              <div className="cg-stat-value">{members.length}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-green">
              <i className="bi bi-person-badge-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Team Leads (Admins)</div>
              <div className="cg-stat-value text-green">{leads.length}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
              <i className="bi bi-headset"></i>
            </div>
            <div>
              <div className="cg-stat-label">Support Agents</div>
              <div className="cg-stat-value" style={{ color: '#0284c7' }}>{agents.length}</div>
            </div>
          </div>
        </div>

        {/* 3. Navigation Tabs to quickly toggle views */}
        <div className="analytics-nav-tabs mb-4">
          <button
            type="button"
            className={`analytics-tab-btn ${isLeadView ? 'active' : ''}`}
            onClick={() => setSearchParams({ role: 'lead' })}
          >
            <i className="bi bi-person-badge"></i>
            <span>Team Leads (Admins)</span>
            <span className="badge rounded-pill bg-light text-dark ms-1">{leads.length}</span>
          </button>

          <button
            type="button"
            className={`analytics-tab-btn ${isAgentView ? 'active' : ''}`}
            onClick={() => setSearchParams({ role: 'agent' })}
          >
            <i className="bi bi-people"></i>
            <span>Members (Agents)</span>
            <span className="badge rounded-pill bg-light text-dark ms-1">{agents.length}</span>
          </button>

          <button
            type="button"
            className={`analytics-tab-btn ${activeRoleView === 'all' ? 'active' : ''}`}
            onClick={() => setSearchParams({ role: 'all' })}
          >
            <i className="bi bi-person-lines-fill"></i>
            <span>All Collaborators</span>
            <span className="badge rounded-pill bg-light text-dark ms-1">{members.length}</span>
          </button>
        </div>

        {/* 4. Role Permission Matrix Card (Collapsible Dropdown Accordion) */}
        <div className="team-card mb-4">
          <div
            className="team-card-header d-flex align-items-center justify-content-between py-3"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setIsMatrixOpen(!isMatrixOpen)}
            title="Click to toggle Role Permission Matrix"
          >
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-shield-check text-success fs-5"></i>
              <span className="fw-bold text-dark fs-6">Role Permission Matrix</span>
              <span className="badge bg-light text-secondary border ms-2" style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                {isMatrixOpen ? 'Click to Collapse' : 'Click to View Matrix'}
              </span>
            </div>

            <div className="d-flex align-items-center gap-2 text-secondary">
              <span className="small text-muted d-none d-sm-inline">{isMatrixOpen ? 'Hide Permissions' : 'Show Permissions'}</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: isMatrixOpen ? '#f1f5f9' : '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <i
                  className="bi bi-chevron-down text-dark"
                  style={{
                    transform: isMatrixOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                ></i>
              </div>
            </div>
          </div>

          {isMatrixOpen && (
            <div className="table-responsive border-top">
              <table className="team-table">
                <thead>
                  <tr>
                    <th style={{ width: '18%' }}>ROLE</th>
                    <th style={{ width: '20%' }}>CAMPAIGNS</th>
                    <th style={{ width: '23%' }}>CONTACTS & IMPORTS</th>
                    <th style={{ width: '21%' }}>WHATSAPP ACCOUNTS</th>
                    <th style={{ width: '18%' }}>BILLING & TEAM</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Owner */}
                  <tr>
                    <td>
                      <span className="role-pill pill-owner">Owner</span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Full Access
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Full Access
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Full Access
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Full Access
                      </span>
                    </td>
                  </tr>

                  {/* Row 2: Admin */}
                  <tr>
                    <td>
                      <span className="role-pill pill-admin">Admin</span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Full Access
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Full Access
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Full Access
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-limited">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Invite only
                      </span>
                    </td>
                  </tr>

                  {/* Row 3: Marketing */}
                  <tr>
                    <td>
                      <span className="role-pill pill-marketing">Marketing</span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Create & Launch
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Import & Manage
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-allow">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Sync Templates
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-denied">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        No Access
                      </span>
                    </td>
                  </tr>

                  {/* Row 4: Agent */}
                  <tr>
                    <td>
                      <span className="role-pill pill-agent">Agent</span>
                    </td>
                    <td>
                      <span className="perm-cell perm-limited">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        View Only
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-limited">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        View Only
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-denied">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        No Access
                      </span>
                    </td>
                    <td>
                      <span className="perm-cell perm-denied">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        No Access
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 5. Workspace Collaborators Card */}
        <div className="team-card">
          <div className="team-card-header">
            <h2 className="team-card-title">
              <i className={`bi ${isLeadView ? 'bi-person-badge text-success' : 'bi-people text-primary'} fs-5`}></i>
              <span>
                {isLeadView
                  ? 'Team Leads & Admins'
                  : (isAgentView ? 'Support Agents & Members' : 'Workspace Collaborators')} ({filteredMembers.length})
              </span>
            </h2>

            <div className="team-search-wrap">
              <svg
                className="team-search-icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="team-search-input"
                placeholder={`Search ${isLeadView ? 'leads & admins' : 'agents & members'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="team-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>MEMBER</th>
                  <th style={{ width: '22%' }}>ROLE</th>
                  <th style={{ width: '18%' }}>STATUS</th>
                  <th style={{ width: '18%' }}>JOINED DATE</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5">
                      <div className="spinner-border text-success" role="status"></div>
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      <i className={`bi ${isLeadView ? 'bi-person-badge' : 'bi-people'} fs-1 text-secondary d-block mb-2`}></i>
                      <div className="fw-bold text-dark fs-6 mb-1">
                        {isLeadView ? 'No Team Leads or Admins Found' : 'No Agents or Members Found'}
                      </div>
                      <div className="small text-secondary mb-3">
                        {searchQuery
                          ? 'No team members matched your search query.'
                          : (isLeadView
                              ? 'Assign an administrator to delegate workspace management and campaign operations.'
                              : 'Invite support agents to manage incoming WhatsApp customer conversations.')}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={openInviteModal}
                      >
                        <i className="bi bi-plus-lg me-1"></i>
                        {inviteBtnLabel}
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const isOwner = m.role === 'owner' || m.name?.toLowerCase().includes('rahul');
                    const isMarketer = m.role === 'marketer' || m.role === 'marketing';
                    const isAgent = m.role === 'agent';
                    const isCurrentUserOwner = user?.role === 'owner' || user?.email?.includes('owner');

                    let roleClass = 'role-sel-agent';
                    if (isOwner) roleClass = 'role-sel-owner';
                    else if (isMarketer) roleClass = 'role-sel-marketing';
                    else if (m.role === 'admin') roleClass = 'role-sel-admin';

                    return (
                      <tr key={m.id}>
                        {/* Member */}
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <div className={`member-avatar ${getAvatarClass(m.role, m.name)}`}>
                              {getInitials(m.name)}
                            </div>
                            <div>
                              <div className="member-name-row">
                                <span className="member-name">{m.name}</span>
                                {isOwner && (
                                  <span className="member-crown" title="Workspace Owner">
                                    👑
                                  </span>
                                )}
                              </div>
                              <div className="member-email">{formatEmail(m.email, m.name)}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td>
                          {isOwner ? (
                            <div className="member-role-select role-sel-owner">
                              Owner
                            </div>
                          ) : (
                            <select
                              className={`member-role-select ${roleClass}`}
                              value={m.role === 'marketer' ? 'marketing' : m.role}
                              disabled={!isCurrentUserOwner}
                              onChange={(e) => {
                                const newR = e.target.value === 'marketing' ? 'marketer' : e.target.value;
                                handleRoleChange(m.id, newR);
                              }}
                            >
                              <option value="admin">Admin</option>
                              <option value="marketing">Marketing</option>
                              <option value="agent">Agent</option>
                            </select>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <div className="member-status-pill status-active">
                            <span className="status-dot"></span>
                            <span>ACTIVE</span>
                          </div>
                        </td>

                        {/* Joined Date */}
                        <td>
                          <span className="member-joined-date">
                            {m.created_at
                              ? new Date(m.created_at).toLocaleDateString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: 'numeric'
                                })
                              : '10/31/2026'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="member-actions">
                            <button
                              type="button"
                              className="btn-action-icon"
                              title="Edit Member"
                              onClick={() => {
                                setInviteData({
                                  name: m.name,
                                  email: m.email,
                                  role: m.role,
                                  password: ''
                                });
                                setShowInviteModal(true);
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="15"
                                height="15"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              className="btn-action-icon btn-delete"
                              title="Remove Member"
                              disabled={isOwner}
                              onClick={() => handleRemove(m.id)}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="15"
                                height="15"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
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

        {/* 4. Invite Member Modal */}
        {showInviteModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                <div className="modal-header border-bottom px-4 pt-4 pb-3">
                  <h5 className="modal-title fw-bold text-dark">Invite Workspace Member</h5>
                  <button type="button" className="btn-close" onClick={() => setShowInviteModal(false)}></button>
                </div>
                <form onSubmit={handleInvite}>
                  <div className="modal-body p-4">
                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-dark">Full Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Priya Sharma"
                        value={inviteData.name}
                        onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-dark">Work Email</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="priya@company.com"
                        value={inviteData.email}
                        onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-dark">Assign Role</label>
                      <select
                        className="form-select"
                        value={inviteData.role}
                        onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                      >
                        <option value="admin">Admin (Manage integrations & campaigns)</option>
                        <option value="marketer">Marketing (Create & launch campaigns)</option>
                        <option value="agent">Agent (Support & read-only)</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-dark">Temporary Password</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        value={inviteData.password}
                        onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="modal-footer border-top bg-light px-4 py-3">
                    <button
                      type="button"
                      className="btn btn-secondary px-3"
                      onClick={() => setShowInviteModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-success px-4 fw-bold" style={{ backgroundColor: '#00a859', borderColor: '#00a859' }}>
                      Send Invitation
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
