import { Router } from 'express';
import * as analyticsService from './analytics.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

// Dashboard & Overview
router.get(['/', '/dashboard', '/overview'], async (req, res, next) => {
  try {
    const stats = await analyticsService.getDashboardStats(req.businessId, req.query.timeRange, req.user);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// Campaign detailed analytics
router.get('/campaigns', async (req, res, next) => {
  try {
    const data = await analyticsService.getCampaignAnalytics(req.businessId, req.query.timeRange);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Message hourly and direction volume analytics
router.get('/messages', async (req, res, next) => {
  try {
    const data = await analyticsService.getMessageAnalytics(req.businessId, req.query.timeRange);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Template performance analytics
router.get('/templates', async (req, res, next) => {
  try {
    const data = await analyticsService.getTemplateAnalytics(req.businessId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Export analytics summary report
router.get('/export', async (req, res, next) => {
  try {
    const stats = await analyticsService.getDashboardStats(req.businessId, req.query.timeRange, req.user);
    const campaigns = await analyticsService.getCampaignAnalytics(req.businessId, req.query.timeRange);

    let csv = 'Type,Metric,Value\n';
    csv += `KPI,Total Contacts,${stats.kpi?.totalContacts || 0}\n`;
    csv += `KPI,Messages Sent,${stats.kpi?.messagesSent || 0}\n`;
    csv += `KPI,Total Campaigns,${stats.kpi?.totalCampaigns || 0}\n`;
    csv += `KPI,Delivery Rate,${stats.deliverySummary?.deliveryRate || 0}%\n`;
    csv += `KPI,Delivered,${stats.deliverySummary?.delivered || 0}\n`;
    csv += `KPI,Read,${stats.deliverySummary?.read || 0}\n`;
    csv += `KPI,Failed,${stats.deliverySummary?.failed || 0}\n\n`;

    csv += 'Campaign ID,Campaign Name,Status,Recipients,Sent,Delivered,Read,Failed,Delivery Rate (%),Read Rate (%)\n';
    (campaigns.campaigns || []).forEach(c => {
      csv += `"${c.id}","${(c.name || '').replace(/"/g, '""')}","${c.status}",${c.totalRecipients},${c.sent},${c.delivered},${c.read},${c.failed},${c.deliveryRate}%,${c.readRate}%\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="analytics_report_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
