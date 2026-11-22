import { executeQuery, isUsingFallback } from '../../database/db.js';

/**
 * 1. Main Dashboard & Overview Analytics - 100% Direct from Database
 * Strictly queries MySQL without fabricating dummy data or mock insertions.
 */
export async function getDashboardStats(businessId, timeRange = 'Last 7 Days', user = null) {
  const normalizedRange = String(timeRange || 'Last 7 Days').trim();
  const numBusinessId = Number(businessId);

  // Construct SQL date conditions according to selected timeRange
  let dateFilter = '';
  let contactDateFilter = '';

  if (normalizedRange === 'Today') {
    dateFilter = 'AND DATE(created_at) = CURDATE()';
    contactDateFilter = 'AND DATE(created_at) = CURDATE()';
  } else if (normalizedRange === 'Last 7 Days') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    contactDateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (normalizedRange === 'Last 30 Days') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    contactDateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  } else if (normalizedRange === 'This Month') {
    dateFilter = "AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')";
    contactDateFilter = "AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')";
  }

  // 1. Contacts Count directly from MySQL
  let allTimeContacts = 0;
  let periodContacts = 0;
  try {
    const contactRows = await executeQuery(
      `SELECT COUNT(*) as total FROM contacts WHERE business_id = ?`,
      [numBusinessId]
    );
    allTimeContacts = Number(contactRows?.[0]?.total || 0);

    const periodRows = await executeQuery(
      `SELECT COUNT(*) as total FROM contacts WHERE business_id = ? ${contactDateFilter}`,
      [numBusinessId]
    );
    periodContacts = Number(periodRows?.[0]?.total || 0);
  } catch (err) {
    console.error('[Analytics] Error querying contacts:', err.message);
  }

  // 2. Campaign Aggregations directly from MySQL
  let totalCampaigns = 0;
  let campSent = 0;
  let campDelivered = 0;
  let campRead = 0;
  let campFailed = 0;

  try {
    const campAggRows = await executeQuery(
      `SELECT 
        COUNT(*) as totalCampaigns,
        COALESCE(SUM(sent_count), 0) as totalSent,
        COALESCE(SUM(delivered_count), 0) as totalDelivered,
        COALESCE(SUM(read_count), 0) as totalRead,
        COALESCE(SUM(failed_count), 0) as totalFailed
       FROM campaigns 
       WHERE business_id = ? AND status != 'scheduled' ${dateFilter}`,
      [numBusinessId]
    );
    const cStats = campAggRows?.[0];
    totalCampaigns = Number(cStats?.totalCampaigns || 0);
    campSent = Number(cStats?.totalSent || 0);
    campDelivered = Number(cStats?.totalDelivered || 0);
    campRead = Number(cStats?.totalRead || 0);
    campFailed = Number(cStats?.totalFailed || 0);
  } catch (err) {
    console.error('[Analytics] Error querying campaigns:', err.message);
  }

  // 3. Direct WhatsApp Messages from whatsapp_messages table
  let directSent = 0;
  let directDelivered = 0;
  let directRead = 0;
  let directFailed = 0;
  let directInbound = 0;

  try {
    const msgAggRows = await executeQuery(
      `SELECT 
        COUNT(CASE WHEN direction = 'OUTBOUND' THEN 1 END) as outSent,
        COUNT(CASE WHEN direction = 'OUTBOUND' AND message_status = 'delivered' THEN 1 END) as outDelivered,
        COUNT(CASE WHEN direction = 'OUTBOUND' AND message_status = 'read' THEN 1 END) as outRead,
        COUNT(CASE WHEN direction = 'OUTBOUND' AND message_status = 'failed' THEN 1 END) as outFailed,
        COUNT(CASE WHEN direction = 'INBOUND' THEN 1 END) as inReceived
       FROM whatsapp_messages
       WHERE business_id = ? ${dateFilter}`,
      [numBusinessId]
    );
    const mStats = msgAggRows?.[0];
    directSent = Number(mStats?.outSent || 0);
    directDelivered = Number(mStats?.outDelivered || 0);
    directRead = Number(mStats?.outRead || 0);
    directFailed = Number(mStats?.outFailed || 0);
    directInbound = Number(mStats?.inReceived || 0);
  } catch (err) {
    // If whatsapp_messages does not exist or empty, graceful zero
  }

  // Combined totals (Broadcasts + 1-on-1 Messages)
  const totalSent = campSent + directSent;
  const totalDelivered = campDelivered + directDelivered;
  const totalRead = campRead + directRead;
  const totalFailed = campFailed + directFailed;

  const deliveryRate = totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(1)) : 0;
  const readRate = totalDelivered > 0 ? Number(((totalRead / totalDelivered) * 100).toFixed(1)) : 0;
  const failedRate = totalSent > 0 ? Number(((totalFailed / totalSent) * 100).toFixed(1)) : 0;

  // 4. WhatsApp Accounts directly from MySQL (NO hardcoded TechSky Media)
  let accountsList = [];
  try {
    const accountRows = await executeQuery(
      `SELECT id, display_name, phone_number, phone_number_id, status, connection_status, is_primary, updated_at 
       FROM whatsapp_accounts WHERE business_id = ? ORDER BY is_primary DESC, id ASC LIMIT 10`,
      [numBusinessId]
    );

    if (Array.isArray(accountRows)) {
      accountsList = accountRows.map(acc => ({
        id: acc.id,
        name: acc.display_name || acc.phone_number || 'WhatsApp Line',
        phone: acc.phone_number || acc.phone_number_id || '',
        status: (acc.status === 'connected' || acc.connection_status === 'CONNECTED') ? 'Connected' : 'Disconnected',
        isPrimary: Boolean(acc.is_primary)
      }));
    }
  } catch (err) {
    console.error('[Analytics] Error fetching accounts:', err.message);
  }

  // 5. Recent Campaigns directly from MySQL (NO auto-seeding dummy rows)
  let recentCampaignsList = [];
  try {
    const campaignRows = await executeQuery(
      `SELECT c.id, c.name, c.status, c.total_recipients, c.sent_count, c.delivered_count, c.read_count, c.failed_count, c.created_at,
              t.name as template_name
       FROM campaigns c
       LEFT JOIN templates t ON c.template_id = t.id
       WHERE c.business_id = ? AND c.status != 'scheduled' ${dateFilter} 
       ORDER BY c.id DESC LIMIT 10`,
      [numBusinessId]
    );

    if (Array.isArray(campaignRows)) {
      recentCampaignsList = campaignRows.map(c => {
        const sent = Number(c.sent_count || 0);
        const del = Number(c.delivered_count || 0);
        const read = Number(c.read_count || 0);
        const rate = sent > 0 ? Number(((del / sent) * 100).toFixed(1)) : 0;
        const rRate = del > 0 ? Number(((read / del) * 100).toFixed(1)) : 0;
        return {
          id: c.id,
          name: c.name || `Campaign #${c.id}`,
          templateName: c.template_name || '',
          status: c.status || 'completed',
          totalRecipients: Number(c.total_recipients || sent || 0),
          sent,
          delivered: del,
          read,
          failed: Number(c.failed_count || 0),
          deliveryRate: rate,
          readRate: rRate,
          createdAt: c.created_at
        };
      });
    }
  } catch (err) {
    console.error('[Analytics] Error fetching recent campaigns:', err.message);
  }

  // 6. Scheduled Campaigns directly from MySQL (NO auto-seeding dummy rows)
  let scheduledCampaignsList = [];
  try {
    const schedRows = await executeQuery(
      `SELECT id, name, status, scheduled_at, created_at 
       FROM campaigns WHERE business_id = ? AND status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 10`,
      [numBusinessId]
    );

    if (Array.isArray(schedRows)) {
      scheduledCampaignsList = schedRows.map(s => ({
        id: s.id,
        name: s.name || `Campaign #${s.id}`,
        status: 'Scheduled',
        scheduledAt: s.scheduled_at,
        createdAt: s.created_at
      }));
    }
  } catch (err) {
    console.error('[Analytics] Error fetching scheduled campaigns:', err.message);
  }

  // 7. Delivery Trend over selected time range (Real daily data points)
  let deliveryTrend = [];
  try {
    const trendMap = {};
    const dateLabels = [];
    const totalDays = normalizedRange === 'Today' ? 1 : (normalizedRange === 'Last 7 Days' ? 7 : (normalizedRange === 'This Month' ? new Date().getDate() : 30));
    const step = normalizedRange === 'Last 30 Days' ? 2 : 1;

    for (let i = totalDays; i >= 0; i -= step) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      trendMap[key] = { date: label, sent: 0, delivered: 0, failed: 0 };
      dateLabels.push(key);
    }

    // Query campaigns daily trend
    const campTrendRows = await executeQuery(
      `SELECT 
        DATE(created_at) as dt,
        COALESCE(SUM(sent_count), 0) as sent,
        COALESCE(SUM(delivered_count), 0) as delivered,
        COALESCE(SUM(failed_count), 0) as failed
       FROM campaigns 
       WHERE business_id = ? AND status != 'scheduled' ${dateFilter}
       GROUP BY dt
       ORDER BY dt ASC`,
      [numBusinessId]
    );

    if (Array.isArray(campTrendRows)) {
      for (const r of campTrendRows) {
        if (!r.dt) continue;
        const dStr = new Date(r.dt).toISOString().split('T')[0];
        if (!trendMap[dStr]) {
          const label = new Date(r.dt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          trendMap[dStr] = { date: label, sent: 0, delivered: 0, failed: 0 };
          dateLabels.push(dStr);
        }
        trendMap[dStr].sent += Number(r.sent || 0);
        trendMap[dStr].delivered += Number(r.delivered || 0);
        trendMap[dStr].failed += Number(r.failed || 0);
      }
    }

    // Query whatsapp_messages daily trend
    try {
      const msgTrendRows = await executeQuery(
        `SELECT 
          DATE(created_at) as dt,
          COUNT(CASE WHEN direction = 'OUTBOUND' THEN 1 END) as sent,
          COUNT(CASE WHEN direction = 'OUTBOUND' AND message_status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN direction = 'OUTBOUND' AND message_status = 'failed' THEN 1 END) as failed
         FROM whatsapp_messages
         WHERE business_id = ? ${dateFilter}
         GROUP BY dt
         ORDER BY dt ASC`,
        [numBusinessId]
      );

      if (Array.isArray(msgTrendRows)) {
        for (const r of msgTrendRows) {
          if (!r.dt) continue;
          const dStr = new Date(r.dt).toISOString().split('T')[0];
          if (!trendMap[dStr]) {
            const label = new Date(r.dt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
            trendMap[dStr] = { date: label, sent: 0, delivered: 0, failed: 0 };
            dateLabels.push(dStr);
          }
          trendMap[dStr].sent += Number(r.sent || 0);
          trendMap[dStr].delivered += Number(r.delivered || 0);
          trendMap[dStr].failed += Number(r.failed || 0);
        }
      }
    } catch (_) { }

    dateLabels.sort();
    deliveryTrend = dateLabels.map(key => trendMap[key]);
  } catch (err) {
    console.error('[Analytics] Error computing delivery trend:', err.message);
  }

  // 8. Contact Growth trend over selected period
  let contactGrowth = [];
  try {
    const cgMap = {};
    const cgDays = normalizedRange === 'Today' ? 1 : (normalizedRange === 'Last 7 Days' ? 7 : 14);
    for (let i = cgDays; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      cgMap[key] = { date: label, contacts: 0 };
    }

    const cgRows = await executeQuery(
      `SELECT DATE(created_at) as dt, COUNT(*) as cnt 
       FROM contacts WHERE business_id = ? ${contactDateFilter} 
       GROUP BY dt ORDER BY dt ASC`,
      [numBusinessId]
    );

    let runningTotal = Math.max(0, allTimeContacts - periodContacts);
    if (Array.isArray(cgRows)) {
      for (const r of cgRows) {
        if (!r.dt) continue;
        const dStr = new Date(r.dt).toISOString().split('T')[0];
        runningTotal += Number(r.cnt || 0);
        if (cgMap[dStr]) {
          cgMap[dStr].contacts = runningTotal;
        }
      }
    }

    // Fill forward running total
    let lastVal = runningTotal;
    const sortedKeys = Object.keys(cgMap).sort();
    sortedKeys.forEach(k => {
      if (cgMap[k].contacts === 0 && lastVal > 0) {
        cgMap[k].contacts = lastVal;
      } else if (cgMap[k].contacts > 0) {
        lastVal = cgMap[k].contacts;
      }
    });

    contactGrowth = sortedKeys.map(k => cgMap[k]);
  } catch (_) { }

  // 9. Campaign Performance Bar Chart data
  const campaignPerformance = recentCampaignsList.slice(0, 8).map(c => ({
    name: c.name,
    sent: c.sent,
    delivered: c.delivered
  }));

  return {
    timeRange: normalizedRange,
    kpis: {
      totalContacts: allTimeContacts,
      newContacts: periodContacts,
      totalCampaigns,
      messagesSent: totalSent,
      deliveredMessages: totalDelivered,
      readMessages: totalRead,
      failedMessages: totalFailed,
      inboundMessages: directInbound,
      deliveryRate,
      readRate,
      failedRate
    },
    deliverySummary: {
      deliveryRate,
      sent: totalSent,
      sentPct: 100,
      delivered: totalDelivered,
      deliveredPct: deliveryRate,
      read: totalRead,
      readPct: readRate,
      failed: totalFailed,
      failedPct: failedRate
    },
    statusDistribution: [
      { name: 'Sent', value: totalSent, color: '#6366f1' },
      { name: 'Delivered', value: totalDelivered, color: '#10b981' },
      { name: 'Read', value: totalRead, color: '#06b6d4' },
      { name: 'Failed', value: totalFailed, color: '#ef4444' }
    ],
    deliveryTrend,
    contactGrowth,
    campaignPerformance,
    recentCampaigns: recentCampaignsList,
    scheduledCampaigns: scheduledCampaignsList,
    accounts: accountsList
  };
}

/**
 * 2. Detailed Campaign Analytics Breakdown from MySQL
 */
export async function getCampaignAnalytics(businessId, query = {}) {
  const numBusinessId = Number(businessId);
  const timeRange = query.timeRange || query.period || 'Last 7 Days';
  let dateFilter = '';

  if (timeRange === 'Today') {
    dateFilter = 'AND DATE(c.created_at) = CURDATE()';
  } else if (timeRange === 'Last 7 Days') {
    dateFilter = 'AND c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (timeRange === 'Last 30 Days') {
    dateFilter = 'AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  } else if (timeRange === 'This Month') {
    dateFilter = "AND c.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')";
  }

  try {
    const rows = await executeQuery(
      `SELECT 
        c.id, c.name, c.status, c.total_recipients,
        c.sent_count, c.delivered_count, c.read_count, c.failed_count,
        c.created_at,
        t.name as template_name,
        wa.display_name as account_name
       FROM campaigns c
       LEFT JOIN templates t ON c.template_id = t.id
       LEFT JOIN whatsapp_accounts wa ON c.whatsapp_account_id = wa.id
       WHERE c.business_id = ? ${dateFilter}
       ORDER BY c.id DESC LIMIT 50`,
      [numBusinessId]
    );

    const list = (rows || []).map(c => {
      const sent = Number(c.sent_count || 0);
      const del = Number(c.delivered_count || 0);
      const read = Number(c.read_count || 0);
      const failed = Number(c.failed_count || 0);
      const deliveryRate = sent > 0 ? Number(((del / sent) * 100).toFixed(1)) : 0;
      const readRate = del > 0 ? Number(((read / del) * 100).toFixed(1)) : 0;

      return {
        id: c.id,
        name: c.name || `Campaign #${c.id}`,
        status: c.status || 'completed',
        totalRecipients: Number(c.total_recipients || sent || 0),
        sent,
        delivered: del,
        read,
        failed,
        deliveryRate,
        readRate,
        templateName: c.template_name || '',
        accountName: c.account_name || '',
        createdAt: c.created_at
      };
    });

    const totalSent = list.reduce((acc, c) => acc + c.sent, 0);
    const totalDelivered = list.reduce((acc, c) => acc + c.delivered, 0);
    const totalRead = list.reduce((acc, c) => acc + c.read, 0);
    const totalFailed = list.reduce((acc, c) => acc + c.failed, 0);

    return {
      campaigns: list,
      summary: {
        totalCampaigns: list.length,
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        avgDeliveryRate: totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(1)) : 0,
        avgReadRate: totalDelivered > 0 ? Number(((totalRead / totalDelivered) * 100).toFixed(1)) : 0
      }
    };
  } catch (err) {
    console.error('[Analytics] Error in getCampaignAnalytics:', err);
    return { campaigns: [], summary: {} };
  }
}

/**
 * 3. Message Volume & Hourly Activity from MySQL
 */
export async function getMessageAnalytics(businessId, query = {}) {
  const numBusinessId = Number(businessId);
  const timeRange = query.timeRange || query.period || 'Last 7 Days';
  let dateFilter = '';

  if (timeRange === 'Today') {
    dateFilter = 'AND DATE(created_at) = CURDATE()';
  } else if (timeRange === 'Last 7 Days') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (timeRange === 'Last 30 Days') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  } else if (timeRange === 'This Month') {
    dateFilter = "AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')";
  }

  try {
    const hourlyMap = {};
    for (let h = 0; h < 24; h++) {
      const label = `${h.toString().padStart(2, '0')}:00`;
      hourlyMap[h] = { hour: label, outbound: 0, inbound: 0, total: 0 };
    }

    const hourlyRows = await executeQuery(
      `SELECT 
        HOUR(created_at) as hr,
        COUNT(CASE WHEN direction = 'OUTBOUND' THEN 1 END) as outbound,
        COUNT(CASE WHEN direction = 'INBOUND' THEN 1 END) as inbound
       FROM whatsapp_messages 
       WHERE business_id = ? ${dateFilter}
       GROUP BY hr`,
      [numBusinessId]
    );

    if (Array.isArray(hourlyRows)) {
      for (const r of hourlyRows) {
        const h = Number(r.hr);
        if (hourlyMap[h]) {
          hourlyMap[h].outbound = Number(r.outbound || 0);
          hourlyMap[h].inbound = Number(r.inbound || 0);
          hourlyMap[h].total = hourlyMap[h].outbound + hourlyMap[h].inbound;
        }
      }
    }

    const typeRows = await executeQuery(
      `SELECT 
        COUNT(CASE WHEN direction = 'OUTBOUND' THEN 1 END) as totalOutbound,
        COUNT(CASE WHEN direction = 'INBOUND' THEN 1 END) as totalInbound,
        COUNT(CASE WHEN message_status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN message_status = 'read' THEN 1 END) as \`read\`,
        COUNT(CASE WHEN message_status = 'failed' THEN 1 END) as failed
       FROM whatsapp_messages
       WHERE business_id = ? ${dateFilter}`,
      [numBusinessId]
    );

    const counts = typeRows?.[0] || {};

    let messagesList = [];
    try {
      const msgListRows = await executeQuery(
        `SELECT id, customer_phone, direction, message_type, message_body, message_status, created_at
         FROM whatsapp_messages
         WHERE business_id = ? ${dateFilter}
         ORDER BY id DESC LIMIT 50`,
        [numBusinessId]
      );
      if (Array.isArray(msgListRows)) {
        messagesList = msgListRows;
      }
    } catch (_) {}

    return {
      hourlyActivity: Object.values(hourlyMap),
      inboundCount: Number(counts.totalInbound || 0),
      outboundCount: Number(counts.totalOutbound || 0),
      deliveredCount: Number(counts.delivered || 0),
      readCount: Number(counts.read || 0),
      failedCount: Number(counts.failed || 0),
      messages: messagesList
    };
  } catch (err) {
    console.error('[Analytics] Error in getMessageAnalytics:', err);
    return { hourlyActivity: [], inboundCount: 0, outboundCount: 0, deliveredCount: 0, readCount: 0, failedCount: 0 };
  }
}

/**
 * 4. WhatsApp Template Performance from MySQL
 */
export async function getTemplateAnalytics(businessId) {
  const numBusinessId = Number(businessId);
  try {
    const rows = await executeQuery(
      `SELECT 
        t.id, t.name, t.category, t.language, t.status,
        COUNT(c.id) as usageCount,
        COALESCE(SUM(c.sent_count), 0) as totalSent,
        COALESCE(SUM(c.delivered_count), 0) as totalDelivered,
        COALESCE(SUM(c.read_count), 0) as totalRead
       FROM templates t
       LEFT JOIN campaigns c ON c.template_id = t.id AND c.business_id = t.business_id
       WHERE t.business_id = ?
       GROUP BY t.id
       ORDER BY usageCount DESC, totalSent DESC LIMIT 30`,
      [numBusinessId]
    );

    const templates = (rows || []).map(t => {
      const sent = Number(t.totalSent || 0);
      const del = Number(t.totalDelivered || 0);
      const read = Number(t.totalRead || 0);
      return {
        id: t.id,
        name: t.name,
        category: t.category || 'MARKETING',
        language: t.language || 'en',
        status: t.status || 'APPROVED',
        usageCount: Number(t.usageCount || 0),
        totalSent: sent,
        totalDelivered: del,
        totalRead: read,
        deliveryRate: sent > 0 ? Number(((del / sent) * 100).toFixed(1)) : 0,
        readRate: del > 0 ? Number(((read / del) * 100).toFixed(1)) : 0
      };
    });

    return { templates };
  } catch (err) {
    console.error('[Analytics] Error in getTemplateAnalytics:', err);
    return { templates: [] };
  }
}

// Aliases for route compatibility
export const getOverviewAnalytics = getDashboardStats;
export const getNumberAnalytics = async (businessId) => {
  const numBusinessId = Number(businessId);
  const rows = await executeQuery(
    `SELECT id, display_name, phone_number, status, connection_status FROM whatsapp_accounts WHERE business_id = ?`,
    [numBusinessId]
  );
  return { numbers: rows || [] };
};
export const getContactAnalytics = async (businessId) => {
  const numBusinessId = Number(businessId);
  const rows = await executeQuery(
    `SELECT COUNT(*) as total FROM contacts WHERE business_id = ?`,
    [numBusinessId]
  );
  return { total: rows?.[0]?.total || 0 };
};
export const getConversationAnalytics = async (businessId) => {
  return { conversations: [] };
};
export const getRevenueAnalytics = async () => {
  return { revenue: [] };
};
export const exportAnalyticsData = async (businessId, query = {}) => {
  const stats = await getDashboardStats(businessId, query.timeRange || query.period || 'Last 7 Days');
  const campaigns = await getCampaignAnalytics(businessId, query);

  let csv = 'Metric,Value\n';
  csv += `Total Contacts,${stats.kpis?.totalContacts || 0}\n`;
  csv += `Messages Sent,${stats.kpis?.messagesSent || 0}\n`;
  csv += `Delivered Messages,${stats.kpis?.deliveredMessages || 0}\n`;
  csv += `Read Receipts,${stats.kpis?.readMessages || 0}\n`;
  csv += `Delivery Success Rate,${stats.kpis?.deliveryRate || 0}%\n`;
  csv += `Read Rate,${stats.kpis?.readRate || 0}%\n\n`;

  csv += 'Campaign ID,Campaign Name,Status,Recipients,Sent,Delivered,Read,Failed,Delivery Rate (%)\n';
  (campaigns.campaigns || []).forEach(c => {
    csv += `"${c.id}","${(c.name || '').replace(/"/g, '""')}","${c.status}",${c.totalRecipients},${c.sent},${c.delivered},${c.read},${c.failed},${c.deliveryRate}%\n`;
  });

  return {
    content: csv,
    mimeType: 'text/csv; charset=utf-8',
    filename: `analytics_report_${new Date().toISOString().slice(0, 10)}.csv`
  };
};

export default {
  getDashboardStats,
  getOverviewAnalytics,
  getCampaignAnalytics,
  getMessageAnalytics,
  getTemplateAnalytics,
  getNumberAnalytics,
  getContactAnalytics,
  getConversationAnalytics,
  getRevenueAnalytics,
  exportAnalyticsData
};
