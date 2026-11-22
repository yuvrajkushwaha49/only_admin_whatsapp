import { Router } from 'express';
import * as analyticsService from './analytics.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';

const router = Router();

// Base middleware for authentication and tenant isolation
router.use(authenticate, requireTenant);

// Helper to determine effective businessId (SuperAdmin can pass client/businessId query param)
function getEffectiveBusinessId(req) {
  if (req.user?.role === 'superadmin' && req.query.businessId) {
    return Number(req.query.businessId);
  }
  return req.businessId;
}

// 1. Legacy Dashboard Endpoint (Preserved for /dashboard)
router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = await analyticsService.getDashboardStats(getEffectiveBusinessId(req), req.query.timeRange, req.user);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// 2. Overview Analytics
router.get('/overview', async (req, res, next) => {
  try {
    const data = await analyticsService.getOverviewAnalytics(getEffectiveBusinessId(req), req.query, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// 3. Detailed Message Analytics
router.get('/messages', async (req, res, next) => {
  try {
    const data = await analyticsService.getMessageAnalytics(getEffectiveBusinessId(req), req.query, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// 4. Campaign Performance Analytics
router.get('/campaigns', async (req, res, next) => {
  try {
    const data = await analyticsService.getCampaignAnalytics(getEffectiveBusinessId(req), req.query, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// 5. WhatsApp Number Analytics
router.get('/numbers', async (req, res, next) => {
  try {
    const data = await analyticsService.getNumberAnalytics(getEffectiveBusinessId(req), req.query, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// 6. Contact Analytics
router.get('/contacts', async (req, res, next) => {
  try {
    const data = await analyticsService.getContactAnalytics(getEffectiveBusinessId(req), req.query, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// 7. Conversation Analytics
router.get('/conversations', async (req, res, next) => {
  try {
    const data = await analyticsService.getConversationAnalytics(getEffectiveBusinessId(req), req.query, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// 8. WhatsApp Template Analytics
router.get('/templates', async (req, res, next) => {
  try {
    const data = await analyticsService.getTemplateAnalytics(getEffectiveBusinessId(req), req.query, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// 9. Revenue & SaaS Usage Analytics (Super Admin Only)
router.get('/revenue', async (req, res, next) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Revenue analytics is restricted to Super Administrators only.'
      });
    }
    const data = await analyticsService.getRevenueAnalytics(req.query, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// 10. Export Analytics (CSV / Excel stream)
router.get('/export', async (req, res, next) => {
  try {
    const exportResult = await analyticsService.exportAnalyticsData(getEffectiveBusinessId(req), req.query, req.user);
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.send(exportResult.content);
  } catch (error) {
    next(error);
  }
});

export default router;
