import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { getSocket, initSocket } from '../services/socket';
import iconImg from '../assets/icon.png';
import logoImg from '../assets/logo.png';
import '../styles/newSidebar.css';

export default function Sidebar({ isOpen, onClose, onToggle }) {
  const { user, isSuperAdmin } = useAuth();
  const location = useLocation();

  const userRole = (user?.role || 'owner').toLowerCase();
  const isSuper = isSuperAdmin ? (typeof isSuperAdmin === 'function' ? isSuperAdmin() : isSuperAdmin) : (userRole === 'superadmin' || userRole === 'super_admin');
  const effectiveRole = isSuper ? 'owner' : userRole;

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

  // Dedicated routes & role-filtered sections for Single-Company + Team mode
  const rawSections = [
    {
      heading: 'HOME',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: 'bi-house-door', roles: ['owner', 'admin', 'marketer', 'agent'] }
      ]
    },
    {
      heading: 'WHATSAPP',
      items: [
        { to: '/whatsapp', label: 'Connected Numbers', icon: 'bi-telephone', roles: ['owner', 'admin', 'marketer'] },
        { to: '/settings?tab=profile', label: 'Business & Meta Settings', icon: 'bi-card-image', roles: ['owner', 'admin'] },
        { to: '/templates', label: 'Templates', icon: 'bi-file-earmark-text', roles: ['owner', 'admin', 'marketer'] },
        { to: '/interactive-buttons', label: 'Interactive Buttons', icon: 'bi-grid', roles: ['owner', 'admin'] }
      ]
    },
    {
      heading: 'INBOX',
      items: [
        {
          to: '/inbox',
          label: 'Inbox',
          icon: 'bi-chat-dots',
          roles: ['owner', 'admin', 'marketer', 'agent'],
          badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : null
        }
      ]
    },
    {
      heading: 'AUTOMATION',
      items: [
        { to: '/automations', label: 'Automations', icon: 'bi-robot', roles: ['owner', 'admin', 'marketer'] }
      ]
    },
    {
      heading: 'CATALOGUE & PRODUCTS',
      items: [
        { to: '/products', label: 'Product Library', icon: 'bi-box-seam', roles: ['owner', 'admin', 'marketer'] },
        { to: '/products?tab=categories', label: 'Categories', icon: 'bi-grid-3x3-gap', roles: ['owner', 'admin', 'marketer'] }
      ]
    },
    {
      heading: 'CONTACTS',
      items: [
        { to: '/contacts', label: 'All Contacts', icon: 'bi-person-lines-fill', roles: ['owner', 'admin', 'marketer', 'agent'] },
        { to: '/imports', label: 'Import CSV', icon: 'bi-upload', roles: ['owner', 'admin', 'marketer'] },
        { to: '/export', label: 'Export', icon: 'bi-download', roles: ['owner', 'admin', 'marketer'] },
        { to: '/contacts/groups', label: 'Contact Groups', icon: 'bi-people', roles: ['owner', 'admin', 'marketer'] },
        { to: '/tags', label: 'Tags', icon: 'bi-tag', roles: ['owner', 'admin', 'marketer'] }
      ]
    },
    {
      heading: 'ENGAGEMENT',
      items: [
        { to: '/campaigns', label: 'Campaigns', icon: 'bi-send', roles: ['owner', 'admin', 'marketer'] },
        { to: '/campaigns/new', label: 'Broadcast', icon: 'bi-megaphone', roles: ['owner', 'admin', 'marketer'] },
        { to: '/analytics', label: 'Analytics', icon: 'bi-graph-up', roles: ['owner', 'admin', 'marketer'] },
        { to: '/activity-logs', label: 'Audit Logs', icon: 'bi-clock-history', roles: ['owner', 'admin'] }
      ]
    },
    {
      heading: 'REPORTS',
      items: [
        { to: '/campaign-reports', label: 'Campaign Report', icon: 'bi-send', roles: ['owner', 'admin', 'marketer'] },
        { to: '/message-reports', label: 'Message Report', icon: 'bi-chat-square-dots', roles: ['owner', 'admin', 'marketer'] },
        { to: '/contact-reports', label: 'Contact Report', icon: 'bi-person-lines-fill', roles: ['owner', 'admin', 'marketer'] }
      ]
    },
    {
      heading: 'TEAM',
      items: [
        { to: '/team?role=lead', label: 'Team Leads', icon: 'bi-person-badge', roles: ['owner', 'admin'] },
        { to: '/team?role=agent', label: 'Members', icon: 'bi-people', roles: ['owner', 'admin'] }
      ]
    },
    {
      heading: 'BILLING',
      items: [
        { to: '/billing', label: 'Billing & Meta Payment', icon: 'bi-credit-card-2-front', roles: ['owner', 'admin'] }
      ]
    }
  ];

  const navSections = rawSections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => !item.roles || item.roles.includes(effectiveRole))
    }))
    .filter((sec) => sec.items.length > 0);

  const currentFullPath = location.pathname + location.search;

  const isItemActive = (targetTo) => {
    if (targetTo === '/dashboard') {
      return location.pathname === '/' || (location.pathname === '/dashboard' && !location.search);
    }
    if (targetTo === '/team?role=lead') {
      return location.pathname === '/team' && location.search.includes('role=lead');
    }
    if (targetTo === '/team?role=agent' || targetTo === '/team') {
      return location.pathname === '/team' && (!location.search || location.search.includes('role=agent') || location.search.includes('role=member'));
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
                  <Link
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
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
