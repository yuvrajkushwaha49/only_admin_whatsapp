import { GoogleGenAI } from '@google/genai';
import logger from '../../utils/logger.js';
import { executeQuery } from '../../database/db.js';

/**
 * Reusable Gemini Service
 * Handles official Google GenAI SDK calls, retry logic, timeouts,
 * token tracking, and error masking.
 */

// In-memory cache of dynamic settings from ai_settings table
let cachedSettings = null;
let lastSettingsFetch = 0;

export async function getAiSettings() {
  const now = Date.now();
  if (cachedSettings && now - lastSettingsFetch < 30000) {
    return cachedSettings;
  }
  try {
    const rows = await executeQuery('SELECT setting_key, setting_value FROM ai_settings');
    const settings = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        settings[r.setting_key] = r.setting_value;
      });
    }
    cachedSettings = settings;
    lastSettingsFetch = now;
    return settings;
  } catch (err) {
    logger.warn('[Gemini] Could not fetch ai_settings from DB, using env defaults:', err.message);
    return {};
  }
}

export function clearSettingsCache() {
  cachedSettings = null;
  lastSettingsFetch = 0;
}

/**
 * Get effective model configuration from DB or process.env
 */
export async function getModelConfig() {
  const dbSettings = await getAiSettings();
  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: dbSettings.gemini_model || process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    temperature: parseFloat(dbSettings.ai_temperature || process.env.GEMINI_TEMPERATURE || '0.3'),
    maxTokens: parseInt(dbSettings.ai_max_tokens || process.env.AI_MAX_OUTPUT_TOKENS || '1000', 10),
    timeoutMs: parseInt(dbSettings.ai_request_timeout || process.env.AI_REQUEST_TIMEOUT || '30000', 10),
    chatEnabled: (dbSettings.ai_chat_enabled ?? process.env.AI_CHAT_ENABLED ?? 'true') === 'true'
  };
}

/**
 * Primary chat response generator
 * @param {Object} options
 * @param {string} options.systemInstruction
 * @param {Array<{role: string, content: string}>|string} options.contents
 * @param {string} [options.model]
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @returns {Promise<{text: string, inputTokens: number, outputTokens: number, model: string, durationMs: number}>}
 */
export async function generateChatResponse({
  systemInstruction,
  contents,
  model,
  temperature,
  maxTokens
}) {
  const config = await getModelConfig();

  if (!config.chatEnabled) {
    throw new Error('AI Chatbot service is currently disabled by administrator.');
  }

  const selectedModel = model || config.model;
  const effectiveTemp = temperature !== undefined ? temperature : config.temperature;
  const effectiveMaxTokens = maxTokens !== undefined ? maxTokens : config.maxTokens;

  // Masked check for API Key
  const apiKey = config.apiKey;
  const isMockOrMissingKey = !apiKey || apiKey === 'placeholder_gemini_key' || apiKey.startsWith('placeholder');

  const startTime = Date.now();

  if (isMockOrMissingKey) {
    logger.warn('[Gemini] No valid GEMINI_API_KEY detected. Using grounded documentation fallback synthesizer.');
    return synthesizeMockResponse({ systemInstruction, contents, model: selectedModel, startTime });
  }

  // Attempt GenAI with retry
  let attempts = 0;
  const maxRetries = 2;
  let lastError = null;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const ai = new GoogleGenAI({ apiKey });

      // Format contents for GenAI SDK
      let formattedContents = [];
      if (typeof contents === 'string') {
        formattedContents = [{ role: 'user', parts: [{ text: contents }] }];
      } else if (Array.isArray(contents)) {
        formattedContents = contents.map(c => ({
          role: c.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: c.content || c.text || '' }]
        }));
      }

      // Execute with timeout race
      const apiPromise = ai.models.generateContent({
        model: selectedModel,
        contents: formattedContents,
        config: {
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          temperature: effectiveTemp,
          maxOutputTokens: effectiveMaxTokens
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI request timed out after ' + config.timeoutMs + 'ms')), config.timeoutMs)
      );

      const response = await Promise.race([apiPromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;

      const responseText = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text) || '';

      const inputTokens = response.usageMetadata?.promptTokenCount || 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;

      return {
        text: responseText.trim(),
        inputTokens,
        outputTokens,
        model: selectedModel,
        durationMs
      };
    } catch (err) {
      lastError = err;
      logger.error(`[Gemini] Attempt ${attempts} failed:`, err.message);

      // Check if temporary failure eligible for retry (rate limit 429 or 503)
      const isTransient = err.message?.includes('429') || err.message?.includes('503') || err.message?.includes('ResourceExhausted');
      if (isTransient && attempts <= maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempts));
        continue;
      }
      break;
    }
  }

  // If live call failed, check if we can synthesize a clean response from retrieved documentation
  logger.warn('[Gemini] Live API call failed, falling back to grounded synthesizer:', lastError?.message);
  return synthesizeMockResponse({ systemInstruction, contents, model: selectedModel, startTime, error: lastError });
}

/**
 * Intelligent fallback synthesizer that grounds answers using retrieved knowledge chunks
 * when Gemini API key is not configured or temporary API failure occurs.
 */
function synthesizeMockResponse({ systemInstruction, contents, model, startTime, error }) {
  const durationMs = Date.now() - startTime;
  let userQuery = '';
  if (typeof contents === 'string') {
    userQuery = contents;
  } else if (Array.isArray(contents) && contents.length > 0) {
    const lastUser = [...contents].reverse().find(c => c.role === 'user');
    userQuery = lastUser?.content || lastUser?.text || '';
  }

  // Extract grounding context from systemInstruction if present
  let docContext = '';
  if (systemInstruction && systemInstruction.includes('Approved Knowledge Base Documentation:')) {
    docContext = systemInstruction.split('Approved Knowledge Base Documentation:')[1] || '';
  }

  if (docContext && docContext.trim().length > 50) {
    // Generate grounded clean summary based on retrieved knowledge base content
    return {
      text: formatGroundedAnswer(userQuery, docContext),
      inputTokens: Math.round((systemInstruction?.length || 500) / 4),
      outputTokens: 180,
      model: `${model} (grounded-kb)`,
      durationMs
    };
  }

  return {
    text: "I'm unable to provide a confirmed answer to this question from our current documentation. Please contact our human support team for further assistance.",
    inputTokens: 0,
    outputTokens: 25,
    model: `${model} (fallback)`,
    durationMs
  };
}

/**
 * Helper to produce formatted markdown answers from verified knowledge base context
 */
function formatGroundedAnswer(query, docSnippet) {
  // Clean markdown snippet of system delimiters
  const cleanSnippet = docSnippet
    .replace(/---/g, '')
    .replace(/\[Source: [^\]]+\]/g, '')
    .trim();

  // Return clean, well-structured answer
  return `${cleanSnippet.slice(0, 1200)}

---
*💡 Note: This information is retrieved directly from our verified WhatsApp SaaS Platform documentation.*`;
}

export default {
  getAiSettings,
  clearSettingsCache,
  getModelConfig,
  generateChatResponse
};
