import { Router } from 'express';
import * as aiCopyService from './ai.service.js';
import * as chatbotService from '../../services/ai/chatbot.service.js';
import * as conversationService from '../../services/ai/conversation.service.js';
import * as knowledgeBaseService from '../../services/ai/knowledgeBase.service.js';
import * as geminiService from '../../services/ai/gemini.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requirePlatformOwner } from '../../middleware/tenant.js';
import { executeQuery } from '../../database/db.js';

const router = Router();

// All AI routes require user authentication
router.use(authenticate);

// ==============================================================================
// 1. Client & Common AI Chatbot Endpoints
// ==============================================================================

/**
 * POST /api/ai/chat
 * Send a message to the WhatsApp SaaS AI Support Assistant
 */
router.post('/chat', requireTenant, async (req, res, next) => {
  try {
    const { conversationId, message } = req.body;
    const tenantId = req.businessId;
    const userId = req.user.id;

    const result = await chatbotService.processChatMessage({
      tenantId,
      userId,
      conversationId: conversationId ? Number(conversationId) : null,
      message
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/conversations
 * Create a fresh conversation
 */
router.post('/conversations', requireTenant, async (req, res, next) => {
  try {
    const { title } = req.body || {};
    const tenantId = req.businessId;
    const userId = req.user.id;

    const conv = await conversationService.createConversation(tenantId, userId, title);
    res.status(201).json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ai/conversations
 * Get authenticated user's active conversations
 */
router.get('/conversations', requireTenant, async (req, res, next) => {
  try {
    const tenantId = req.businessId;
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const data = await conversationService.getConversations(tenantId, userId, { page, limit });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ai/conversations/:id
 * Get conversation history after validating tenant ownership
 */
router.get('/conversations/:id', requireTenant, async (req, res, next) => {
  try {
    const conversationId = Number(req.params.id);
    const tenantId = req.businessId;
    const userId = req.user.id;
    const isSuper = req.user.role === 'superadmin';

    const data = await conversationService.getConversationWithMessages(conversationId, tenantId, userId, isSuper);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/ai/conversations/:id
 * Delete or archive conversation
 */
router.delete('/conversations/:id', requireTenant, async (req, res, next) => {
  try {
    const conversationId = Number(req.params.id);
    const tenantId = req.businessId;
    const userId = req.user.id;
    const isSuper = req.user.role === 'superadmin';

    const result = await conversationService.deleteConversation(conversationId, tenantId, userId, isSuper);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/feedback
 * Submit helpful / not helpful feedback for an assistant response
 */
router.post('/feedback', requireTenant, async (req, res, next) => {
  try {
    const { conversationId, messageId, feedbackType, feedbackComment } = req.body;
    const tenantId = req.businessId;
    const userId = req.user.id;

    const result = await conversationService.saveFeedback({
      conversationId: Number(conversationId),
      messageId: Number(messageId),
      userId,
      tenantId,
      feedbackType,
      feedbackComment
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// 2. Super Admin Suite Endpoints
// ==============================================================================

/**
 * GET /api/ai/admin/analytics
 * Real database-calculated analytics on AI usage, tokens, feedback, cost
 */
router.get('/admin/analytics', requirePlatformOwner, async (req, res, next) => {
  try {
    const { timeRange = '30d', tenantId } = req.query;
    const data = await conversationService.getAdminAnalytics({ timeRange, tenantId });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ai/admin/conversations
 * Super Admin conversation monitoring across tenants
 */
router.get('/admin/conversations', requirePlatformOwner, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tenantId, search } = req.query;
    const data = await conversationService.getAdminConversations({ page, limit, tenantId, search });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ai/admin/knowledge-base/status
 * Check Knowledge Base indexing status
 */
router.get('/admin/knowledge-base/status', requirePlatformOwner, async (req, res, next) => {
  try {
    const status = await knowledgeBaseService.getKnowledgeBaseStatus();
    res.json({ success: true, status });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/admin/knowledge-base/reindex
 * Trigger on-demand document re-indexing
 */
router.post('/admin/knowledge-base/reindex', requirePlatformOwner, async (req, res, next) => {
  try {
    const result = await knowledgeBaseService.indexKnowledgeBase();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ai/admin/settings
 * Read current AI settings (without exposing secret keys)
 */
router.get('/admin/settings', requirePlatformOwner, async (req, res, next) => {
  try {
    const config = await geminiService.getModelConfig();
    const rows = await executeQuery('SELECT setting_key, setting_value, updated_at FROM ai_settings');
    const settingsMap = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        settingsMap[r.setting_key] = r.setting_value;
      });
    }

    res.json({
      success: true,
      settings: {
        ai_chat_enabled: settingsMap.ai_chat_enabled ?? 'true',
        gemini_model: settingsMap.gemini_model || config.model,
        ai_temperature: settingsMap.ai_temperature || String(config.temperature),
        ai_max_tokens: settingsMap.ai_max_tokens || String(config.maxTokens),
        ai_request_timeout: settingsMap.ai_request_timeout || String(config.timeoutMs),
        rate_limit_per_minute: settingsMap.rate_limit_per_minute || '20',
        has_gemini_key: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'placeholder_gemini_key'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/admin/settings
 * Update permitted AI settings
 */
router.post('/admin/settings', requirePlatformOwner, async (req, res, next) => {
  try {
    const allowedKeys = [
      'ai_chat_enabled',
      'gemini_model',
      'ai_temperature',
      'ai_max_tokens',
      'ai_request_timeout',
      'rate_limit_per_minute'
    ];

    const updates = req.body || {};
    for (const key of Object.keys(updates)) {
      if (allowedKeys.includes(key)) {
        await executeQuery(
          `INSERT INTO ai_settings (setting_key, setting_value)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          [key, String(updates[key])]
        );
      }
    }

    geminiService.clearSettingsCache();
    res.json({ success: true, message: 'AI settings updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// 3. Existing Legacy Endpoint Preservation
// ==============================================================================
router.post('/generate-copy', requireTenant, async (req, res, next) => {
  try {
    const result = await aiCopyService.generateCopy(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
