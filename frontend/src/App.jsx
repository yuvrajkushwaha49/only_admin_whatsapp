import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Layouts
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import ContactGroups from './pages/ContactGroups';
import CsvImport from './pages/CsvImport';
import ExportContacts from './pages/ExportContacts';
import Tags from './pages/Tags';
import TagDetail from './pages/TagDetail';
import WhatsAppAccounts from './pages/WhatsAppAccounts';
import WhatsAppAccountDetail from './pages/WhatsAppAccountDetail';
import Templates from './pages/Templates';
import TemplateDetail from './pages/TemplateDetail';
import InteractiveButtons from './pages/InteractiveButtons';
import AutomationsDashboard from './pages/automation/AutomationsDashboard';
import AutomationBuilder from './pages/automation/AutomationBuilder';
import FlowCanvasBuilder from './pages/automation/flow/FlowCanvasBuilder';
import ProductLibrary from './pages/products/ProductLibrary';
import Inbox from './pages/Inbox';
import CampaignList from './pages/CampaignList';
import CampaignBuilder from './pages/CampaignBuilder';
import CampaignDetail from './pages/CampaignDetail';
import CampaignReport from './pages/CampaignReport';
import CampaignReports from './pages/CampaignReports';
import MessageReports from './pages/MessageReports';
import ContactReports from './pages/ContactReports';
import Analytics from './pages/Analytics/Analytics';
import AiAssistant from './pages/AiAssistant';
import TeamManagement from './pages/TeamManagement';
import Billing from './pages/Billing';
import ActivityLogs from './pages/ActivityLogs';
import Settings from './pages/Settings';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

// Super Admin Suite Pages
import AdminOverview from './pages/admin/AdminOverview';
import AdminTenants from './pages/admin/AdminTenants';
import AdminBusinessDetail from './pages/admin/AdminBusinessDetail';
import AdminNumbers from './pages/admin/AdminNumbers';
import AdminBilling from './pages/admin/AdminBilling';
import AdminLogs from './pages/admin/AdminLogs';
import AdminMeta from './pages/admin/AdminMeta';
import AdminMetaMonitoring from './pages/admin/AdminMetaMonitoring';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminAiSupport from './pages/admin/AdminAiSupport';

import WhatsAppOAuthCallback from './pages/WhatsAppOAuthCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

// Protected Route Guard with Role-Based Access Control (RBAC)
function ProtectedRoute({ children, requireSuperAdmin = false, allowedRoles = null }) {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isSuper = isSuperAdmin ? isSuperAdmin() : (user.role === 'superadmin');

  if (requireSuperAdmin && !isSuper) {
    return <Navigate to="/dashboard" replace />;
  }

  // Guard routes against non-permitted roles (e.g. Marketer / Agent accessing Billing or Team)
  if (allowedRoles && Array.isArray(allowedRoles) && !isSuper) {
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public Legal & Compliance Pages */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/tos" element={<TermsOfService />} />

      {/* Public Auth Routes & OAuth Callbacks */}
      <Route path="/whatsapp/callback" element={<WhatsAppOAuthCallback />} />
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<Login initialView="forgot" />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Protected SaaS App Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route
          path="/contacts/groups"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <ContactGroups />
            </ProtectedRoute>
          }
        />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route
          path="/imports"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <CsvImport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/export"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <ExportContacts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/export"
          element={<Navigate to="/export" replace />}
        />
        <Route
          path="/tags"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <Tags />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tags/:id"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <TagDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/tags"
          element={<Navigate to="/tags" replace />}
        />
        <Route
          path="/whatsapp"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <WhatsAppAccounts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/whatsapp/accounts/:id"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <WhatsAppAccountDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/whatsapp/:id"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <WhatsAppAccountDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <Templates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates/:id"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <TemplateDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interactive-buttons"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin']}>
              <InteractiveButtons />
            </ProtectedRoute>
          }
        />
        <Route
          path="/whatsapp/interactive-buttons"
          element={<Navigate to="/interactive-buttons" replace />}
        />
        <Route
          path="/automations"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <AutomationsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations/:id/builder"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <AutomationBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations/:id/canvas"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <FlowCanvasBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations/:id"
          element={<Navigate to="/automations/:id/builder" replace />}
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <ProductLibrary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <CampaignList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/new"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <CampaignBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:id"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <CampaignDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:id/report"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <CampaignReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaign-reports"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <CampaignReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/reports"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <CampaignReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/message-reports"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <MessageReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/reports"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <MessageReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contact-reports"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <ContactReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/reports"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <ContactReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/:tab"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin', 'marketer']}>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route path="/ai-assistant" element={<AiAssistant />} />
        <Route
          path="/team"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin']}>
              <TeamManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin']}>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity-logs"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin']}>
              <ActivityLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* SuperAdmin Legacy Console inside client layout */}
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute requireSuperAdmin={true}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Dedicated SuperAdmin Platform Management Suite */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireSuperAdmin={true}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="dashboard" element={<AdminOverview />} />
        <Route path="tenants" element={<AdminTenants />} />
        <Route path="tenants/:id" element={<AdminBusinessDetail />} />
        <Route path="businesses" element={<AdminTenants />} />
        <Route path="businesses/:id" element={<AdminBusinessDetail />} />
        <Route path="business-list" element={<AdminTenants />} />
        <Route path="numbers" element={<AdminNumbers />} />
        <Route path="billing" element={<AdminBilling />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="meta" element={<AdminMeta />} />
        <Route path="meta-monitoring" element={<AdminMetaMonitoring />} />
        <Route path="accounts" element={<AdminAccounts />} />
        <Route path="ai-support" element={<AdminAiSupport />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
