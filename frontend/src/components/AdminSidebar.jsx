import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import iconImg from '../assets/icon.png';
import logoImg from '../assets/logo.png';
import SwitchClientModal from './SwitchClientModal';
import '../styles/adminDashboard.css';

export default function AdminSidebar({ isOpen, onClose, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  const adminMenuItems = [
    { to: '/admin', icon: 'bi-grid-fill', name: 'Platform Overview', shortName: 'Overview', exact: true },
    { to: '/admin/tenants', icon: 'bi-buildings-fill', name: 'Businesses & Owners', shortName: 'Businesses' },
    { to: '/admin/numbers', icon: 'bi-diagram-3-fill', name: 'Number Allocation', shortName: 'Numbers' },
    { to: '/admin/billing', icon: 'bi-credit-card-2-front-fill', name: 'Global Billing & Plans', shortName: 'Billing' },
    { to: '/admin/logs', icon: 'bi-clock-history', name: 'Global Activity Logs', shortName: 'Audit Logs' },
    { to: '/admin/meta', icon: 'bi-gear-wide-connected', name: 'Meta Platform App', shortName: 'Meta App' },
    { to: '/admin/meta-monitoring', icon: 'bi-activity', name: 'Meta Monitoring', shortName: 'Health' },
    { to: '/admin/accounts', icon: 'bi-whatsapp', name: 'Raw Accounts', shortName: 'Raw Accs' },
    { to: '/admin/ai-support', icon: 'bi-robot', name: 'AI Support Assistant', shortName: 'AI Support' }
  ];

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 992 && onClose) {
      onClose();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (_) {
      navigate('/login');
    }
  };

  return (
    <aside
      className={`sidebar ${isOpen ? 'show' : 'collapsed'}`}
      aria-label="Super Admin Navigation Sidebar"
    >
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div
          className={`sidebar-brand-inner d-flex align-items-center ${!isOpen ? 'admin-sidebar-cursor-expand' : 'admin-sidebar-cursor-default'}`}
          onClick={!isOpen ? onToggle : undefined}
          title={!isOpen ? 'Click to expand sidebar' : undefined}
        >
          {isOpen ? (
            <div className="d-flex align-items-center gap-2">
              <img
                src={iconImg}
                alt="Aiveexa"
                className="sidebar-brand-icon-img"
                style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }}
              />
              <img
                src={logoImg}
                alt="Aiveexa"
                className="sidebar-brand-logo-full"
                style={{ height: '34px', width: 'auto', maxWidth: '135px', objectFit: 'contain' }}
              />
              <span className="badge bg-primary text-white fw-bold px-2 py-1" style={{ fontSize: '0.65rem' }}>
                ADMIN
              </span>
            </div>
          ) : (
            <img
              src={iconImg}
              alt="Aiveexa"
              className="sidebar-brand-icon-img"
            />
          )}
        </div>

        {/* Close / Collapse Toggle Button */}
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onToggle || onClose}
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <i className={`bi ${isOpen ? 'bi-chevron-left' : 'bi-chevron-right'}`}></i>
        </button>
      </div>

      {/* Body: SuperAdmin Menus */}
      <div className="sidebar-body">
        <div className="px-3 pt-2 pb-1">
          <small className="text-white-50 text-uppercase fw-bold admin-sidebar-section-heading">
            {isOpen ? 'Platform Administration' : 'ADMIN'}
          </small>
        </div>

        <ul className="sidebar-menu">
          {adminMenuItems.map((item) => (
            <li key={item.to} className="sidebar-item">
              <NavLink
                to={item.to}
                end={item.exact}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={handleLinkClick}
                title={!isOpen ? item.name : undefined}
              >
                <div className="sidebar-link-icon-wrap">
                  <i className={`bi ${item.icon}`}></i>
                </div>
                <span className="sidebar-link-full-text">{item.name}</span>
                <span className="sidebar-link-mini-text">{item.shortName}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Client Portal Switcher Card */}
        <div className="mt-auto p-3">
          <div className="p-3 rounded-3 admin-sidebar-workspace-card">
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-person-workspace fs-5 admin-sidebar-workspace-icon"></i>
              {isOpen && (
                <div>
                  <div className="small fw-bold admin-sidebar-workspace-title">Client Workspace</div>
                  <div className="admin-sidebar-workspace-sub">Switch to Owner / User view</div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSwitchModal(true)}
              className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2 admin-sidebar-workspace-btn"
              title="Switch to Client Workspace (Owner View)"
            >
              <i className="bi bi-box-arrow-up-right"></i>
              {isOpen && <span>Open Client View</span>}
            </button>
          </div>

          {/* Current Logged In Admin */}
          <div className="d-flex align-items-center justify-content-between mt-3 pt-3 admin-sidebar-user-card">
            <div className="d-flex align-items-center gap-2 overflow-hidden">
              <div className="rounded-circle bg-warning text-dark fw-bold d-flex align-items-center justify-content-center flex-shrink-0 admin-sidebar-user-avatar">
                SA
              </div>
              {isOpen && (
                <div className="overflow-hidden">
                  <div className="small text-truncate admin-sidebar-user-name">SuperAdmin</div>
                  <div className="text-truncate admin-sidebar-user-email">{user?.email}</div>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-link p-1 admin-sidebar-logout-btn"
              title="Logout"
            >
              <i className="bi bi-box-arrow-right fs-5"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Switch Client Impersonation Modal */}
      <SwitchClientModal
        isOpen={showSwitchModal}
        onClose={() => setShowSwitchModal(false)}
      />
    </aside>
  );
}

