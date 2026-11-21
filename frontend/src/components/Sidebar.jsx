import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { getSocket, initSocket } from '../services/socket';
import iconImg from '../assets/icon.png';
import logoImg from '../assets/logo.png';
import '../styles/newSidebar.css';

export default function Sidebar({ isOpen, onClose, onToggle }) {
  const { user, isSuperAdmin } = useAuth();
  const location = useLocation();

  const userRole = user?.role || 'owner';
  const isAgent = userRole === 'agent';

  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/whatsapp/inbox/stats?accountId=all');
      if (res.data?.success && res.data?.data) {
        const stats = res.data.data;
        const count = Number(stats.unreadMessages ?? stats.unread ?? 0);
        setUnreadCount(count);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchUnreadCount();
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleUnreadChange = () => fetchUnreadCount();
    window.addEventListener('inbox:unread_count_changed', handleUnreadChange);

    let socket = getSocket() || initSocket();
    if (socket) {
      socket.on('inbox:new_message', handleUnreadChange);
      socket.on('inbox:conversation_updated', handleUnreadChange);
    }

    return () => {
      window.removeEventListener('inbox:unread_count_changed', handleUnreadChange);
      if (socket) {
        socket.off('inbox:new_message', handleUnreadChange);
        socket.off('inbox:conversation_updated', handleUnreadChange);
      }
    };
  }, []);

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 992 && onClose) {
      onClose();
    }
  };

  // Dedicated routes & query states so items don't collide
  const navSections = [
    {
      heading: 'HOME',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: 'bi-house-door' }
      ]
    },
    {
      heading: 'WHATSAPP',
      items: [
        // { to: '/whatsapp?tab=connect', label: 'Connect', icon: 'bi-link-45deg' },
        { to: '/whatsapp', label: 'Connected Numbers', icon: 'bi-telephone' },
        { to: '/settings?tab=profile', label: 'Business Profile', icon: 'bi-card-image' },
        { to: '/templates', label: 'Templates', icon: 'bi-file-earmark-text' },
        { to: '/templates?type=buttons', label: 'Interactive Buttons', icon: 'bi-grid' }
        // { to: '/whatsapp?tab=health', label: 'Health', icon: 'bi-heart' }
        // { to: '/admin/meta', label: 'Webhook Status', icon: 'bi-lightning-charge' }
      ]
    },
    {
      heading: 'INBOX',
      items: [
        {
          to: '/inbox',
          label: 'Inbox',
          icon: 'bi-chat-dots',
          badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : null
        }
      ]
    },
    {
      heading: 'LEADS',
      items: [
        { to: '/contacts?view=leads', label: 'Lead Manager', icon: 'bi-briefcase' }
      ]
    },
    {
      heading: 'CONTACTS',
      items: [
        { to: '/contacts', label: 'All Contacts', icon: null },
        { to: '/imports', label: 'Import CSV', icon: 'bi-upload' },
        { to: '/contacts?action=export', label: 'Export', icon: 'bi-download' },
        { to: '/contacts/groups', label: 'Contact Groups', icon: 'bi-people' },
        { to: '/contacts?view=tags', label: 'Tags', icon: 'bi-tag' }
      ]
    },
    {
      heading: 'ENGAGEMENT',
      items: [
        { to: '/campaigns', label: 'Campaigns', icon: 'bi-send' },
        { to: '/campaigns/new', label: 'Broadcast', icon: 'bi-megaphone' },
        { to: '/dashboard?view=analytics', label: 'Analytics', icon: 'bi-graph-up' },
        { to: '/activity-logs', label: 'Audit Logs', icon: 'bi-clock-history' }
      ]
    },
    {
      heading: 'REPORTS',
      items: [
        { to: '/campaigns?view=reports', label: 'Campaign Report', icon: 'bi-send' },
        { to: '/activity-logs?type=messages', label: 'Message Report', icon: 'bi-chat-square-dots' },
        { to: '/contacts?view=reports', label: 'Contact Report', icon: null }
      ]
    },
    {
      heading: 'TEAM',
      items: [
        { to: '/team?role=lead', label: 'Team Leads', icon: 'bi-person' },
        { to: '/team', label: 'Members', icon: 'bi-people' }
      ]
    },
    {
      heading: 'BILLING',
      items: [
        { to: '/billing', label: 'Payments', icon: 'bi-wallet2' }
      ]
    }
  ];

  const currentFullPath = location.pathname + location.search;

  const isItemActive = (targetTo) => {
    if (targetTo === '/dashboard') {
      return location.pathname === '/' || (location.pathname === '/dashboard' && !location.search);
    }
    if (targetTo.includes('?')) {
      return currentFullPath === targetTo;
    }
    if (location.pathname === targetTo) {
      return !location.search;
    }
    return false;
  };

  return (
    <aside className={`aiveexa-sidebar ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="aiveexa-sidebar-scroll">
        {navSections.map((sec, secIdx) => (
          <div key={sec.heading || secIdx} className="aiveexa-nav-section">
            {sec.heading && (
              <div className="aiveexa-nav-heading">{sec.heading}</div>
            )}
            <div className="aiveexa-nav-list">
              {sec.items.map((item, itemIdx) => {
                const active = isItemActive(item.to);

                return (
                  <NavLink
                    key={`${sec.heading}_${item.label}_${itemIdx}`}
                    to={item.to}
                    onClick={handleLinkClick}
                    className={`aiveexa-nav-item ${active ? 'active' : ''}`}
                    title={item.label}
                  >
                    {item.icon ? (
                      <i className={`bi ${item.icon} aiveexa-nav-icon`}></i>
                    ) : (
                      <span className="aiveexa-nav-bullet"></span>
                    )}
                    <span className="aiveexa-nav-label">{item.label}</span>
                    {item.badge && (
                      <span className="aiveexa-nav-badge">{item.badge}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
