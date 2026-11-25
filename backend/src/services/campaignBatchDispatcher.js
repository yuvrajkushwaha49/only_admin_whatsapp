import logger from '../utils/logger.js';
import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../database/db.js';
import { MetaCloudApiClient } from '../modules/whatsapp/metaClient.js';
import { decryptToken } from '../utils/crypto.js';
import { emitToTenant } from '../socket.js';
import { createNotification } from '../modules/notifications/notifications.service.js';
import { createAuditLog } from '../modules/logs/logs.service.js';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_PACING_MS = 25; // ~40 messages/second per worker, safe for Meta and 0% CPU load
const MAX_SEND_RETRIES = 2;

/**
 * Sleep helper for rate pacing
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a campaign in streamed, rate-paced batches
 */
export async function processCampaignBatch(campaign) {
  const campaignId = Number(campaign.id);
  const businessId = Number(campaign.business_id);
  const batchSize = parseInt(process.env.CAMPAIGN_BATCH_SIZE || `${DEFAULT_BATCH_SIZE}`, 10);
  const pacingMs = parseInt(process.env.CAMPAIGN_PACING_MS || `${DEFAULT_PACING_MS}`, 10);

  logger.info(`⚡ [CampaignBatchDispatcher] Starting chunked dispatch for Campaign #${campaignId} "${campaign.name}" (Batch Size: ${batchSize}, Pacing: ${pacingMs}ms)`);

  // 1. Fetch Template & Accounts
  let template;
  let senderAccounts = [];

  if (isUsingFallback()) {
    const store = getMemoryStore();
    template = store.templates?.find(t => t.id === campaign.template_id);
    if (!template) {
      template = store.templates?.find(t => t.name === 'welcome_msg') || store.templates?.[0];
    }

    const rawMappings = typeof campaign.variable_mappings === 'string'
      ? JSON.parse(campaign.variable_mappings || '{}')
      : (campaign.variable_mappings || {});
    const senderIds = rawMappings.sender_account_ids || (campaign.whatsapp_account_id ? [campaign.whatsapp_account_id] : []);
    senderAccounts = (store.whatsapp_accounts || []).filter(a => senderIds.includes(a.id));
    if (senderAccounts.length === 0 && campaign.whatsapp_account_id) {
      const single = store.whatsapp_accounts?.find(a => a.id === campaign.whatsapp_account_id);
      if (single) senderAccounts = [single];
    }
  } else {
    const tRows = await executeQuery('SELECT * FROM templates WHERE id = ? LIMIT 1', [campaign.template_id]);
    template = tRows[0];
    if (!template) {
      const fallbackRows = await executeQuery('SELECT * FROM templates WHERE name = "welcome_msg" LIMIT 1');
      template = fallbackRows?.[0] || null;
    }

    const rawMappings = typeof campaign.variable_mappings === 'string'
      ? JSON.parse(campaign.variable_mappings || '{}')
      : (campaign.variable_mappings || {});
    const senderIds = rawMappings.sender_account_ids || (campaign.whatsapp_account_id ? [campaign.whatsapp_account_id] : []);

    if (Array.isArray(senderIds) && senderIds.length > 0) {
      const sPlaceholders = senderIds.map(() => '?').join(',');
      senderAccounts = await executeQuery(
        `SELECT * FROM whatsapp_accounts WHERE id IN (${sPlaceholders}) AND business_id = ?`,
        [...senderIds.map(Number), businessId]
      );
    }
    if (senderAccounts.length === 0 && campaign.whatsapp_account_id) {
      const single = await executeQuery('SELECT * FROM whatsapp_accounts WHERE id = ? LIMIT 1', [campaign.whatsapp_account_id]);
      if (single?.[0]) senderAccounts = [single[0]];
    }
  }

  // Safety: Template Approval Check
  if (template?.status !== 'APPROVED') {
    const errorMsg = `Template "${template?.name || 'unknown'}" is ${template?.status || 'NOT APPROVED'}. Only Meta-APPROVED templates can be sent.`;
    logger.warn(`[CampaignBatchDispatcher] Campaign #${campaignId} aborted: ${errorMsg}`);
    await abortCampaign(campaignId, businessId, errorMsg);
    return { status: 'failed', reason: errorMsg };
  }

  // Fallback sender filter for live Indian numbers vs sandbox
  const realSenders = senderAccounts.filter(a => !a.phone_number?.includes('555-199') && !a.phone_number?.startsWith('+1 555') && String(a.phone_number_id) !== '1353284594528559');
  if (realSenders.length > 0) {
    senderAccounts = realSenders;
  }

  // Extract body component and text for placeholder substitution
  const templateComps = Array.isArray(template?.components)
    ? template.components
    : (typeof template?.components === 'string' ? JSON.parse(template?.components || '[]') : []);
  const bodyComponent = templateComps.find(c => c.type === 'BODY' || c.type === 'body');
  const templateBodyText = bodyComponent?.text || '';

  const placeholderMatches = templateBodyText.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const uniquePlaceholders = Array.from(new Set(placeholderMatches.map(p => p.replace(/[{}]/g, ''))));

  const rawMappings = typeof campaign.variable_mappings === 'string'
    ? JSON.parse(campaign.variable_mappings || '{}')
    : (campaign.variable_mappings || {});

  let cursor = Number(campaign.batch_cursor || 0);
  let totalSentInRun = 0;
  let totalFailedInRun = 0;
  let batchIndex = 0;

  // 2. Main Chunk Streaming Loop
  while (true) {
    batchIndex++;

    // Check if campaign was paused or cancelled by user in database
    const currentStatus = await checkCampaignStatus(campaignId, businessId);
    if (['paused', 'cancelled', 'failed'].includes(currentStatus)) {
      logger.info(`🛑 [CampaignBatchDispatcher] Campaign #${campaignId} received status "${currentStatus}". Halting dispatch cleanly.`);
      return { status: currentStatus, stopped: true };
    }

    // Fetch next slice of pending recipients
    let recipients = await fetchPendingRecipientsChunk(campaignId, businessId, cursor, batchSize);

    // If no recipients with id > cursor, check if any pending recipients exist at all (for retries or re-queued rows)
    if (recipients.length === 0 && cursor > 0) {
      recipients = await fetchPendingRecipientsChunk(campaignId, businessId, 0, batchSize);
      if (recipients.length === 0) {
        // No more pending recipients in the entire campaign
        break;
      }
    } else if (recipients.length === 0) {
      // Completed all recipients
      break;
    }

    logger.info(`📦 [CampaignBatchDispatcher] Processing Batch #${batchIndex} (${recipients.length} recipients, Cursor: ${cursor}) for Campaign #${campaignId}`);

    const batchUpdates = [];
    const outboundMessages = [];

    for (let i = 0; i < recipients.length; i++) {
      const rec = recipients[i];
      cursor = Math.max(cursor, Number(rec.id));

      // Controlled rate pacing
      if (pacingMs > 0) {
        await sleep(pacingMs);
      }

      // Check opt-in & status
      const isEligible = Boolean(rec.is_opted_in !== 0 && rec.is_opted_in !== false) &&
                         rec.contact_status !== 'inactive' &&
                         rec.contact_status !== 'unsubscribed' &&
                         rec.contact_status !== 'blocked';

      if (!isEligible) {
        batchUpdates.push({
          id: rec.id,
          status: 'skipped',
          skipReason: 'Opted out or consent withdrawn prior to send',
          providerMessageId: null,
          errorMessage: null
        });
        continue;
      }

      // Select active sender account with round-robin rotation
      const activeAccount = senderAccounts.length > 0 ? senderAccounts[i % senderAccounts.length] : null;
      const liveFallbackToken = 'EAAQjnGtRDZCgBS1tjbT3HB636ZArmfxy00RUrQLYzujvPZBN1sU0yDZClKaiBAQAhxiiECwnCp1k2YDlL9s6Ff3ZAZBGA4DvySmfnWutocges1MV3eIjW9bciSoNHfojmwcRcVizsWZCwMzDolQBQJfK9yXp6VsOFuabsnVn92TnosYP6AZBXGoRJob5J9STih1qfgZDZD';

      let tokenToUse = activeAccount?.access_token_encrypted
        ? (decryptToken(activeAccount.access_token_encrypted) || activeAccount.access_token_encrypted)
        : null;

      if (process.env.NODE_ENV === 'test') {
        tokenToUse = 'mock_token_test';
      } else if (!tokenToUse || tokenToUse.includes('mock_') || tokenToUse === 'null') {
        tokenToUse = process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || liveFallbackToken;
      }

      const phoneIdToUse = activeAccount?.phone_number_id || '1341070215765610';
      const wabaIdToUse = activeAccount?.waba_id || '1618945099958602';

      if (!tokenToUse || !phoneIdToUse) {
        totalFailedInRun++;
        batchUpdates.push({
          id: rec.id,
          status: 'failed',
          skipReason: null,
          providerMessageId: null,
          errorMessage: 'Missing WhatsApp Cloud API credentials'
        });
        continue;
      }

      const client = new MetaCloudApiClient(tokenToUse, phoneIdToUse, wabaIdToUse);

      let templateName = template?.name || 'welcome_msg';
      let languageCode = template?.language || (templateName === 'welcome_msg' ? 'en' : 'en_US');

      const isIndianSender = activeAccount?.phone_number?.includes('+91');
      if (templateName === 'hello_world' && isIndianSender) {
        templateName = 'welcome_msg';
        languageCode = 'en';
      }

      // Build components parameters
      const components = [];
      if (uniquePlaceholders.length > 0) {
        const bodyParams = [];
        uniquePlaceholders.forEach((ph, pIdx) => {
          let val = rawMappings[ph] || rawMappings[`var_${pIdx + 1}`];
          if (!val || val === 'contact.name') {
            val = rec.contact_name || 'Customer';
          } else if (val === 'contact.phone') {
            val = rec.phone;
          }
          const paramObj = { type: 'text', text: String(val || '') };
          if (template?.parameter_format === 'NAMED' || isNaN(Number(ph)) || ph === 'customer_name') {
            paramObj.parameter_name = ph;
          }
          bodyParams.push(paramObj);
        });
        if (bodyParams.length > 0) {
          components.push({ type: 'body', parameters: bodyParams });
        }
      } else if (templateName === 'welcome_msg') {
        components.push({
          type: 'body',
          parameters: [{ type: 'text', parameter_name: 'customer_name', text: String(rec.contact_name || 'Customer') }]
        });
      }

      // Automatically satisfy media header (IMAGE, VIDEO, DOCUMENT) parameters required by Meta
      const headerComp = templateComps.find(c => (c.type || '').toUpperCase() === 'HEADER');
      if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes((headerComp.format || '').toUpperCase())) {
        const hFormat = headerComp.format.toLowerCase();
        let mediaUrl = headerComp.example?.header_handle?.[0] || template?.header_media_url || null;

        if (templateName === '4_yuvi_vid_test' || (mediaUrl && (mediaUrl.includes('10000000_1429385345595388') || mediaUrl.includes('ForBiggerBlazes')))) {
          mediaUrl = 'https://aiveexa.com/api/uploads/templates/arlak_pharma_15mb.mp4';
        }
        if (mediaUrl && mediaUrl.includes('aiveexa.com/uploads/')) {
          mediaUrl = mediaUrl.replace('aiveexa.com/uploads/', 'aiveexa.com/api/uploads/');
        }
        if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl) || mediaUrl.includes('ForBiggerBlazes')) {
          if (hFormat === 'video') mediaUrl = 'https://aiveexa.com/api/uploads/templates/arlak_pharma_15mb.mp4';
          else if (hFormat === 'image') mediaUrl = 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?w=800';
          else if (hFormat === 'document') mediaUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
        }
        if (mediaUrl) {
          components.unshift({
            type: 'header',
            parameters: [
              {
                type: hFormat,
                [hFormat]: { link: mediaUrl }
              }
            ]
          });
        }
      }

      // Dispatch with retries
      let sendSuccess = false;
      let providerMsgId = null;
      let lastErrMsg = null;

      for (let attempt = 0; attempt <= MAX_SEND_RETRIES; attempt++) {
        try {
          const resp = await client.sendTemplateMessage({
            recipientPhone: rec.phone,
            templateName,
            languageCode,
            components
          });
          providerMsgId = resp?.messages?.[0]?.id || `wamid.msg_${Date.now()}_${rec.id}`;
          sendSuccess = true;
          break;
        } catch (err) {
          lastErrMsg = err.message || 'Meta API error';
          if (attempt < MAX_SEND_RETRIES) {
            await sleep(500 * (attempt + 1));
          }
        }
      }

      if (sendSuccess) {
        totalSentInRun++;
        batchUpdates.push({
          id: rec.id,
          status: 'sent',
          skipReason: null,
          providerMessageId: providerMsgId,
          errorMessage: null
        });

        outboundMessages.push({
          business_id: businessId,
          campaign_id: campaignId,
          contact_id: rec.contact_id,
          whatsapp_account_id: activeAccount?.id || null,
          direction: 'outbound',
          provider_message_id: providerMsgId,
          phone: rec.phone,
          status: 'sent'
        });
      } else {
        totalFailedInRun++;
        batchUpdates.push({
          id: rec.id,
          status: 'failed',
          skipReason: null,
          providerMessageId: null,
          errorMessage: lastErrMsg
        });
      }
    }

    // 3. Commit Batch to Database
    await commitBatchResults(campaignId, businessId, batchUpdates, outboundMessages, cursor);

    // 4. Emit live progress to frontend via WebSocket
    const currentCounts = await getCampaignProgressCounts(campaignId, businessId);
    const sentTotal = Number(currentCounts.sent_count || 0);
    const failedTotal = Number(currentCounts.failed_count || 0);
    const totalRec = Number(campaign.total_recipients || 1);
    const processed = sentTotal + failedTotal;
    const remaining = Math.max(0, totalRec - processed);
    const percent = Math.min(100, Math.round((processed / totalRec) * 100));

    emitToTenant(businessId, 'campaign:progress', {
      campaignId,
      campaignName: campaign.name,
      sentCount: sentTotal,
      failedCount: failedTotal,
      totalRecipients: totalRec,
      remainingCount: remaining,
      percent,
      status: 'running'
    });
  }

  // 5. Finalize Campaign
  await finalizeCampaign(campaignId, businessId, campaign.name);
  return { status: 'completed', sent: totalSentInRun, failed: totalFailedInRun };
}

/**
 * Fetch a slice of pending recipients
 */
async function fetchPendingRecipientsChunk(campaignId, businessId, cursor, limit) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return (store.campaign_recipients || [])
      .filter(r => r.campaign_id === Number(campaignId) && r.status === 'pending' && Number(r.id) > Number(cursor))
      .slice(0, limit)
      .map(r => {
        const contact = store.contacts?.find(c => Number(c.id) === Number(r.contact_id));
        return {
          ...r,
          is_opted_in: contact ? contact.is_opted_in : 1,
          contact_status: contact ? contact.status : 'active',
          contact_name: contact?.name || 'Customer'
        };
      });
  }

  return executeQuery(
    `SELECT cr.id, cr.campaign_id, cr.contact_id, cr.phone, cr.status,
            c.is_opted_in, c.status as contact_status,
            COALESCE(NULLIF(c.name, ''), CONCAT_WS(' ', c.first_name, c.last_name), 'Customer') as contact_name
     FROM campaign_recipients cr
     LEFT JOIN contacts c ON cr.contact_id = c.id
     WHERE cr.campaign_id = ? AND cr.status = 'pending' AND cr.id > ?
     ORDER BY cr.id ASC
     LIMIT ?`,
    [campaignId, cursor, limit]
  );
}

/**
 * Check current campaign status in DB
 */
async function checkCampaignStatus(campaignId, businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const c = store.campaigns?.find(camp => camp.id === Number(campaignId));
    return c?.status || 'completed';
  }
  const rows = await executeQuery('SELECT status FROM campaigns WHERE id = ? LIMIT 1', [campaignId]);
  return rows[0]?.status || 'completed';
}

/**
 * Commit batch results atomically
 */
async function commitBatchResults(campaignId, businessId, batchUpdates, outboundMessages, cursor) {
  let sentDelta = 0;
  let failedDelta = 0;

  batchUpdates.forEach(u => {
    if (u.status === 'sent') sentDelta++;
    if (u.status === 'failed') failedDelta++;
  });

  if (isUsingFallback()) {
    const store = getMemoryStore();
    batchUpdates.forEach(u => {
      const orig = store.campaign_recipients?.find(cr => cr.id === u.id);
      if (orig) {
        orig.status = u.status;
        orig.skip_reason = u.skipReason;
        orig.error_message = u.errorMessage;
        orig.provider_message_id = u.providerMessageId;
        if (u.status === 'sent') orig.sent_at = new Date();
      }
    });

    outboundMessages.forEach(m => {
      store.messages.push({
        id: store.messages.length + 1,
        ...m,
        created_at: new Date()
      });
    });

    const camp = store.campaigns?.find(c => c.id === Number(campaignId));
    if (camp) {
      camp.sent_count = (camp.sent_count || 0) + sentDelta;
      camp.failed_count = (camp.failed_count || 0) + failedDelta;
      camp.batch_cursor = cursor;
    }
    saveMemoryStore();
    return;
  }

  // MySQL Execution
  // 1. Update recipient statuses
  for (const u of batchUpdates) {
    if (u.status === 'sent') {
      await executeQuery(
        'UPDATE campaign_recipients SET status = "sent", sent_at = NOW(), provider_message_id = ? WHERE id = ?',
        [u.providerMessageId, u.id]
      );
    } else if (u.status === 'skipped') {
      await executeQuery(
        'UPDATE campaign_recipients SET status = "skipped", skip_reason = ? WHERE id = ?',
        [u.skipReason, u.id]
      );
    } else if (u.status === 'failed') {
      await executeQuery(
        'UPDATE campaign_recipients SET status = "failed", error_message = ? WHERE id = ?',
        [u.errorMessage, u.id]
      );
    }
  }

  // 2. Bulk insert outbound messages
  if (outboundMessages.length > 0) {
    const placeholders = outboundMessages.map(() => '(?, ?, ?, ?, "outbound", ?, ?, "sent")').join(', ');
    const values = [];
    outboundMessages.forEach(m => {
      values.push(m.business_id, m.campaign_id, m.contact_id, m.whatsapp_account_id, m.provider_message_id, m.phone);
    });
    await executeQuery(
      `INSERT INTO messages (business_id, campaign_id, contact_id, whatsapp_account_id, direction, provider_message_id, phone, status)
       VALUES ${placeholders}`,
      values
    );
  }

  // 3. Update campaign counts and cursor
  await executeQuery(
    `UPDATE campaigns 
     SET sent_count = sent_count + ?, 
         failed_count = failed_count + ?, 
         batch_cursor = ?, 
         locked_at = NOW(),
         updated_at = NOW() 
     WHERE id = ?`,
    [sentDelta, failedDelta, cursor, campaignId]
  );
}

/**
 * Get current counts
 */
async function getCampaignProgressCounts(campaignId, businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const camp = store.campaigns?.find(c => c.id === Number(campaignId));
    return {
      sent_count: camp?.sent_count || 0,
      failed_count: camp?.failed_count || 0
    };
  }

  const rows = await executeQuery('SELECT sent_count, failed_count FROM campaigns WHERE id = ? LIMIT 1', [campaignId]);
  return rows[0] || { sent_count: 0, failed_count: 0 };
}

/**
 * Finalize completed campaign
 */
async function finalizeCampaign(campaignId, businessId, campaignName) {
  logger.info(`🏁 [CampaignBatchDispatcher] Finalizing completed Campaign #${campaignId}`);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const camp = store.campaigns?.find(c => c.id === Number(campaignId));
    if (camp && camp.status !== 'paused' && camp.status !== 'cancelled') {
      camp.status = 'completed';
      camp.completed_at = new Date();
      camp.locked_at = null;
      camp.worker_id = null;
    }
    saveMemoryStore();
  } else {
    await executeQuery(
      `UPDATE campaigns 
       SET status = 'completed', completed_at = NOW(), locked_at = NULL, worker_id = NULL 
       WHERE id = ? AND status NOT IN ('paused', 'cancelled')`,
      [campaignId]
    );

    // Record usage ledger
    const counts = await executeQuery('SELECT sent_count FROM campaigns WHERE id = ? LIMIT 1', [campaignId]);
    const sent = counts[0]?.sent_count || 0;
    if (sent > 0) {
      await executeQuery(
        `INSERT INTO usage_ledger (business_id, metric_type, quantity, period_month)
         VALUES (?, 'messages_sent', ?, DATE_FORMAT(NOW(), '%Y-%m'))`,
        [businessId, sent]
      );
    }
  }

  createAuditLog({
    businessId,
    userId: null,
    action: 'CAMPAIGN_COMPLETE',
    entityType: 'CAMPAIGNS',
    entityId: campaignId,
    details: { message: `Campaign "${campaignName || campaignId}" finished broadcasting to all recipients.` },
    ipAddress: '127.0.0.1'
  }).catch(() => {});

  createNotification({
    businessId,
    title: 'Campaign Completed',
    message: `Campaign "${campaignName || campaignId}" has finished sending all messages.`,
    type: 'success',
    link: `/campaigns/${campaignId}`
  }).catch(() => {});

  emitToTenant(businessId, 'campaign:status_update', {
    campaignId,
    campaignName,
    status: 'completed',
    percent: 100
  });
}

/**
 * Abort campaign if critical error
 */
async function abortCampaign(campaignId, businessId, reason) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const camp = store.campaigns?.find(c => c.id === Number(campaignId));
    if (camp) {
      camp.status = 'failed';
      camp.completed_at = new Date();
    }
    (store.campaign_recipients || [])
      .filter(r => r.campaign_id === Number(campaignId) && r.status === 'pending')
      .forEach(r => {
        r.status = 'failed';
        r.error_message = reason;
      });
    saveMemoryStore();
  } else {
    await executeQuery('UPDATE campaigns SET status = "failed", completed_at = NOW(), locked_at = NULL WHERE id = ?', [campaignId]);
    await executeQuery('UPDATE campaign_recipients SET status = "failed", error_message = ? WHERE campaign_id = ? AND status = "pending"', [
      reason,
      campaignId
    ]);
  }
}

export default {
  processCampaignBatch
};
