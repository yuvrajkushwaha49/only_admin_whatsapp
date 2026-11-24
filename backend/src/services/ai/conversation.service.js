import { executeQuery } from '../../database/db.js';
import logger from '../../utils/logger.js';

/**
 * Conversation Service
 * Manages database persistence for AI conversations, messages, feedback,
 * and usage logs with strict multi-tenant authorization.
 */

/**
 * Create a new conversation for a tenant user
 */
export async function createConversation(tenantId, userId, title = 'New Support Conversation') {
  const result = await executeQuery(
    `INSERT INTO ai_conversations (tenant_id, user_id, conversation_title, status)
     VALUES (?, ?, ?, 'active')`,
    [tenantId, userId, title.slice(0, 255)]
  );

  return {
    id: result.insertId,
    tenant_id: tenantId,
    user_id: userId,
    conversation_title: title,
    status: 'active',
    created_at: new Date()
  };
}

/**
 * Get active conversations belonging to the authenticated user/tenant
 */
export async function getConversations(tenantId, userId, { page = 1, limit = 20 } = {}) {
  const offset = (Number(page) - 1) * Number(limit);

  const rows = await executeQuery(
    `SELECT c.id, c.conversation_title, c.status, c.created_at, c.updated_at,
            (SELECT message_content FROM ai_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message,
            (SELECT created_at FROM ai_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message_at
     FROM ai_conversations c
     WHERE c.tenant_id = ? AND c.user_id = ? AND c.status != 'archived'
     ORDER BY c.updated_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, userId, Number(limit), Number(offset)]
  );

  const countResult = await executeQuery(
    `SELECT COUNT(*) as total FROM ai_conversations WHERE tenant_id = ? AND user_id = ? AND status != 'archived'`,
    [tenantId, userId]
  );

  return {
    conversations: rows || [],
    pagination: {
      total: countResult[0]?.total || 0,
      page: Number(page),
      limit: Number(limit)
    }
  };
}

/**
 * Get conversation details and its messages after validating tenant ownership
 */
export async function getConversationWithMessages(conversationId, tenantId, userId, isSuperAdmin = false) {
  let convQuery = `SELECT * FROM ai_conversations WHERE id = ?`;
  let convParams = [conversationId];

  if (!isSuperAdmin) {
    convQuery += ` AND tenant_id = ? AND user_id = ?`;
    convParams.push(tenantId, userId);
  }

  const convs = await executeQuery(convQuery, convParams);
  if (!convs || convs.length === 0) {
    const error = new Error('Conversation not found or access denied.');
    error.statusCode = 404;
    error.code = 'CONVERSATION_NOT_FOUND';
    throw error;
  }

  const conversation = convs[0];

  const messages = await executeQuery(
    `SELECT m.id, m.conversation_id, m.sender_type, m.message_content, m.message_status,
            m.input_tokens, m.output_tokens, m.model_name, m.sources_json, m.created_at,
            f.feedback_type
     FROM ai_messages m
     LEFT JOIN ai_feedback f ON f.message_id = m.id AND f.user_id = ?
     WHERE m.conversation_id = ?
     ORDER BY m.id ASC`,
    [userId, conversationId]
  );

  const formattedMessages = (messages || []).map(m => {
    let sources = [];
    try {
      sources = typeof m.sources_json === 'string' ? JSON.parse(m.sources_json) : (m.sources_json || []);
    } catch (_) {}

    return {
      id: m.id,
      conversationId: m.conversation_id,
      role: m.sender_type,
      content: m.message_content,
      status: m.message_status,
      sources,
      feedback: m.feedback_type || null,
      createdAt: m.created_at
    };
  });

  return {
    conversation,
    messages: formattedMessages
  };
}

/**
 * Save a message into a conversation
 */
export async function saveMessage(conversationId, {
  senderType,
  messageContent,
  messageStatus = 'sent',
  inputTokens = 0,
  outputTokens = 0,
  modelName = null,
  sources = []
}) {
  const sourcesJson = sources && sources.length > 0 ? JSON.stringify(sources) : null;

  const result = await executeQuery(
    `INSERT INTO ai_messages (conversation_id, sender_type, message_content, message_status, input_tokens, output_tokens, model_name, sources_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [conversationId, senderType, messageContent, messageStatus, inputTokens, outputTokens, modelName, sourcesJson]
  );

  // Update conversation updated_at and optionally auto-generate title from first user query
  if (senderType === 'user') {
    const snippet = messageContent.slice(0, 40).replace(/\n/g, ' ');
    await executeQuery(
      `UPDATE ai_conversations 
       SET updated_at = NOW(),
           conversation_title = IF(conversation_title = 'New Support Conversation', ?, conversation_title)
       WHERE id = ?`,
      [snippet || 'Support Inquiry', conversationId]
    );
  } else {
    await executeQuery(`UPDATE ai_conversations SET updated_at = NOW() WHERE id = ?`, [conversationId]);
  }

  return {
    id: result.insertId,
    conversationId,
    role: senderType,
    content: messageContent,
    status: messageStatus,
    sources,
    createdAt: new Date()
  };
}

/**
 * Retrieve recent history for conversational memory
 */
export async function getRecentHistory(conversationId, limit = 8) {
  const rows = await executeQuery(
    `SELECT sender_type, message_content 
     FROM ai_messages 
     WHERE conversation_id = ? AND message_status != 'blocked'
     ORDER BY id DESC 
     LIMIT ?`,
    [conversationId, Number(limit)]
  );

  return (rows || []).reverse().map(r => ({
    role: r.sender_type === 'assistant' ? 'assistant' : 'user',
    content: r.message_content
  }));
}

/**
 * Delete (or archive) a conversation
 */
export async function deleteConversation(conversationId, tenantId, userId, isSuperAdmin = false) {
  let query = `DELETE FROM ai_conversations WHERE id = ?`;
  let params = [conversationId];

  if (!isSuperAdmin) {
    query += ` AND tenant_id = ? AND user_id = ?`;
    params.push(tenantId, userId);
  }

  const result = await executeQuery(query, params);
  if (result.affectedRows === 0) {
    const error = new Error('Conversation not found or unauthorized.');
    error.statusCode = 404;
    throw error;
  }
  return { success: true };
}

/**
 * Save user feedback for a message
 */
export async function saveFeedback({ conversationId, messageId, userId, tenantId, feedbackType, feedbackComment }) {
  if (!['helpful', 'not_helpful'].includes(feedbackType)) {
    throw new Error('Invalid feedback type. Must be "helpful" or "not_helpful".');
  }

  // Validate conversation ownership
  const convs = await executeQuery(
    'SELECT id FROM ai_conversations WHERE id = ? AND tenant_id = ?',
    [conversationId, tenantId]
  );
  if (!convs || convs.length === 0) {
    const error = new Error('Conversation not found or access denied.');
    error.statusCode = 403;
    throw error;
  }

  await executeQuery(
    `INSERT INTO ai_feedback (conversation_id, message_id, user_id, tenant_id, feedback_type, feedback_comment)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       feedback_type = VALUES(feedback_type),
       feedback_comment = VALUES(feedback_comment),
       created_at = NOW()`,
    [conversationId, messageId, userId, tenantId, feedbackType, feedbackComment || null]
  );

  return { success: true, messageId, feedbackType };
}

/**
 * Log usage and estimated cost for auditing and analytics
 */
export async function recordUsageLog({
  tenantId,
  userId,
  conversationId,
  modelName,
  inputTokens = 0,
  outputTokens = 0,
  responseTimeMs = 0,
  requestStatus = 'success',
  errorCode = null
}) {
  // Official Gemini pricing approximation (Flash: ~$0.075 / 1M input tokens, ~$0.30 / 1M output tokens)
  const costPerInputToken = 0.000000075;
  const costPerOutputToken = 0.00000030;
  const estimatedCost = (inputTokens * costPerInputToken) + (outputTokens * costPerOutputToken);

  try {
    await executeQuery(
      `INSERT INTO ai_usage_logs (tenant_id, user_id, conversation_id, model_name, input_tokens, output_tokens, estimated_cost, response_time_ms, request_status, error_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, userId, conversationId || null, modelName || 'gemini-1.5-flash', inputTokens, outputTokens, estimatedCost, responseTimeMs, requestStatus, errorCode || null]
    );
  } catch (err) {
    logger.error('[UsageLog] Error saving usage log:', err.message);
  }
}

/**
 * Super Admin: Get all conversations across tenants with filtering
 */
export async function getAdminConversations({ page = 1, limit = 20, tenantId = null, search = '' } = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  let sql = `
    SELECT c.id, c.tenant_id, c.user_id, c.conversation_title, c.status, c.created_at, c.updated_at,
           b.name as business_name, u.name as user_name, u.email as user_email,
           (SELECT COUNT(*) FROM ai_messages WHERE conversation_id = c.id) as message_count
    FROM ai_conversations c
    LEFT JOIN businesses b ON c.tenant_id = b.id
    LEFT JOIN users u ON c.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (tenantId) {
    sql += ` AND c.tenant_id = ?`;
    params.push(tenantId);
  }

  if (search) {
    sql += ` AND (c.conversation_title LIKE ? OR b.name LIKE ? OR u.name LIKE ? OR u.email LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  sql += ` ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const conversations = await executeQuery(sql, params);

  const countResult = await executeQuery(
    `SELECT COUNT(*) as total FROM ai_conversations c WHERE 1=1 ${tenantId ? 'AND c.tenant_id = ' + Number(tenantId) : ''}`
  );

  return {
    conversations: conversations || [],
    pagination: {
      total: countResult[0]?.total || 0,
      page: Number(page),
      limit: Number(limit)
    }
  };
}

/**
 * Super Admin: Get AI Analytics and Cost Summary
 */
export async function getAdminAnalytics({ timeRange = '30d', tenantId = null } = {}) {
  let interval = 'INTERVAL 30 DAY';
  if (timeRange === 'today') interval = 'INTERVAL 1 DAY';
  if (timeRange === '7d') interval = 'INTERVAL 7 DAY';
  if (timeRange === 'this_month') interval = 'INTERVAL 1 MONTH';

  const tenantClause = tenantId ? `AND tenant_id = ${Number(tenantId)}` : '';

  // 1. Totals
  const totals = await executeQuery(`
    SELECT 
      COUNT(*) as total_requests,
      SUM(CASE WHEN request_status = 'success' THEN 1 ELSE 0 END) as successful_requests,
      SUM(CASE WHEN request_status = 'failed' THEN 1 ELSE 0 END) as failed_requests,
      SUM(CASE WHEN request_status = 'blocked' THEN 1 ELSE 0 END) as blocked_requests,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(estimated_cost), 0) as total_estimated_cost,
      COALESCE(AVG(response_time_ms), 0) as avg_response_time_ms
    FROM ai_usage_logs
    WHERE created_at >= NOW() - ${interval} ${tenantClause}
  `);

  // 2. Conversations count
  const convCount = await executeQuery(`
    SELECT COUNT(*) as total_conversations FROM ai_conversations
    WHERE created_at >= NOW() - ${interval} ${tenantClause}
  `);

  // 3. User messages count
  const msgCount = await executeQuery(`
    SELECT 
      SUM(CASE WHEN sender_type = 'user' THEN 1 ELSE 0 END) as user_messages,
      SUM(CASE WHEN sender_type = 'assistant' THEN 1 ELSE 0 END) as assistant_messages
    FROM ai_messages
    WHERE created_at >= NOW() - ${interval}
  `);

  // 4. Feedback stats
  const feedbackStats = await executeQuery(`
    SELECT 
      COUNT(*) as total_feedback,
      SUM(CASE WHEN feedback_type = 'helpful' THEN 1 ELSE 0 END) as helpful_count,
      SUM(CASE WHEN feedback_type = 'not_helpful' THEN 1 ELSE 0 END) as not_helpful_count
    FROM ai_feedback
    WHERE created_at >= NOW() - ${interval} ${tenantClause}
  `);

  // 5. Daily usage trend
  const dailyTrends = await executeQuery(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as requests,
      SUM(input_tokens + output_tokens) as total_tokens,
      SUM(estimated_cost) as estimated_cost
    FROM ai_usage_logs
    WHERE created_at >= NOW() - ${interval} ${tenantClause}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  const fbTotal = feedbackStats[0]?.total_feedback || 0;
  const helpfulCount = feedbackStats[0]?.helpful_count || 0;
  const helpfulPercentage = fbTotal > 0 ? Math.round((helpfulCount / fbTotal) * 100) : 100;

  return {
    summary: {
      totalConversations: convCount[0]?.total_conversations || 0,
      totalUserMessages: msgCount[0]?.user_messages || 0,
      totalAiResponses: msgCount[0]?.assistant_messages || 0,
      totalRequests: totals[0]?.total_requests || 0,
      successfulRequests: totals[0]?.successful_requests || 0,
      failedRequests: totals[0]?.failed_requests || 0,
      blockedRequests: totals[0]?.blocked_requests || 0,
      totalInputTokens: totals[0]?.total_input_tokens || 0,
      totalOutputTokens: totals[0]?.total_output_tokens || 0,
      totalTokens: (totals[0]?.total_input_tokens || 0) + (totals[0]?.total_output_tokens || 0),
      totalEstimatedCost: Number(totals[0]?.total_estimated_cost || 0).toFixed(4),
      avgResponseTimeMs: Math.round(totals[0]?.avg_response_time_ms || 0),
      helpfulPercentage,
      notHelpfulPercentage: 100 - helpfulPercentage
    },
    dailyTrends: dailyTrends || []
  };
}

export default {
  createConversation,
  getConversations,
  getConversationWithMessages,
  saveMessage,
  getRecentHistory,
  deleteConversation,
  saveFeedback,
  recordUsageLog,
  getAdminConversations,
  getAdminAnalytics
};
