import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import iconImg from '../assets/icon.png';
import logoImg from '../assets/logo.png';
import '../styles/newNavbar.css';

export default function Navbar({ onToggleSidebar, sidebarOpen }) {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    // Fetch unread count for notifications
    const fetchNotifCount = async () => {
      try {
        const res = await api.get('/notifications');
        if (res.data?.success && res.data?.data) {
          const count = res.data.data.unreadCount;
          if (typeof count === 'number') {
            setUnreadNotifs(count);
          }
        }
      } catch (_) {}
    };
    fetchNotifCount();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial = user?.name
    ? user.name.trim().charAt(0).toUpperCase()
    : (user?.email ? user.email.charAt(0).toUpperCase() : 'T');

  return (
    <header className="aiveexa-top-navbar">
      {/* Left side: Logo & Hamburger */}
      <div className="aiveexa-top-left">
        <Link to="/dashboard" className="aiveexa-brand-link">
          <img
            src={iconImg}
            alt="Aiveexa"
            className="aiveexa-brand-icon"
          />
          <img
            src={logoImg}
            alt="Aiveexa — Automate • Engage • Grow"
            className="aiveexa-brand-logo-text"
          />
        </Link>

        <button
          type="button"
          className="aiveexa-hamburger-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          title={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
        >
          <i className="bi bi-list"></i>
        </button>
      </div>

      {/* Right side: Notifications, Help & User Avatar */}
      <div className="aiveexa-top-right">
        {/* Notification Bell */}
        <button
          type="button"
          className="aiveexa-icon-btn aiveexa-notif-btn"
          title="Notifications"
          onClick={() => navigate('/activity-logs')}
        >
          <i className="bi bi-bell"></i>
          {unreadNotifs > 0 && (
            <span className="aiveexa-notif-badge">
              {unreadNotifs > 99 ? '99+' : unreadNotifs}
            </span>
          )}
        </button>

        {/* Help Circle */}
        <button
          type="button"
          className="aiveexa-icon-btn aiveexa-help-btn"
          title="Help & Support"
          onClick={() => window.open('https://developers.facebook.com/docs/whatsapp', '_blank')}
        >
          <i className="bi bi-question-circle"></i>
        </button>

        {/* User Profile Avatar with dropdown */}
        <div ref={profileRef} className="aiveexa-profile-container">
          <button
            type="button"
            className="aiveexa-avatar-btn"
            onClick={() => setShowProfileMenu(prev => !prev)}
            aria-label="User Profile"
          >
            <span>{userInitial}</span>
          </button>

          {showProfileMenu && (
            <div className="aiveexa-profile-dropdown shadow">
              <div className="aiveexa-profile-dropdown-header">
                <div className="fw-bold text-dark">{user?.name || 'Workspace User'}</div>
                <div className="small text-muted text-truncate">{user?.email}</div>
                <span className="badge bg-primary-subtle text-primary mt-1 text-uppercase" style={{ fontSize: '0.68rem' }}>
                  {user?.role || 'owner'}
                </span>
              </div>
              <div className="dropdown-divider my-1"></div>
              {['owner', 'admin', 'superadmin'].includes((user?.role || '').toLowerCase()) && (
                <Link
                  to="/settings"
                  className="dropdown-item py-2 px-3 small d-flex align-items-center gap-2"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <i className="bi bi-gear text-secondary"></i>
                  <span>Settings</span>
                </Link>
              )}
              <button
                type="button"
                className="dropdown-item py-2 px-3 small d-flex align-items-center gap-2 text-danger"
                onClick={() => {
                  setShowProfileMenu(false);
                  logout();
                }}
              >
                <i className="bi bi-box-arrow-right"></i>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
