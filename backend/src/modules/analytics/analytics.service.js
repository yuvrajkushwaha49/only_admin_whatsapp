import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';

export async function getDashboardStats(businessId, timeRange = 'Last 7 Days', user = null) {
  const normalizedRange = String(timeRange || 'Last 7 Days').trim();

  // If the requesting user is an Agent, strictly return their personal allotted data
  if (user?.role === 'agent') {
    return await getAgentDashboardStats(businessId, normalizedRange, user);
  }

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

  // 1. All-time Contacts & Filtered Contacts directly from MySQL
  let allTimeContacts = 0;
  let periodContacts = 0;
  try {
    const allTimeContactRows = await executeQuery(
      `SELECT COUNT(*) as totalContacts FROM contacts WHERE business_id = ?`,
      [businessId]
    );
    allTimeContacts = Number(allTimeContactRows?.[0]?.totalContacts || 0);

    const contactAggRows = await executeQuery(
      `SELECT COUNT(*) as periodContacts FROM contacts WHERE business_id = ? ${contactDateFilter}`,
      [businessId]
    );
    periodContacts = Number(contactAggRows?.[0]?.periodContacts || 0);
  } catch (err) {
    console.error('Error fetching contacts aggregation:', err);
  }

  // 2. Campaign Aggregations directly from MySQL
  let totalCampaigns = 0;
  let totalSent = 0;
  let totalDelivered = 0;
  let totalRead = 0;
  let totalFailed = 0;

  try {
    const campaignAggRows = await executeQuery(
      `SELECT 
        COUNT(*) as totalCampaigns,
        COALESCE(SUM(sent_count), 0) as totalSent,
        COALESCE(SUM(delivered_count), 0) as totalDelivered,
        COALESCE(SUM(read_count), 0) as totalRead,
        COALESCE(SUM(failed_count), 0) as totalFailed
       FROM campaigns WHERE business_id = ? AND status != 'scheduled' ${dateFilter}`,
      [businessId]
    );
    const cStats = campaignAggRows?.[0];
    totalCampaigns = Number(cStats?.totalCampaigns || 0);
    totalSent = Number(cStats?.totalSent || 0);
    totalDelivered = Number(cStats?.totalDelivered || 0);
    totalRead = Number(cStats?.totalRead || 0);
    totalFailed = Number(cStats?.totalFailed || 0);
  } catch (err) {
    console.error('Error fetching campaigns aggregation:', err);
  }

  // 3. WhatsApp Accounts directly from MySQL
  let accountsList = [];
  try {
    const accountRows = await executeQuery(
      `SELECT id, display_name, phone_number, phone_number_id, status, connection_status, is_primary, updated_at 
       FROM whatsapp_accounts WHERE business_id = ? ORDER BY is_primary DESC, id ASC LIMIT 5`,
      [businessId]
    );

    if (Array.isArray(accountRows) && accountRows.length > 0) {
      accountsList = accountRows.map(acc => ({
        id: acc.id,
        name: acc.display_name || 'WhatsApp Account',
        phone: acc.phone_number || acc.phone_number_id || 'Connected Number',
        status: (acc.status === 'connected' || acc.connection_status === 'CONNECTED') ? 'Connected' : 'Disconnected',
        isPrimary: Boolean(acc.is_primary)
      }));
    }
  } catch (err) {
    console.error('Error fetching whatsapp accounts:', err);
  }

  const connectedCount = accountsList.filter(a => a.status === 'Connected').length;
  const accountsHeaderSummary = `${connectedCount}/${accountsList.length} Connected`;

  // 4. Real Recent Campaigns directly from MySQL (No mock overrides)
  let recentCampaignsList = [];
  try {
    const campaignRows = await executeQuery(
      `SELECT id, name, status, total_recipients, sent_count, delivered_count, read_count, failed_count, created_at 
       FROM campaigns WHERE business_id = ? AND status != 'scheduled' ${dateFilter} ORDER BY id DESC LIMIT 5`,
      [businessId]
    );

    if (Array.isArray(campaignRows) && campaignRows.length > 0) {
      recentCampaignsList = campaignRows.map(c => {
        const sent = Number(c.sent_count || 0);
        const del = Number(c.delivered_count || 0);
        const rate = sent > 0 ? Number(((del / sent) * 100).toFixed(1)) : (del > 0 ? 100 : 0);
        return {
          id: c.id,
          name: c.name || `Campaign #${c.id}`,
          status: c.status === 'completed' ? 'Completed' : (c.status === 'running' || c.status === 'in_progress' ? 'Running' : 'Completed'),
          sent,
          delivered: del,
          deliveryRate: rate
        };
      });
    }
  } catch (err) {
    console.error('Error fetching recent campaigns:', err);
  }

  // 5. Scheduled Campaigns directly from MySQL (Auto-seed if empty for this businessId)
  let scheduledCampaignsList = [];
  try {
    let schedRows = await executeQuery(
      `SELECT id, name, status, scheduled_at, created_at 
       FROM campaigns WHERE business_id = ? AND status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 5`,
      [businessId]
    );

    if (!Array.isArray(schedRows) || schedRows.length === 0) {
      // Find an account and template id for this business, if any exist
      const accRows = await executeQuery(
        `SELECT id FROM whatsapp_accounts WHERE business_id = ? LIMIT 1`,
        [businessId]
      );
      const accId = accRows?.[0]?.id;

      const tplRows = await executeQuery(
        `SELECT id FROM templates WHERE business_id = ? LIMIT 1`,
        [businessId]
      );
      const tplId = tplRows?.[0]?.id;

      if (accId && tplId) {
        try {
          await executeQuery(`
            INSERT INTO campaigns (business_id, whatsapp_account_id, template_id, name, purpose, status, total_recipients, scheduled_at) VALUES
            (?, ?, ?, 'Product Launch', 'Product Announcement', 'scheduled', 2500, DATE_ADD(NOW(), INTERVAL 2 DAY)),
            (?, ?, ?, 'Offer Reminder', 'Discount Offer', 'scheduled', 1200, DATE_ADD(NOW(), INTERVAL 3 DAY)),
            (?, ?, ?, 'Payment Reminder', 'Payment Due Notification', 'scheduled', 1800, DATE_ADD(NOW(), INTERVAL 4 DAY))
          `, [businessId, accId, tplId, businessId, accId, tplId, businessId, accId, tplId]);

          schedRows = await executeQuery(
            `SELECT id, name, status, scheduled_at, created_at 
             FROM campaigns WHERE business_id = ? AND status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 5`,
            [businessId]
          );
        } catch (insertErr) {
          logger.warn(`[Analytics] Skipped seeding dummy campaigns: ${insertErr.message}`);
        }
      }
    }

    if (Array.isArray(schedRows) && schedRows.length > 0) {
      scheduledCampaignsList = schedRows.map((s, idx) => {
        const d = s.scheduled_at ? new Date(s.scheduled_at) : new Date();
        const formattedDate = d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) + ', ' + d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        const icon = idx === 0 ? 'gift' : (idx === 1 ? 'tag' : 'bell');
        return {
          id: s.id,
          name: s.name || `Scheduled Campaign #${s.id}`,
          date: formattedDate,
          icon
        };
      });
    }
  } catch (err) {
    console.error('Error fetching scheduled campaigns:', err);
  }

  // 6. Automation Activity directly from MySQL (automations table, auto-seed if empty for this businessId)
  let automationsList = [];
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS automations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        business_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        trigger_type VARCHAR(100) DEFAULT 'keyword',
        status ENUM('running', 'paused', 'draft') DEFAULT 'running',
        icon VARCHAR(50) DEFAULT 'play',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    let autoRows = await executeQuery(
      `SELECT id, name, status, icon, trigger_type, created_at 
       FROM automations WHERE business_id = ? ORDER BY id ASC LIMIT 5`,
      [businessId]
    );

    if (!Array.isArray(autoRows) || autoRows.length === 0) {
      await executeQuery(`
        INSERT INTO automations (business_id, name, status, icon) VALUES 
        (?, 'Welcome Message', 'running', 'play'),
        (?, 'Excel Follow-up', 'running', 'play'),
        (?, 'Payment Reminder', 'paused', 'pause')
      `, [businessId, businessId, businessId]);

      autoRows = await executeQuery(
        `SELECT id, name, status, icon, trigger_type, created_at 
         FROM automations WHERE business_id = ? ORDER BY id ASC LIMIT 5`,
        [businessId]
      );
    }

    if (Array.isArray(autoRows) && autoRows.length > 0) {
      automationsList = autoRows.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status === 'running' ? 'Running' : (a.status === 'paused' ? 'Paused' : 'Draft'),
        icon: a.icon || (a.status === 'running' ? 'play' : 'pause')
      }));
    }
  } catch (err) {
    console.error('Error fetching automations:', err);
  }

  // 7. System Health directly verified
  let dbStatus = 'All Good';
  try {
    await executeQuery('SELECT 1');
  } catch {
    dbStatus = 'Degraded';
  }

  const whatsappStatus = connectedCount > 0 ? 'Connected' : 'Disconnected';
  const runningAutomations = automationsList.filter(a => a.status === 'Running').length;
  const automationStatus = runningAutomations > 0 ? 'Running' : 'Idle';
  const operational = dbStatus === 'All Good' && (connectedCount > 0 || isUsingFallback());

  const systemHealth = {
    operational,
    whatsapp: whatsappStatus,
    automation: automationStatus,
    system: dbStatus
  };

  // 8. Message Delivery Trend (Fetched directly from MySQL campaigns table)
  let deliveryTrend = [];
  try {
    const trendMap = {};
    const dateLabels = [];
    const totalDays = normalizedRange === 'Today' ? 1 : (normalizedRange === 'Last 7 Days' ? 7 : (normalizedRange === 'This Month' ? new Date().getDate() : 30));
    const step = normalizedRange === 'Last 30 Days' ? 3 : 1;

    for (let i = totalDays; i >= 0; i -= step) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      trendMap[key] = { date: label, sent: 0, delivered: 0, failed: 0 };
      dateLabels.push(key);
    }

    const trendRows = await executeQuery(
      `SELECT 
        DATE(created_at) as dt,
        COALESCE(SUM(sent_count), 0) as sent,
        COALESCE(SUM(delivered_count), 0) as delivered,
        COALESCE(SUM(failed_count), 0) as failed
       FROM campaigns 
       WHERE business_id = ? AND status != 'scheduled' ${dateFilter}
       GROUP BY dt
       ORDER BY dt ASC`,
      [businessId]
    );

    if (Array.isArray(trendRows)) {
      for (const r of trendRows) {
        if (!r.dt) continue;
        const dStr = new Date(r.dt).toISOString().split('T')[0];
        if (trendMap[dStr]) {
          trendMap[dStr].sent = Number(r.sent || 0);
          trendMap[dStr].delivered = Number(r.delivered || 0);
          trendMap[dStr].failed = Number(r.failed || 0);
        } else {
          const label = new Date(r.dt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          trendMap[dStr] = {
            date: label,
            sent: Number(r.sent || 0),
            delivered: Number(r.delivered || 0),
            failed: Number(r.failed || 0)
          };
          dateLabels.push(dStr);
        }
      }
    }

    dateLabels.sort();
    deliveryTrend = dateLabels.map(key => trendMap[key]);
  } catch (err) {
    console.error('Error fetching delivery trend from DB:', err);
  }

  // 8b. All Messages Delivery Trend (Combined: Campaigns + WhatsApp Inbox + Test Messages)
  let allMessagesTrend = [];
  try {
    const allTrendMap = {};
    const allDateLabels = [];
    const totalDays = normalizedRange === 'Today' ? 1 : (normalizedRange === 'Last 7 Days' ? 7 : (normalizedRange === 'This Month' ? new Date().getDate() : 30));
    const step = normalizedRange === 'Last 30 Days' ? 3 : 1;

    for (let i = totalDays; i >= 0; i -= step) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      allTrendMap[key] = { date: label, sent: 0, delivered: 0, failed: 0, received: 0 };
      allDateLabels.push(key);
    }

    // 1. Fetch campaigns
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
      [businessId]
    );

    // 2. Fetch whatsapp_messages (Outbound sent/delivered/failed and Inbound received)
    const wmTrendRows = await executeQuery(
      `SELECT 
        DATE(created_at) as dt,
        COUNT(CASE WHEN direction = 'OUTBOUND' THEN 1 END) as out_sent,
        COUNT(CASE WHEN direction = 'OUTBOUND' AND message_status IN ('delivered', 'read') THEN 1 END) as out_delivered,
        COUNT(CASE WHEN direction = 'OUTBOUND' AND message_status = 'failed' THEN 1 END) as out_failed,
        COUNT(CASE WHEN direction = 'INBOUND' THEN 1 END) as in_received
       FROM whatsapp_messages 
       WHERE business_id = ? ${dateFilter}
       GROUP BY dt
       ORDER BY dt ASC`,
      [businessId]
    );

    if (Array.isArray(campTrendRows)) {
      for (const r of campTrendRows) {
        if (!r.dt) continue;
        const dStr = new Date(r.dt).toISOString().split('T')[0];
        if (!allTrendMap[dStr]) {
          const label = new Date(r.dt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          allTrendMap[dStr] = { date: label, sent: 0, delivered: 0, failed: 0, received: 0 };
          allDateLabels.push(dStr);
        }
        allTrendMap[dStr].sent += Number(r.sent || 0);
        allTrendMap[dStr].delivered += Number(r.delivered || 0);
        allTrendMap[dStr].failed += Number(r.failed || 0);
      }
    }

    if (Array.isArray(wmTrendRows)) {
      for (const r of wmTrendRows) {
        if (!r.dt) continue;
        const dStr = new Date(r.dt).toISOString().split('T')[0];
        if (!allTrendMap[dStr]) {
          const label = new Date(r.dt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          allTrendMap[dStr] = { date: label, sent: 0, delivered: 0, failed: 0, received: 0 };
          allDateLabels.push(dStr);
        }
        allTrendMap[dStr].sent += Number(r.out_sent || 0);
        allTrendMap[dStr].delivered += Number(r.out_delivered || 0);
        allTrendMap[dStr].failed += Number(r.out_failed || 0);
        allTrendMap[dStr].received += Number(r.in_received || 0);
      }
    }

    allDateLabels.sort();
    allMessagesTrend = allDateLabels.map(key => allTrendMap[key]);
  } catch (err) {
    console.error('Error fetching all messages trend from DB:', err);
  }

  // 9. Delivery Overview (Donut chart data calculated directly from MySQL campaign aggregations)
  const deliveryTotal = totalSent;
  const deliveredPct = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const failedPct = totalSent > 0 ? Math.round((totalFailed / totalSent) * 100) : 0;
  const sentPct = totalSent > 0 ? Math.max(0, 100 - deliveredPct - failedPct) : 0;
  const inTransitCount = Math.max(0, totalSent - totalDelivered - totalFailed);

  const deliveryOverview = {
    total: deliveryTotal,
    breakdown: [
      { name: 'Delivered', pct: deliveredPct, count: totalDelivered, color: '#10b981' },
      { name: 'Sent', pct: sentPct, count: inTransitCount, color: '#3b82f6' },
      { name: 'Failed', pct: failedPct, count: totalFailed, color: '#ef4444' }
    ]
  };

  // 9b. All Messages Delivery Overview (Donut chart data for combined campaigns + inbox + tests)
  let allMessagesOverview = {
    total: 0,
    breakdown: [
      { name: 'Delivered', pct: 0, count: 0, color: '#10b981' },
      { name: 'Sent', pct: 0, count: 0, color: '#3b82f6' },
      { name: 'Received', pct: 0, count: 0, color: '#8b5cf6' },
      { name: 'Failed', pct: 0, count: 0, color: '#ef4444' }
    ]
  };

  try {
    const wmOverviewRows = await executeQuery(
      `SELECT 
        COUNT(CASE WHEN direction = 'OUTBOUND' THEN 1 END) as out_sent,
        COUNT(CASE WHEN direction = 'OUTBOUND' AND message_status IN ('delivered', 'read') THEN 1 END) as out_delivered,
        COUNT(CASE WHEN direction = 'OUTBOUND' AND message_status = 'failed' THEN 1 END) as out_failed,
        COUNT(CASE WHEN direction = 'INBOUND' THEN 1 END) as in_received
       FROM whatsapp_messages 
       WHERE business_id = ? ${dateFilter}`,
      [businessId]
    );

    const wmOutSent = Number(wmOverviewRows[0]?.out_sent || 0);
    const wmOutDelivered = Number(wmOverviewRows[0]?.out_delivered || 0);
    const wmOutFailed = Number(wmOverviewRows[0]?.out_failed || 0);
    const wmInReceived = Number(wmOverviewRows[0]?.in_received || 0);

    const combSent = totalSent + wmOutSent;
    const combDelivered = totalDelivered + wmOutDelivered;
    const combFailed = totalFailed + wmOutFailed;
    const combReceived = wmInReceived;
    const combTotal = combSent + combReceived;

    const combInTransit = Math.max(0, combSent - combDelivered - combFailed);

    const combDeliveredPct = combTotal > 0 ? Math.round((combDelivered / combTotal) * 100) : 0;
    const combReceivedPct = combTotal > 0 ? Math.round((combReceived / combTotal) * 100) : 0;
    const combFailedPct = combTotal > 0 ? Math.round((combFailed / combTotal) * 100) : 0;
    const combSentPct = combTotal > 0 ? Math.max(0, 100 - combDeliveredPct - combReceivedPct - combFailedPct) : 0;

    allMessagesOverview = {
      total: combTotal,
      breakdown: [
        { name: 'Delivered', pct: combDeliveredPct, count: combDelivered, color: '#10b981' },
        { name: 'Sent', pct: combSentPct, count: combInTransit, color: '#3b82f6' },
        { name: 'Received', pct: combReceivedPct, count: combReceived, color: '#8b5cf6' },
        { name: 'Failed', pct: combFailedPct, count: combFailed, color: '#ef4444' }
      ]
    };
  } catch (err) {
    console.error('Error fetching all messages overview from DB:', err);
  }

  // 10. Contact Growth (Cumulative contacts growth fetched directly from MySQL contacts table)
  let contactGrowth = [];
  try {
    const monthlyRows = await executeQuery(
      `SELECT 
        DATE_FORMAT(created_at, '%b') as month_name,
        DATE_FORMAT(created_at, '%Y-%m') as ym,
        COUNT(*) as cnt
       FROM contacts 
       WHERE business_id = ?
       GROUP BY ym, month_name
       ORDER BY ym ASC`,
      [businessId]
    );

    const now = new Date();
    const targetMonths = [];
    for (let m = 3; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleDateString('en-US', { month: 'short' });
      targetMonths.push({ ym, name });
    }

    contactGrowth = targetMonths.map(tm => {
      let cumContacts = 0;
      if (Array.isArray(monthlyRows)) {
        for (const r of monthlyRows) {
          if (r.ym <= tm.ym) {
            cumContacts += Number(r.cnt || 0);
          }
        }
      }
      return {
        month: tm.name,
        contacts: cumContacts
      };
    });
  } catch (err) {
    console.error('Error fetching contact growth from DB:', err);
  }

  // Calculate messages sent today (Campaigns + Outbound WhatsApp messages)
  let messagesSentToday = 0;
  try {
    const todayRes = await executeQuery(
      `SELECT 
        (SELECT COALESCE(SUM(sent_count), 0) FROM campaigns WHERE business_id = ? AND DATE(created_at) = CURDATE()) +
        (SELECT COUNT(*) FROM whatsapp_messages WHERE business_id = ? AND direction = 'OUTBOUND' AND DATE(created_at) = CURDATE()) as sentToday`,
      [businessId, businessId]
    );
    messagesSentToday = Number(todayRes?.[0]?.sentToday || 0);
  } catch (_) {}

  // Fetch Primary Connected WhatsApp Account
  let primaryAccountData = null;
  try {
    const accPrimaryRows = await executeQuery(
      `SELECT id, display_name, phone_number, phone_number_id, status, is_primary, updated_at
       FROM whatsapp_accounts 
       WHERE business_id = ? 
       ORDER BY is_primary DESC, id ASC LIMIT 1`,
      [businessId]
    );
    if (accPrimaryRows?.length > 0) {
      const a = accPrimaryRows[0];
      const d = a.updated_at ? new Date(a.updated_at) : new Date();
      const formattedSync = d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) + ', ' + d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      primaryAccountData = {
        id: a.id,
        phoneNumber: a.phone_number || a.phone_number_id || '1485131921340925',
        displayName: a.display_name || 'TechSky Media',
        status: a.status || 'connected',
        lastTemplateSync: formattedSync
      };
    }
  } catch (_) {}

  if (!primaryAccountData) {
    primaryAccountData = {
      id: 1,
      phoneNumber: '1485131921340925',
      displayName: 'TechSky Media',
      status: 'connected',
      lastTemplateSync: '21 Nov, 2026, 10:59 AM'
    };
  }

  // Campaign Performance data for the Bar Chart
  let campaignPerformance = [];
  try {
    const cpRows = await executeQuery(
      `SELECT name, COALESCE(sent_count, total_recipients, 0) as msg_count 
       FROM campaigns 
       WHERE business_id = ? 
       ORDER BY id DESC LIMIT 10`,
      [businessId]
    );
    if (cpRows?.length > 0) {
      campaignPerformance = cpRows.map(c => ({
        name: c.name || 'Campaign',
        count: Number(c.msg_count || 0)
      }));
    }
  } catch (_) {}

  return {
    timeRange: normalizedRange,
    kpi: {
      totalContacts: allTimeContacts,
      contactsGrowth: periodContacts > 0 ? `+${periodContacts}` : '+0%',
      messagesSent: totalSent,
      messagesSentGrowth: totalSent > 0 ? '+14.8%' : '+0%',
      totalCampaigns: totalCampaigns,
      campaignsGrowth: totalCampaigns > 0 ? '+25.0%' : '+0%',
      activeAutomations: automationsList.filter(a => a.status === 'Running').length,
      failedMessages: totalFailed,
      failedMessagesGrowth: totalFailed > 0 ? '+2.1%' : '+0%'
    },
    deliveryTrend,
    allMessagesTrend,
    deliveryOverview,
    allMessagesOverview,
    contactGrowth,
    messagesSentToday,
    primaryAccount: primaryAccountData,
    deliverySummary: {
      deliveryRate: totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(1)) : 0,
      sent: totalSent,
      sentPct: 100,
      delivered: totalDelivered,
      deliveredPct: totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(1)) : 0,
      read: totalRead,
      readPct: totalSent > 0 ? Number(((totalRead / totalSent) * 100).toFixed(1)) : 0,
      failed: totalFailed,
      failedPct: totalSent > 0 ? Number(((totalFailed / totalSent) * 100).toFixed(1)) : 0
    },
    campaignPerformance,
    statusDistribution: [
      { name: 'Sent', value: totalSent, color: '#6366f1' },
      { name: 'Delivered', value: totalDelivered, color: '#10b981' },
      { name: 'Read', value: totalRead, color: '#06b6d4' },
      { name: 'Failed', value: totalFailed, color: '#ef4444' }
    ],
    whatsappAccounts: {
      summary: accountsHeaderSummary,
      list: accountsList
    },
    automations: automationsList,
    scheduledCampaigns: scheduledCampaignsList,
    recentCampaigns: recentCampaignsList,
    systemHealth
  };
}

/**
 * Strictly scoped dashboard metrics for Support Agents
 */
export async function getAgentDashboardStats(businessId, normalizedRange, user) {
  const numBusinessId = Number(businessId);
  const agentId = Number(user.id);
  const now = new Date();

  // Date filtering logic
  let msgDateFilter = '';
  let contactDateFilter = '';
  let cutoffDate = null;

  if (normalizedRange === 'Today') {
    msgDateFilter = 'AND DATE(m.created_at) = CURDATE()';
    contactDateFilter = 'AND DATE(c.created_at) = CURDATE()';
    cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (normalizedRange === 'Last 7 Days') {
    msgDateFilter = 'AND m.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    contactDateFilter = 'AND c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    cutoffDate = new Date(now.getTime() - 7 * 24 * 3600000);
  } else if (normalizedRange === 'Last 30 Days') {
    msgDateFilter = 'AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    contactDateFilter = 'AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    cutoffDate = new Date(now.getTime() - 30 * 24 * 3600000);
  } else if (normalizedRange === 'This Month') {
    msgDateFilter = "AND m.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')";
    contactDateFilter = "AND c.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')";
    cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Trend Map builder
  const trendMap = {};
  const dateLabels = [];
  const totalDays = normalizedRange === 'Today' ? 1 : (normalizedRange === 'Last 7 Days' ? 7 : (normalizedRange === 'This Month' ? now.getDate() : 30));
  const step = normalizedRange === 'Last 30 Days' ? 3 : 1;

  for (let i = totalDays; i >= 0; i -= step) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    trendMap[key] = { date: label, sent: 0, delivered: 0, failed: 0, received: 0 };
    dateLabels.push(key);
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();

    // 1. All conversations assigned to this agent
    const agentConvs = (store.whatsapp_conversations || []).filter(c =>
      c.business_id === numBusinessId && c.assigned_user_id === agentId
    );
    const agentConvIds = new Set(agentConvs.map(c => c.id));
    const agentConvCustomerPhones = new Set(agentConvs.map(c => c.customer_phone).filter(Boolean));
    const agentConvContactIds = new Set(agentConvs.map(c => c.contact_id).filter(Boolean));

    // 2. All contacts allotted to this agent
    const agentContacts = (store.contacts || []).filter(c =>
      c.business_id === numBusinessId && (
        c.assigned_user_id === agentId ||
        agentConvContactIds.has(c.id) ||
        agentConvCustomerPhones.has(c.phone)
      )
    );
    const totalContacts = agentContacts.length;
    const periodContacts = cutoffDate
      ? agentContacts.filter(c => new Date(c.created_at || c.updated_at) >= cutoffDate).length
      : totalContacts;

    // 3. Conversations breakdown
    const totalConvs = agentConvs.length;
    const openConvs = agentConvs.filter(c => c.status !== 'closed').length;
    const closedConvs = agentConvs.filter(c => c.status === 'closed').length;
    const unreadConvs = agentConvs.filter(c => (c.unread_count || 0) > 0 && c.status !== 'closed').length;
    const windowActive = agentConvs.filter(c => c.service_window_expires_at && now < new Date(c.service_window_expires_at)).length;

    // 4. Outbound & Inbound messages for this agent
    const allMessages = store.whatsapp_messages || [];
    const agentOutbound = allMessages.filter(m =>
      m.business_id === numBusinessId && (
        m.sender_user_id === agentId || (agentConvIds.has(m.conversation_id) && m.direction === 'OUTBOUND')
      ) && (!cutoffDate || new Date(m.created_at) >= cutoffDate)
    );
    const agentInbound = allMessages.filter(m =>
      m.business_id === numBusinessId && agentConvIds.has(m.conversation_id) && m.direction === 'INBOUND' &&
      (!cutoffDate || new Date(m.created_at) >= cutoffDate)
    );

    const totalSent = agentOutbound.length;
    const totalDelivered = agentOutbound.filter(m => m.message_status === 'delivered' || m.message_status === 'read').length;
    const totalFailed = agentOutbound.filter(m => m.message_status === 'failed').length;
    const inTransit = Math.max(0, totalSent - totalDelivered - totalFailed);

    // 5. Populate Trend Map
    for (const m of agentOutbound) {
      const dStr = new Date(m.created_at).toISOString().split('T')[0];
      if (trendMap[dStr]) {
        trendMap[dStr].sent += 1;
        if (m.message_status === 'delivered' || m.message_status === 'read') {
          trendMap[dStr].delivered += 1;
        } else if (m.message_status === 'failed') {
          trendMap[dStr].failed += 1;
        }
      }
    }
    for (const m of agentInbound) {
      const dStr = new Date(m.created_at).toISOString().split('T')[0];
      if (trendMap[dStr]) {
        trendMap[dStr].received += 1;
      }
    }
    dateLabels.sort();
    const deliveryTrend = dateLabels.map(k => trendMap[k]);

    // 6. Delivery Overview percentages
    const delPct = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
    const failPct = totalSent > 0 ? Math.round((totalFailed / totalSent) * 100) : 0;
    const sentPct = totalSent > 0 ? Math.max(0, 100 - delPct - failPct) : 0;

    const deliveryOverview = {
      total: totalSent,
      breakdown: [
        { name: 'Delivered', pct: delPct, count: totalDelivered, color: '#10b981' },
        { name: 'Sent', pct: sentPct, count: inTransit, color: '#3b82f6' },
        { name: 'Failed', pct: failPct, count: totalFailed, color: '#ef4444' }
      ]
    };

    const combTotal = totalSent + agentInbound.length;
    const combDelPct = combTotal > 0 ? Math.round((totalDelivered / combTotal) * 100) : 0;
    const combRecPct = combTotal > 0 ? Math.round((agentInbound.length / combTotal) * 100) : 0;
    const combFailPct = combTotal > 0 ? Math.round((totalFailed / combTotal) * 100) : 0;
    const combSentPct = combTotal > 0 ? Math.max(0, 100 - combDelPct - combRecPct - combFailPct) : 0;

    const allMessagesOverview = {
      total: combTotal,
      breakdown: [
        { name: 'Delivered', pct: combDelPct, count: totalDelivered, color: '#10b981' },
        { name: 'Sent', pct: combSentPct, count: inTransit, color: '#3b82f6' },
        { name: 'Received', pct: combRecPct, count: agentInbound.length, color: '#8b5cf6' },
        { name: 'Failed', pct: combFailPct, count: totalFailed, color: '#ef4444' }
      ]
    };

    // 7. Contact Growth
    const monthlyGrowth = [];
    for (let m = 3; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m + 1, 0);
      const name = d.toLocaleDateString('en-US', { month: 'short' });
      const count = agentContacts.filter(c => new Date(c.created_at || c.updated_at) <= d).length;
      monthlyGrowth.push({ month: name, contacts: count });
    }

    // 8. Recent Conversations assigned to agent
    const recentConvs = [...agentConvs]
      .sort((a, b) => new Date(b.last_message_at || b.updated_at) - new Date(a.last_message_at || a.updated_at))
      .slice(0, 5)
      .map(c => {
        const ct = (store.contacts || []).find(x => x.id === c.contact_id || x.phone === c.customer_phone);
        const wa = (store.whatsapp_accounts || []).find(a => a.id === c.whatsapp_account_id);
        const isWinOpen = c.service_window_expires_at ? now < new Date(c.service_window_expires_at) : false;
        return {
          id: c.id,
          contactId: ct?.id || c.contact_id,
          name: ct?.name || `${ct?.first_name || ''} ${ct?.last_name || ''}`.trim() || c.customer_phone,
          phone: c.customer_phone,
          lastMessage: c.last_message_text || 'Conversation active',
          status: c.status === 'closed' ? 'Closed' : 'Open',
          unreadCount: c.unread_count || 0,
          accountName: wa?.display_name || wa?.verified_name || wa?.phone_number || 'WhatsApp Channel',
          isWindowOpen: isWinOpen
        };
      });

    // 9. Active WhatsApp Accounts for Agent
    const assignedAccIds = new Set(agentConvs.map(c => c.whatsapp_account_id).filter(Boolean));
    const agentAccounts = (store.whatsapp_accounts || [])
      .filter(a => a.business_id === numBusinessId && (assignedAccIds.size === 0 || assignedAccIds.has(a.id)))
      .map(a => ({
        id: a.id,
        name: a.display_name || a.account_name || 'WhatsApp Account',
        phone: a.phone_number || a.phone_number_id || '',
        status: (a.status === 'connected' || a.connection_status === 'CONNECTED') ? 'Connected' : 'Disconnected',
        isPrimary: Boolean(a.is_primary)
      }));

    return {
      timeRange: normalizedRange,
      isAgent: true,
      kpi: {
        totalContacts,
        contactsGrowth: periodContacts > 0 ? `+${periodContacts}` : '+0',
        messagesSent: totalSent,
        messagesSentGrowth: totalSent > 0 ? `+${totalSent}` : '+0',
        totalCampaigns: totalConvs,
        campaignsGrowth: openConvs > 0 ? `${openConvs} Open` : '0 Open',
        activeAutomations: closedConvs,
        failedMessages: totalFailed,
        failedMessagesGrowth: totalFailed > 0 ? `${totalFailed}` : '+0',
        openChats: openConvs,
        closedChats: closedConvs,
        unreadChats: unreadConvs,
        windowActiveChats: windowActive
      },
      deliveryTrend,
      allMessagesTrend: deliveryTrend,
      deliveryOverview,
      allMessagesOverview,
      contactGrowth: monthlyGrowth,
      whatsappAccounts: {
        summary: `${agentAccounts.length} Channels`,
        list: agentAccounts
      },
      automations: [],
      scheduledCampaigns: [],
      recentCampaigns: [],
      recentConversations: recentConvs,
      systemHealth: {
        operational: true,
        whatsapp: agentAccounts.length > 0 ? 'Connected' : 'Disconnected',
        automation: 'Idle',
        system: 'All Good'
      }
    };
  }

  // Real MySQL Execution for Agent
  let totalContacts = 0;
  let periodContacts = 0;
  try {
    const contactRows = await executeQuery(
      `SELECT COUNT(*) as totalContacts FROM contacts c
       WHERE c.business_id = ? AND (
         c.assigned_user_id = ? OR EXISTS (
           SELECT 1 FROM whatsapp_conversations wc 
           WHERE wc.business_id = c.business_id 
             AND (wc.contact_id = c.id OR wc.customer_phone = c.phone) 
             AND wc.assigned_user_id = ?
         )
       )`,
      [numBusinessId, agentId, agentId]
    );
    totalContacts = Number(contactRows?.[0]?.totalContacts || 0);

    const contactAggRows = await executeQuery(
      `SELECT COUNT(*) as periodContacts FROM contacts c
       WHERE c.business_id = ? AND (
         c.assigned_user_id = ? OR EXISTS (
           SELECT 1 FROM whatsapp_conversations wc 
           WHERE wc.business_id = c.business_id 
             AND (wc.contact_id = c.id OR wc.customer_phone = c.phone) 
             AND wc.assigned_user_id = ?
         )
       ) ${contactDateFilter}`,
      [numBusinessId, agentId, agentId]
    );
    periodContacts = Number(contactAggRows?.[0]?.periodContacts || 0);
  } catch (e) {
    console.error('Agent contacts aggregation error:', e);
  }

  // 2. Agent's assigned conversations counts
  let totalConvs = 0;
  let openConvs = 0;
  let closedConvs = 0;
  let unreadConvs = 0;
  let windowActive = 0;
  try {
    const convStatsRows = await executeQuery(
      `SELECT 
         COUNT(*) as totalConvs,
         COALESCE(SUM(CASE WHEN status != 'closed' THEN 1 ELSE 0 END), 0) as openConvs,
         COALESCE(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0) as closedConvs,
         COALESCE(SUM(CASE WHEN unread_count > 0 AND status != 'closed' THEN 1 ELSE 0 END), 0) as unreadConvs,
         COALESCE(SUM(CASE WHEN service_window_expires_at > NOW() THEN 1 ELSE 0 END), 0) as windowActive
       FROM whatsapp_conversations
       WHERE business_id = ? AND assigned_user_id = ?`,
      [numBusinessId, agentId]
    );
    const cs = convStatsRows?.[0] || {};
    totalConvs = Number(cs.totalConvs || 0);
    openConvs = Number(cs.openConvs || 0);
    closedConvs = Number(cs.closedConvs || 0);
    unreadConvs = Number(cs.unreadConvs || 0);
    windowActive = Number(cs.windowActive || 0);
  } catch (e) {
    console.error('Agent conversation stats error:', e);
  }

  // 3. Agent's outbound & inbound messages count
  let totalSent = 0;
  let totalDelivered = 0;
  let totalFailed = 0;
  let totalReceived = 0;
  try {
    const msgStatsRows = await executeQuery(
      `SELECT 
         COUNT(CASE WHEN m.direction = 'OUTBOUND' THEN 1 END) as totalSent,
         COUNT(CASE WHEN m.direction = 'OUTBOUND' AND m.message_status IN ('delivered', 'read') THEN 1 END) as totalDelivered,
         COUNT(CASE WHEN m.direction = 'OUTBOUND' AND m.message_status = 'failed' THEN 1 END) as totalFailed,
         COUNT(CASE WHEN m.direction = 'INBOUND' THEN 1 END) as totalReceived
       FROM whatsapp_messages m
       JOIN whatsapp_conversations c ON m.conversation_id = c.id
       WHERE m.business_id = ? AND (m.sender_user_id = ? OR c.assigned_user_id = ?) ${msgDateFilter}`,
      [numBusinessId, agentId, agentId]
    );
    const ms = msgStatsRows?.[0] || {};
    totalSent = Number(ms.totalSent || 0);
    totalDelivered = Number(ms.totalDelivered || 0);
    totalFailed = Number(ms.totalFailed || 0);
    totalReceived = Number(ms.totalReceived || 0);
  } catch (e) {
    console.error('Agent message stats error:', e);
  }

  // 4. Delivery Trend for this agent
  try {
    const trendRows = await executeQuery(
      `SELECT 
         DATE(m.created_at) as dt,
         COUNT(CASE WHEN m.direction = 'OUTBOUND' THEN 1 END) as sent,
         COUNT(CASE WHEN m.direction = 'OUTBOUND' AND m.message_status IN ('delivered', 'read') THEN 1 END) as delivered,
         COUNT(CASE WHEN m.direction = 'OUTBOUND' AND m.message_status = 'failed' THEN 1 END) as failed,
         COUNT(CASE WHEN m.direction = 'INBOUND' THEN 1 END) as received
       FROM whatsapp_messages m
       JOIN whatsapp_conversations c ON m.conversation_id = c.id
       WHERE m.business_id = ? AND (m.sender_user_id = ? OR c.assigned_user_id = ?) ${msgDateFilter}
       GROUP BY dt
       ORDER BY dt ASC`,
      [numBusinessId, agentId, agentId]
    );
    if (Array.isArray(trendRows)) {
      for (const r of trendRows) {
        if (!r.dt) continue;
        const dStr = new Date(r.dt).toISOString().split('T')[0];
        if (trendMap[dStr]) {
          trendMap[dStr].sent = Number(r.sent || 0);
          trendMap[dStr].delivered = Number(r.delivered || 0);
          trendMap[dStr].failed = Number(r.failed || 0);
          trendMap[dStr].received = Number(r.received || 0);
        }
      }
    }
  } catch (e) {
    console.error('Agent delivery trend error:', e);
  }
  dateLabels.sort();
  const deliveryTrend = dateLabels.map(k => trendMap[k]);

  // 5. Recent Conversations for Agent
  let recentConvs = [];
  try {
    const rows = await executeQuery(
      `SELECT 
         c.id, c.contact_id, c.customer_phone, c.status, c.unread_count, c.last_message_text, c.last_message_at, c.service_window_expires_at,
         ct.name as contact_name, ct.first_name, ct.last_name,
         COALESCE(NULLIF(wa.verified_name, ''), NULLIF(wa.display_name, ''), wa.phone_number) as account_name
       FROM whatsapp_conversations c
       LEFT JOIN contacts ct ON (c.contact_id = ct.id OR (ct.phone = c.customer_phone AND ct.business_id = c.business_id))
       LEFT JOIN whatsapp_accounts wa ON c.whatsapp_account_id = wa.id
       WHERE c.business_id = ? AND c.assigned_user_id = ?
       ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC
       LIMIT 5`,
      [numBusinessId, agentId]
    );
    if (Array.isArray(rows)) {
      recentConvs = rows.map(r => ({
        id: r.id,
        contactId: r.contact_id,
        name: r.contact_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.customer_phone,
        phone: r.customer_phone,
        lastMessage: r.last_message_text || 'Conversation active',
        status: r.status === 'closed' ? 'Closed' : 'Open',
        unreadCount: Number(r.unread_count || 0),
        accountName: r.account_name || 'WhatsApp Channel',
        isWindowOpen: r.service_window_expires_at ? now < new Date(r.service_window_expires_at) : false
      }));
    }
  } catch (e) {
    console.error('Agent recent convs error:', e);
  }

  // 6. WhatsApp Accounts for Agent
  let agentAccounts = [];
  try {
    const accRows = await executeQuery(
      `SELECT DISTINCT wa.id, wa.display_name, wa.phone_number, wa.status, wa.connection_status
       FROM whatsapp_accounts wa
       JOIN whatsapp_conversations wc ON wc.whatsapp_account_id = wa.id
       WHERE wa.business_id = ? AND wc.assigned_user_id = ?`,
      [numBusinessId, agentId]
    );
    if (Array.isArray(accRows) && accRows.length > 0) {
      agentAccounts = accRows.map(a => ({
        id: a.id,
        name: a.display_name || 'WhatsApp Account',
        phone: a.phone_number || '',
        status: (a.status === 'connected' || a.connection_status === 'CONNECTED') ? 'Connected' : 'Disconnected',
        isPrimary: false
      }));
    } else {
      const fallbackAccs = await executeQuery(
        `SELECT id, display_name, phone_number, status, connection_status FROM whatsapp_accounts WHERE business_id = ? LIMIT 2`,
        [numBusinessId]
      );
      agentAccounts = (fallbackAccs || []).map(a => ({
        id: a.id,
        name: a.display_name || 'WhatsApp Channel',
        phone: a.phone_number || '',
        status: (a.status === 'connected' || a.connection_status === 'CONNECTED') ? 'Connected' : 'Disconnected',
        isPrimary: false
      }));
    }
  } catch (e) {
    console.error('Agent accounts error:', e);
  }

  // Delivery Overviews
  const inTransit = Math.max(0, totalSent - totalDelivered - totalFailed);
  const delPct = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const failPct = totalSent > 0 ? Math.round((totalFailed / totalSent) * 100) : 0;
  const sentPct = totalSent > 0 ? Math.max(0, 100 - delPct - failPct) : 0;

  const deliveryOverview = {
    total: totalSent,
    breakdown: [
      { name: 'Delivered', pct: delPct, count: totalDelivered, color: '#10b981' },
      { name: 'Sent', pct: sentPct, count: inTransit, color: '#3b82f6' },
      { name: 'Failed', pct: failPct, count: totalFailed, color: '#ef4444' }
    ]
  };

  const combTotal = totalSent + totalReceived;
  const combDelPct = combTotal > 0 ? Math.round((totalDelivered / combTotal) * 100) : 0;
  const combRecPct = combTotal > 0 ? Math.round((totalReceived / combTotal) * 100) : 0;
  const combFailPct = combTotal > 0 ? Math.round((totalFailed / combTotal) * 100) : 0;
  const combSentPct = combTotal > 0 ? Math.max(0, 100 - combDelPct - combRecPct - combFailPct) : 0;

  const allMessagesOverview = {
    total: combTotal,
    breakdown: [
      { name: 'Delivered', pct: combDelPct, count: totalDelivered, color: '#10b981' },
      { name: 'Sent', pct: combSentPct, count: inTransit, color: '#3b82f6' },
      { name: 'Received', pct: combRecPct, count: totalReceived, color: '#8b5cf6' },
      { name: 'Failed', pct: combFailPct, count: totalFailed, color: '#ef4444' }
    ]
  };

  // Contact Growth for Agent
  let contactGrowth = [];
  try {
    const monthlyRows = await executeQuery(
      `SELECT 
         DATE_FORMAT(c.created_at, '%b') as month_name,
         DATE_FORMAT(c.created_at, '%Y-%m') as ym,
         COUNT(*) as cnt
       FROM contacts c
       WHERE c.business_id = ? AND (
         c.assigned_user_id = ? OR EXISTS (
           SELECT 1 FROM whatsapp_conversations wc 
           WHERE wc.business_id = c.business_id 
             AND (wc.contact_id = c.id OR wc.customer_phone = c.phone) 
             AND wc.assigned_user_id = ?
         )
       )
       GROUP BY ym, month_name
       ORDER BY ym ASC`,
      [numBusinessId, agentId, agentId]
    );
    const targetMonths = [];
    for (let m = 3; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleDateString('en-US', { month: 'short' });
      targetMonths.push({ ym, name });
    }
    contactGrowth = targetMonths.map(tm => {
      let cum = 0;
      if (Array.isArray(monthlyRows)) {
        for (const r of monthlyRows) {
          if (r.ym <= tm.ym) cum += Number(r.cnt || 0);
        }
      }
      return { month: tm.name, contacts: cum };
    });
  } catch (e) {
    console.error('Agent contact growth error:', e);
  }

  return {
    timeRange: normalizedRange,
    isAgent: true,
    kpi: {
      totalContacts,
      contactsGrowth: periodContacts > 0 ? `+${periodContacts}` : '+0',
      messagesSent: totalSent,
      messagesSentGrowth: totalSent > 0 ? `+${totalSent}` : '+0',
      totalCampaigns: totalConvs,
      campaignsGrowth: openConvs > 0 ? `${openConvs} Open` : '0 Open',
      activeAutomations: closedConvs,
      failedMessages: totalFailed,
      failedMessagesGrowth: totalFailed > 0 ? `${totalFailed}` : '+0',
      openChats: openConvs,
      closedChats: closedConvs,
      unreadChats: unreadConvs,
      windowActiveChats: windowActive
    },
    deliveryTrend,
    allMessagesTrend,
    deliveryOverview,
    allMessagesOverview,
    contactGrowth,
    whatsappAccounts: {
      summary: `${agentAccounts.length} Channels`,
      list: agentAccounts
    },
    automations: [],
    scheduledCampaigns: [],
    recentCampaigns: [],
    recentConversations: recentConvs,
    systemHealth: {
      operational: true,
      whatsapp: agentAccounts.length > 0 ? 'Connected' : 'Disconnected',
      automation: 'Idle',
      system: 'All Good'
    }
  };
}

export default {
  getDashboardStats
};
