import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import FloatingLiveProgress from '../components/FloatingLiveProgress';
import AIChatWidget from '../components/chatbot/AIChatWidget';
import '../styles/switchClientModal.css';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('cf_sidebar_open');
    if (saved !== null) {
      return saved === 'true';
    }
    return typeof window !== 'undefined' ? window.innerWidth >= 992 : true;
  });

  const location = useLocation();
  const isInbox = location.pathname.startsWith('/inbox');

  const isImpersonating = localStorage.getItem('cf_impersonating') === 'true';
  const impersonatedBiz = localStorage.getItem('cf_impersonated_biz');

  const handleReturnToAdmin = () => {
    const superAdminToken = localStorage.getItem('cf_superadmin_token');
    if (superAdminToken) {
      localStorage.setItem('cf_token', superAdminToken);
      localStorage.removeItem('cf_superadmin_token');
    }
    localStorage.removeItem('cf_impersonating');
    localStorage.removeItem('cf_impersonated_biz');
    window.location.href = '/admin';
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('cf_sidebar_open', String(next));
      return next;
    });
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    localStorage.setItem('cf_sidebar_open', 'false');
  };

  // Close sidebar on mobile route navigation
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 992) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className={`aiveexa-app-shell d-flex flex-column ${isInbox ? 'vh-100 overflow-hidden' : 'min-vh-100'} bg-light-subtle`}>
      {/* Global Real-time Floating Live Progress Bar (Campaign & Import) */}
      <FloatingLiveProgress />

      {/* Top Navbar Header matching Image 1 */}
      <Navbar
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarOpen}
      />

      {/* SuperAdmin Client View Banner if impersonating */}
      {isImpersonating && (
        <div className="admin-impersonation-bar">
          <div className="admin-impersonation-content">
            <i className="bi bi-shield-shaded me-2"></i>
            <span>
              Viewing as <strong>{impersonatedBiz || 'Client'}</strong> (Super Admin Client View Mode)
            </span>
          </div>
          <button
            onClick={handleReturnToAdmin}
            className="btn btn-sm btn-light text-dark fw-bold admin-impersonation-exit-btn"
          >
            <i className="bi bi-box-arrow-left me-1"></i> Return to Super Admin Suite
          </button>
        </div>
      )}

      {/* Main Container below Top Navbar */}
      <div
        className="d-flex flex-grow-1 position-relative"
        style={isInbox ? { minHeight: 0, overflow: 'hidden' } : undefined}
      >
        {/* Mobile Backdrop overlay */}
        {sidebarOpen && (
          <div
            className="sidebar-backdrop d-lg-none"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Component matching Image 2 */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          onToggle={toggleSidebar}
        />

        {/* Main Content Area */}
        <main
          className={`flex-grow-1 ${isInbox ? 'p-0 overflow-hidden' : 'p-3 p-md-4 overflow-auto'}`}
          style={{
            minWidth: 0,
            backgroundColor: '#f8fafc',
            ...(isInbox ? { minHeight: 0, height: '100%' } : {})
          }}
        >
          <Outlet context={{ onToggleSidebar: toggleSidebar, sidebarOpen }} />
        </main>
      </div>

      {/* Floating AI Support Assistant */}
      <AIChatWidget />
    </div>
  );
}
