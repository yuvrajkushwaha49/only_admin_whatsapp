import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import { MetaCloudApiClient } from '../whatsapp/metaClient.js';
import { decryptToken } from '../../utils/crypto.js';
import { emitToTenant, emitToConversation } from '../../socket.js';
import logger from '../../utils/logger.js';

/**
 * Replace dynamic placeholders in automation message text:
 * {{name}}, {{phone}}, {{email}}, {{city}}
 */
export function interpolateVariables(templateText, contact = {}) {
  if (!templateText) return '';
  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'there';
  const firstName = contact.first_name || fullName || 'there';
  const phone = contact.phone || '';
  const email = contact.email || '';
  const city = contact.city || '';

  return templateText
    .replace(/\{\{\s*name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*full_name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*phone\s*\}\}/gi, phone)
    .replace(/\{\{\s*email\s*\}\}/gi, email)
    .replace(/\{\{\s*city\s*\}\}/gi, city);
}

/**
 * Retrieve decrypted token & phone ID for an account
 */
async function getAccountMetaClient(businessId, accountId) {
  let account = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    account = (store.whatsapp_accounts || []).find(a => Number(a.id) === Number(accountId) && Number(a.business_id) === Number(businessId));
  } else {
    const rows = await executeQuery(
      'SELECT id, phone_number_id, waba_id, access_token_encrypted FROM whatsapp_accounts WHERE id = ? AND business_id = ? LIMIT 1',
      [accountId, businessId]
    );
    account = rows?.[0] || null;
  }

  if (!account) {
    logger.warn(`[AutomationEngine] Could not load WhatsApp account #${accountId} for business #${businessId}`);
    return null;
  }

  let token = decryptToken(account.access_token_encrypted);
  if (!token || typeof token !== 'string') {
    token = process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
  }

  return new MetaCloudApiClient(token, account.phone_number_id, account.waba_id);
}

/**
 * Primary Inbound Webhook Processor for Automation Engine
 */
export async function handleInboundEvent({ businessId, accountId, contact, conversation, message, rawMsg = {} }) {
  const numBusinessId = Number(businessId);
  const numAccountId = Number(accountId);
  const customerPhone = contact.phone || conversation.customer_phone;
  const inboundText = String(message.message_body || '').trim();
  const inboundType = message.message_type || 'text';

  // Extract button reply identifiers if interactive
  const buttonReplyId = rawMsg.interactive?.button_reply?.id || rawMsg.button?.payload || null;
  const buttonReplyTitle = rawMsg.interactive?.button_reply?.title || rawMsg.button?.text || null;

  logger.info(`🤖 [AutomationEngine] Inbound event from ${customerPhone} (biz: ${numBusinessId}): "${inboundText}" [btn: ${buttonReplyId || 'none'}]`);

  // 1. Check for Active Automation Session
  let activeSession = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.automation_sessions) store.automation_sessions = [];
    activeSession = store.automation_sessions.find(
      s => Number(s.business_id) === numBusinessId &&
           s.customer_phone === customerPhone &&
           s.status === 'active'
    );
  } else {
    const sessionRows = await executeQuery(
      `SELECT s.*, v.definition as version_definition
       FROM automation_sessions s
       JOIN automation_versions v ON s.version_id = v.id
       WHERE s.business_id = ? AND s.customer_phone = ? AND s.status = 'active'
       ORDER BY s.id DESC LIMIT 1`,
      [numBusinessId, customerPhone]
    );
    activeSession = sessionRows?.[0] || null;
  }

  // A. IF ACTIVE SESSION EXISTS: Process response in context
  if (activeSession) {
    return processActiveSessionResponse({
      businessId: numBusinessId,
      accountId: numAccountId,
      session: activeSession,
      contact,
      conversation,
      inboundText,
      buttonReplyId,
      buttonReplyTitle
    });
  }

  // B. IF NO ACTIVE SESSION: Match Keyword or Button Triggers
  return matchAndStartNewSession({
    businessId: numBusinessId,
    accountId: numAccountId,
    contact,
    conversation,
    inboundText,
    buttonReplyId
  });
}

/**
 * Match triggers and instantiate a new automation session
 */
async function matchAndStartNewSession({ businessId, accountId, contact, conversation, inboundText, buttonReplyId }) {
  const cleanKeyword = inboundText.toLowerCase().trim();
  let matchedTrigger = null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const triggers = store.automation_triggers || [];

    // Check button click trigger
    if (buttonReplyId) {
      matchedTrigger = triggers.find(
        t => Number(t.business_id) === businessId &&
             t.is_active &&
             t.trigger_type === 'BUTTON_CLICK' &&
             (String(t.interactive_button_id) === String(buttonReplyId) || String(t.keyword) === String(buttonReplyId))
      );
    }

    // Check keyword trigger
    if (!matchedTrigger && cleanKeyword) {
      matchedTrigger = triggers.find(
        t => Number(t.business_id) === businessId &&
             t.is_active &&
             t.trigger_type === 'KEYWORD' &&
             t.keyword === cleanKeyword &&
             (!t.whatsapp_account_id || Number(t.whatsapp_account_id) === accountId)
      );
    }
  } else {
    // MySQL Trigger Matching
    if (buttonReplyId) {
      const btnRows = await executeQuery(
        `SELECT t.*, a.current_version_id, a.name as automation_name, a.status as automation_status
         FROM automation_triggers t
         JOIN automations a ON t.automation_id = a.id
         WHERE t.business_id = ? AND t.is_active = 1 AND a.status = 'published'
           AND (t.interactive_button_id = ? OR t.keyword = ?)
         LIMIT 1`,
        [businessId, buttonReplyId, buttonReplyId]
      );
      if (btnRows && btnRows.length > 0) matchedTrigger = btnRows[0];
    }

    if (!matchedTrigger && cleanKeyword) {
      const kwRows = await executeQuery(
        `SELECT t.*, a.current_version_id, a.name as automation_name, a.status as automation_status
         FROM automation_triggers t
         JOIN automations a ON t.automation_id = a.id
         WHERE t.business_id = ? AND t.is_active = 1 AND a.status = 'published'
           AND t.trigger_type = 'KEYWORD' AND t.keyword = ?
           AND (t.whatsapp_account_id IS NULL OR t.whatsapp_account_id = ?)
         LIMIT 1`,
        [businessId, cleanKeyword, accountId]
      );
      if (kwRows && kwRows.length > 0) matchedTrigger = kwRows[0];
    }
  }

  if (!matchedTrigger) {
    // No published automation matched this keyword/button; continue normal inbox flow
    return { handledByAutomation: false };
  }

  logger.info(`✨ [AutomationEngine] Trigger matched automation #${matchedTrigger.automation_id} for ${contact.phone}`);

  // Fetch Published Definition
  let publishedVersion = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    publishedVersion = store.automation_versions?.find(v => Number(v.automation_id) === Number(matchedTrigger.automation_id));
  } else {
    const verRows = await executeQuery(
      'SELECT id, definition FROM automation_versions WHERE id = ? LIMIT 1',
      [matchedTrigger.current_version_id]
    );
    publishedVersion = verRows?.[0] || null;
  }

  if (!publishedVersion) {
    logger.warn(`[AutomationEngine] No published version found for automation #${matchedTrigger.automation_id}`);
    return { handledByAutomation: false };
  }

  let def = publishedVersion.definition;
  if (typeof def === 'string') {
    try { def = JSON.parse(def); } catch (_) { def = {}; }
  }

  const steps = def.steps || [];
  if (steps.length === 0) return { handledByAutomation: false };

  // Identify first step
  const firstStep = steps.find(s => s.isFirst) || steps[0];
  const sessionId = Date.now();

  // Create Active Session
  if (isUsingFallback()) {
    const store = getMemoryStore();
    store.automation_sessions.push({
      id: sessionId,
      business_id: businessId,
      automation_id: Number(matchedTrigger.automation_id),
      version_id: Number(publishedVersion.id),
      whatsapp_account_id: accountId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      customer_phone: contact.phone,
      current_step_id: firstStep.id,
      status: 'active',
      unexpected_reply_count: 0,
      context_data: {},
      last_message_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date()
    });
    saveMemoryStore();
  } else {
    const sessInsert = await executeQuery(
      `INSERT INTO automation_sessions 
        (business_id, automation_id, version_id, whatsapp_account_id, conversation_id, contact_id, customer_phone, current_step_id, status, context_data, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', '{}', DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW(), NOW())`,
      [businessId, matchedTrigger.automation_id, publishedVersion.id, accountId, conversation.id, contact.id, contact.phone, firstStep.id]
    );
  }

  // Increment total conversations counter on automation
  if (!isUsingFallback()) {
    await executeQuery('UPDATE automations SET total_conversations = total_conversations + 1 WHERE id = ?', [matchedTrigger.automation_id]);
  }

  // Dispatch Step 1 to customer
  await dispatchStepMessage({
    businessId,
    accountId,
    step: firstStep,
    contact,
    conversation
  });

  return { handledByAutomation: true, stepId: firstStep.id };
}

/**
 * Handle incoming message when customer already has an active automation session
 */
async function processActiveSessionResponse({ businessId, accountId, session, contact, conversation, inboundText, buttonReplyId, buttonReplyTitle }) {
  let def = session.version_definition;
  if (!def && isUsingFallback()) {
    const store = getMemoryStore();
    const ver = store.automation_versions?.find(v => Number(v.id) === Number(session.version_id));
    def = ver?.definition;
  }
  if (typeof def === 'string') {
    try { def = JSON.parse(def); } catch (_) { def = {}; }
  }

  const steps = def?.steps || [];
  const fallbackConfig = def?.fallback || {};
  const currentStep = steps.find(s => s.id === session.current_step_id);

  // 1. Check if user responded to Fallback Yes/No Buttons ("Yes, call me" / "No, thanks")
  const isFallbackYes = buttonReplyId === 'fallback_yes' || inboundText.toLowerCase().includes('yes, call me') || inboundText.toLowerCase() === 'yes';
  const isFallbackNo = buttonReplyId === 'fallback_no' || inboundText.toLowerCase().includes('no, thanks') || inboundText.toLowerCase() === 'no';

  if (isFallbackYes) {
    // Customer requested callback via fallback
    await registerCallbackRequest({
      businessId,
      automationId: session.automation_id,
      sessionId: session.id,
      accountId,
      conversationId: conversation.id,
      contactId: contact.id,
      customerName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.phone,
      customerPhone: contact.phone
    });

    const yesMsg = fallbackConfig.messageAfterYes || 'Thank you! Our team will call you shortly.';
    await sendBotTextReply(businessId, accountId, contact.phone, conversation.id, yesMsg);
    await completeSession(session.id, 'completed');
    return { handledByAutomation: true, action: 'callback_registered' };
  }

  if (isFallbackNo) {
    const noMsg = fallbackConfig.messageAfterNo || 'No problem. Let us continue.';
    await sendBotTextReply(businessId, accountId, contact.phone, conversation.id, noMsg);
    // Reset unexpected counter and stay on current step
    await resetUnexpectedCounter(session.id);
    return { handledByAutomation: true, action: 'fallback_dismissed' };
  }

  // 2. Match Expected Buttons / Actions from Current Step
  const stepButtons = currentStep?.buttons || [];
  let matchedButton = null;

  if (buttonReplyId) {
    matchedButton = stepButtons.find(b => b.id === buttonReplyId);
  }
  if (!matchedButton && (buttonReplyTitle || inboundText)) {
    const replyTxt = (buttonReplyTitle || inboundText).toLowerCase().trim();
    matchedButton = stepButtons.find(b => b.text && b.text.toLowerCase().trim() === replyTxt);
  }

  // A. If an expected option matched:
  if (matchedButton) {
    const action = matchedButton.action || 'next_step';
    logger.info(`🎯 [AutomationEngine] Button action "${action}" chosen by ${contact.phone} for step "${currentStep?.name}"`);

    if (action === 'request_callback') {
      await registerCallbackRequest({
        businessId,
        automationId: session.automation_id,
        sessionId: session.id,
        accountId,
        conversationId: conversation.id,
        contactId: contact.id,
        customerName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.phone,
        customerPhone: contact.phone
      });
      const confirmMsg = 'Thank you! Your callback request has been prioritized. Our team will contact you shortly.';
      await sendBotTextReply(businessId, accountId, contact.phone, conversation.id, confirmMsg);
      await completeSession(session.id, 'completed');
      return { handledByAutomation: true, action: 'callback' };
    }

    if (action === 'human_handover') {
      const handoverMsg = fallbackConfig.handoverMessage || 'Connecting you to a human agent now. Please wait a moment.';
      await sendBotTextReply(businessId, accountId, contact.phone, conversation.id, handoverMsg);
      await completeSession(session.id, 'handed_over', fallbackConfig.assignAgentId);
      return { handledByAutomation: true, action: 'human_handover' };
    }

    if (action === 'end_conversation') {
      const byeMsg = 'Thank you for chatting with us! Have a wonderful day.';
      await sendBotTextReply(businessId, accountId, contact.phone, conversation.id, byeMsg);
      await completeSession(session.id, 'completed');
      return { handledByAutomation: true, action: 'ended' };
    }

    // Determine Next Step
    let nextStep = null;
    if (action === 'go_to_step' && matchedButton.targetStepId) {
      nextStep = steps.find(s => s.id === matchedButton.targetStepId);
    } else {
      // Sequential next step
      const currentIdx = steps.findIndex(s => s.id === session.current_step_id);
      if (currentIdx !== -1 && currentIdx + 1 < steps.length) {
        nextStep = steps[currentIdx + 1];
      }
    }

    if (nextStep) {
      await updateSessionStep(session.id, nextStep.id);
      await dispatchStepMessage({ businessId, accountId, step: nextStep, contact, conversation });
      return { handledByAutomation: true, stepId: nextStep.id };
    } else {
      // Workflow finished
      await completeSession(session.id, 'completed');
      return { handledByAutomation: true, action: 'completed' };
    }
  }

  // B. Unexpected Reply Handling (Phase 6)
  const currentCount = (session.unexpected_reply_count || 0) + 1;
  const limit = fallbackConfig.unexpectedReplyLimit || 2;

  logger.warn(`⚠️ [AutomationEngine] Unexpected reply #${currentCount}/${limit} from ${contact.phone}`);

  if (currentCount >= limit) {
    // Reached limit: transfer to human team and stop automated bot
    const handoverMsg = fallbackConfig.handoverMessage || 'We have transferred your chat to our team. A representative will be with you shortly.';
    await sendBotTextReply(businessId, accountId, contact.phone, conversation.id, handoverMsg);
    await completeSession(session.id, 'handed_over', fallbackConfig.assignAgentId);
    return { handledByAutomation: true, action: 'handover_limit_reached' };
  } else {
    // Increment unexpected reply count
    await incrementUnexpectedCounter(session.id);

    // Send Fallback Question with Yes/No interactive buttons if enabled
    if (fallbackConfig.askCallbackOnUnexpected !== false) {
      const client = await getAccountMetaClient(businessId, accountId);
      if (client) {
        const preLine = fallbackConfig.preQuestionLine ? `${fallbackConfig.preQuestionLine}\n\n` : '';
        const questionText = `${preLine}${fallbackConfig.question || 'Call back needed?'}`;

        await client.sendInteractiveButtons({
          recipientPhone: contact.phone,
          bodyText: questionText,
          buttons: [
            { id: 'fallback_yes', text: fallbackConfig.yesButtonText || 'Yes, call me' },
            { id: 'fallback_no', text: fallbackConfig.noButtonText || 'No, thanks' }
          ]
        });

        // Record message in inbox
        await recordBotMessage(businessId, accountId, conversation.id, contact.id, questionText);
      }
    }
    return { handledByAutomation: true, action: 'fallback_asked' };
  }
}

/**
 * Dispatch a message step to customer
 */
async function dispatchStepMessage({ businessId, accountId, step, contact, conversation }) {
  const client = await getAccountMetaClient(businessId, accountId);
  if (!client) return;

  const content = interpolateVariables(step.content || '', contact);
  const buttons = (step.buttons || []).slice(0, 3);

  let metaResponse = null;

  if (buttons.length > 0) {
    // Send Interactive Quick Replies
    metaResponse = await client.sendInteractiveButtons({
      recipientPhone: contact.phone,
      bodyText: content,
      buttons: buttons.map(b => ({ id: b.id, text: b.text }))
    });
  } else {
    // Send standard text message
    metaResponse = await client.sendTextMessage({
      recipientPhone: contact.phone,
      textBody: content
    });
  }

  // Record outbound message in Inbox conversation
  await recordBotMessage(businessId, accountId, conversation.id, contact.id, content, metaResponse?.messages?.[0]?.id);
}

/**
 * Send simple bot text reply
 */
async function sendBotTextReply(businessId, accountId, recipientPhone, conversationId, textBody) {
  const client = await getAccountMetaClient(businessId, accountId);
  if (client) {
    const metaRes = await client.sendTextMessage({
      recipientPhone,
      textBody
    });
    await recordBotMessage(businessId, accountId, conversationId, null, textBody, metaRes?.messages?.[0]?.id);
  }
}

/**
 * Persist bot message to whatsapp_messages & emit Socket event
 */
async function recordBotMessage(businessId, accountId, conversationId, contactId, textBody, metaMsgId = null) {
  const providerMsgId = metaMsgId || `wamid.bot_${Date.now()}`;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.whatsapp_messages) store.whatsapp_messages = [];
    const newMsg = {
      id: Date.now(),
      business_id: businessId,
      conversation_id: conversationId,
      contact_id: contactId,
      whatsapp_account_id: accountId,
      meta_message_id: providerMsgId,
      direction: 'OUTBOUND',
      message_type: 'text',
      message_body: textBody,
      message_status: 'sent',
      sent_at: new Date(),
      created_at: new Date()
    };
    store.whatsapp_messages.push(newMsg);
    saveMemoryStore();
    emitToTenant(businessId, 'inbox:new_message', { conversationId, message: newMsg });
    return;
  }

  await executeQuery(
    `INSERT INTO whatsapp_messages 
      (business_id, conversation_id, contact_id, whatsapp_account_id, meta_message_id, direction, message_type, message_body, message_status, sent_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'OUTBOUND', 'text', ?, 'sent', NOW(), NOW(), NOW())`,
    [businessId, conversationId, contactId, accountId, providerMsgId, textBody]
  );

  await executeQuery(
    'UPDATE whatsapp_conversations SET last_message_text = ?, last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
    [textBody, conversationId]
  );

  emitToTenant(businessId, 'inbox:new_message', {
    conversationId,
    message: {
      business_id: businessId,
      conversation_id: conversationId,
      direction: 'OUTBOUND',
      message_body: textBody,
      created_at: new Date()
    }
  });
}

/**
 * Register Callback Lead Request (Phase 6-D)
 */
async function registerCallbackRequest({ businessId, automationId, sessionId, accountId, conversationId, contactId, customerName, customerPhone }) {
  logger.info(`📞 [AutomationEngine] Registering Callback Lead Request for ${customerPhone} (biz: ${businessId})`);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.automation_callbacks) store.automation_callbacks = [];
    store.automation_callbacks.push({
      id: Date.now(),
      business_id: businessId,
      automation_id: automationId,
      session_id: sessionId,
      whatsapp_account_id: accountId,
      conversation_id: conversationId,
      contact_id: contactId,
      customer_name: customerName,
      customer_phone: customerPhone,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Add "Callback Requested" tag to contact
    const contact = (store.contacts || []).find(c => c.id === contactId);
    if (contact) {
      if (!Array.isArray(contact.tags)) contact.tags = [];
      if (!contact.tags.includes('Callback Requested')) contact.tags.push('Callback Requested');
    }
    saveMemoryStore();
    return;
  }

  // Prevent duplicate callback requests for the same session
  const existing = await executeQuery(
    'SELECT id FROM automation_callbacks WHERE session_id = ? AND status = "pending" LIMIT 1',
    [sessionId]
  );
  if (existing && existing.length > 0) return;

  await executeQuery(
    `INSERT INTO automation_callbacks 
      (business_id, automation_id, session_id, whatsapp_account_id, conversation_id, contact_id, customer_name, customer_phone, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
    [businessId, automationId, sessionId, accountId, conversationId, contactId, customerName, customerPhone]
  );

  // Increment total callbacks counter on automation
  await executeQuery('UPDATE automations SET total_callbacks = total_callbacks + 1 WHERE id = ?', [automationId]);

  // Tag contact in contacts table
  await executeQuery(
    `UPDATE contacts 
     SET tags = JSON_ARRAY_APPEND(COALESCE(tags, '[]'), '$', 'Callback Requested'),
         updated_at = NOW()
     WHERE id = ? AND (tags IS NULL OR NOT JSON_CONTAINS(COALESCE(tags, '[]'), '"Callback Requested"'))`,
    [contactId]
  );

  // Emit real-time notification to tenant dashboard
  emitToTenant(businessId, 'automation:callback_requested', {
    automationId,
    customerPhone,
    customerName,
    conversationId
  });
}

async function updateSessionStep(sessionId, nextStepId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const s = store.automation_sessions?.find(sess => sess.id === sessionId);
    if (s) {
      s.current_step_id = nextStepId;
      s.unexpected_reply_count = 0;
      s.updated_at = new Date();
    }
    saveMemoryStore();
    return;
  }
  await executeQuery(
    'UPDATE automation_sessions SET current_step_id = ?, unexpected_reply_count = 0, updated_at = NOW() WHERE id = ?',
    [nextStepId, sessionId]
  );
}

async function incrementUnexpectedCounter(sessionId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const s = store.automation_sessions?.find(sess => sess.id === sessionId);
    if (s) s.unexpected_reply_count = (s.unexpected_reply_count || 0) + 1;
    saveMemoryStore();
    return;
  }
  await executeQuery('UPDATE automation_sessions SET unexpected_reply_count = unexpected_reply_count + 1 WHERE id = ?', [sessionId]);
}

async function resetUnexpectedCounter(sessionId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const s = store.automation_sessions?.find(sess => sess.id === sessionId);
    if (s) s.unexpected_reply_count = 0;
    saveMemoryStore();
    return;
  }
  await executeQuery('UPDATE automation_sessions SET unexpected_reply_count = 0 WHERE id = ?', [sessionId]);
}

async function completeSession(sessionId, finalStatus = 'completed', assignAgentId = null) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const s = store.automation_sessions?.find(sess => sess.id === sessionId);
    if (s) {
      s.status = finalStatus;
      s.updated_at = new Date();
    }
    saveMemoryStore();
    return;
  }
  await executeQuery(
    'UPDATE automation_sessions SET status = ?, updated_at = NOW() WHERE id = ?',
    [finalStatus, sessionId]
  );

  if (assignAgentId) {
    const [sess] = await executeQuery('SELECT conversation_id, business_id FROM automation_sessions WHERE id = ?', [sessionId]);
    if (sess?.conversation_id) {
      await executeQuery(
        'UPDATE whatsapp_conversations SET assigned_user_id = ?, updated_at = NOW() WHERE id = ? AND business_id = ?',
        [assignAgentId, sess.conversation_id, sess.business_id]
      );
    }
  }
}
