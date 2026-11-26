import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import { validateAutomationDefinition } from './automations.validator.js';
import { getTemplateById } from './automations.templates.js';
import logger from '../../utils/logger.js';
import { encodeHashId, decodeHashId } from '../../utils/hashId.js';

function parseId(rawId) {
  if (!rawId) return null;
  const s = String(rawId).trim();
  if (/^\d+$/.test(s)) return Number(s);
  return decodeHashId(s);
}

let automationTablesChecked = false;

/**
 * Self-healing schema: auto-creates tables and adds missing columns on older tables
 */
export async function ensureAutomationTables() {
  if (automationTablesChecked || isUsingFallback()) return;
  try {
    // 1. Ensure table exists
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS automations (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        business_id BIGINT UNSIGNED NOT NULL,
        whatsapp_account_id BIGINT UNSIGNED NULL,
        name VARCHAR(100) NOT NULL,
        purpose VARCHAR(500) NULL,
        template_type VARCHAR(50) DEFAULT 'blank',
        status ENUM('draft', 'published', 'paused', 'archived') DEFAULT 'draft',
        current_version_id BIGINT UNSIGNED NULL,
        draft_definition JSON NULL,
        total_conversations INT UNSIGNED DEFAULT 0,
        total_callbacks INT UNSIGNED DEFAULT 0,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_auto_business_status (business_id, status),
        INDEX idx_auto_account (whatsapp_account_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Check and heal missing columns on existing automations table
    const cols = await executeQuery(`SHOW COLUMNS FROM automations`);
    const colNames = (cols || []).map(c => (c.Field || '').toLowerCase());

    if (!colNames.includes('whatsapp_account_id')) {
      await executeQuery(`ALTER TABLE automations ADD COLUMN whatsapp_account_id BIGINT UNSIGNED NULL AFTER business_id`);
      logger.info('[AutomationService] Auto-added missing column "whatsapp_account_id" to automations table.');
    }
    if (!colNames.includes('template_type')) {
      await executeQuery(`ALTER TABLE automations ADD COLUMN template_type VARCHAR(50) DEFAULT 'blank'`);
      logger.info('[AutomationService] Auto-added missing column "template_type" to automations table.');
    }
    if (!colNames.includes('purpose')) {
      await executeQuery(`ALTER TABLE automations ADD COLUMN purpose VARCHAR(500) NULL`);
    }
    if (!colNames.includes('status')) {
      await executeQuery(`ALTER TABLE automations ADD COLUMN status ENUM('draft', 'published', 'paused', 'archived') DEFAULT 'draft'`);
    }
    if (!colNames.includes('current_version_id')) {
      await executeQuery(`ALTER TABLE automations ADD COLUMN current_version_id BIGINT UNSIGNED NULL`);
    }
    if (!colNames.includes('draft_definition')) {
      await executeQuery(`ALTER TABLE automations ADD COLUMN draft_definition JSON NULL`);
    }
    if (!colNames.includes('total_conversations')) {
      await executeQuery(`ALTER TABLE automations ADD COLUMN total_conversations INT UNSIGNED DEFAULT 0`);
    }
    if (!colNames.includes('total_callbacks')) {
      await executeQuery(`ALTER TABLE automations ADD COLUMN total_callbacks INT UNSIGNED DEFAULT 0`);
    }
    if (!colNames.includes('created_by')) {
      await executeQuery(`ALTER TABLE automations ADD COLUMN created_by BIGINT UNSIGNED NULL`);
    }

    // 3. Ensure other automation tables exist
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS automation_versions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        automation_id BIGINT UNSIGNED NOT NULL,
        business_id BIGINT UNSIGNED NOT NULL,
        version_number INT UNSIGNED NOT NULL DEFAULT 1,
        definition JSON NOT NULL,
        published_by BIGINT UNSIGNED NULL,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_version_lookup (automation_id, version_number),
        INDEX idx_version_auto (automation_id),
        INDEX idx_version_business (business_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS automation_triggers (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        automation_id BIGINT UNSIGNED NOT NULL,
        business_id BIGINT UNSIGNED NOT NULL,
        whatsapp_account_id BIGINT UNSIGNED NULL,
        trigger_type ENUM('KEYWORD', 'BUTTON_CLICK') NOT NULL,
        keyword VARCHAR(100) NULL,
        interactive_button_id BIGINT UNSIGNED NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trig_lookup (business_id, is_active, trigger_type, keyword),
        INDEX idx_trig_button (business_id, interactive_button_id),
        INDEX idx_trig_auto (automation_id),
        INDEX idx_trig_business (business_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS automation_sessions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        business_id BIGINT UNSIGNED NOT NULL,
        automation_id BIGINT UNSIGNED NOT NULL,
        version_id BIGINT UNSIGNED NOT NULL,
        whatsapp_account_id BIGINT UNSIGNED NULL,
        conversation_id BIGINT UNSIGNED NOT NULL,
        contact_id BIGINT UNSIGNED NOT NULL,
        customer_phone VARCHAR(32) NOT NULL,
        current_step_id VARCHAR(64) NOT NULL,
        status ENUM('active', 'completed', 'handed_over', 'expired', 'stopped') DEFAULT 'active',
        unexpected_reply_count INT UNSIGNED DEFAULT 0,
        context_data JSON NULL,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sess_active (business_id, customer_phone, status),
        INDEX idx_sess_conversation (conversation_id, status),
        INDEX idx_sess_business (business_id),
        INDEX idx_sess_auto (automation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS automation_session_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        session_id BIGINT UNSIGNED NOT NULL,
        business_id BIGINT UNSIGNED NOT NULL,
        step_id VARCHAR(64) NULL,
        event_type ENUM('STEP_ENTER', 'MESSAGE_SENT', 'USER_REPLY', 'UNEXPECTED_REPLY', 'CALLBACK_REQUESTED', 'HANDOVER', 'COMPLETED') NOT NULL,
        payload JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_event_session (session_id),
        INDEX idx_event_business (business_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS automation_callbacks (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        business_id BIGINT UNSIGNED NOT NULL,
        automation_id BIGINT UNSIGNED NOT NULL,
        session_id BIGINT UNSIGNED NULL,
        whatsapp_account_id BIGINT UNSIGNED NULL,
        conversation_id BIGINT UNSIGNED NOT NULL,
        contact_id BIGINT UNSIGNED NOT NULL,
        customer_name VARCHAR(150) NULL,
        customer_phone VARCHAR(32) NOT NULL,
        status ENUM('pending', 'contacted', 'resolved', 'cancelled') DEFAULT 'pending',
        assigned_to BIGINT UNSIGNED NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cb_business_status (business_id, status),
        INDEX idx_cb_contact (contact_id),
        INDEX idx_cb_business (business_id),
        INDEX idx_cb_auto (automation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    automationTablesChecked = true;
    logger.info('[AutomationService] Auto-verified and healed all automation tables & columns.');
  } catch (err) {
    logger.warn('[AutomationService] Table auto-creation notice:', err.message);
  }
}

/**
 * List all automations for a tenant with usage metrics
 */
export async function getAutomations(businessId, filters = {}) {
  await ensureAutomationTables();
  const numBusinessId = Number(businessId);
  const { search = '', status = 'ALL', limit = 50, offset = 0 } = filters;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.automations) store.automations = [];

    let list = store.automations.filter(a => Number(a.business_id) === numBusinessId && a.status !== 'archived');

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a => (a.name && a.name.toLowerCase().includes(q)) || (a.purpose && a.purpose.toLowerCase().includes(q)));
    }

    if (status && status !== 'ALL') {
      list = list.filter(a => a.status === status.toLowerCase());
    }

    const total = list.length;
    const paginated = list.slice(Number(offset), Number(offset) + Number(limit));

    // Calculate aggregated metrics
    const publishedCount = store.automations.filter(a => Number(a.business_id) === numBusinessId && a.status === 'published').length;
    const draftCount = store.automations.filter(a => Number(a.business_id) === numBusinessId && a.status === 'draft').length;
    const totalConversations = store.automations.filter(a => Number(a.business_id) === numBusinessId).reduce((acc, a) => acc + (a.total_conversations || 0), 0);
    const totalCallbacks = store.automations.filter(a => Number(a.business_id) === numBusinessId).reduce((acc, a) => acc + (a.total_callbacks || 0), 0);

    return {
      automations: paginated.map(a => ({
        ...a,
        hashId: encodeHashId(a.id),
        triggers: a.draft_definition?.triggers || { keywords: [] }
      })),
      pagination: { total, limit: Number(limit), offset: Number(offset) },
      stats: {
        totalAutomations: store.automations.filter(a => Number(a.business_id) === numBusinessId && a.status !== 'archived').length,
        publishedCount,
        draftCount,
        totalConversations,
        totalCallbacks
      }
    };
  }

  // MySQL Implementation
  let sql = `
    SELECT 
      a.*,
      COALESCE((SELECT COUNT(*) FROM automation_sessions s WHERE s.automation_id = a.id), 0) as total_conversations,
      COALESCE((SELECT COUNT(*) FROM automation_callbacks c WHERE c.automation_id = a.id), 0) as total_callbacks
    FROM automations a
    WHERE a.business_id = ? AND a.status != 'archived'
  `;
  const params = [numBusinessId];

  if (search && search.trim()) {
    sql += ' AND (a.name LIKE ? OR a.purpose LIKE ?)';
    const wild = `%${search.trim()}%`;
    params.push(wild, wild);
  }

  if (status && status !== 'ALL') {
    sql += ' AND a.status = ?';
    params.push(status.toLowerCase());
  }

  sql += ' ORDER BY a.updated_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows = await executeQuery(sql, params);

  // Get aggregated stats
  const [statsRow] = await executeQuery(`
    SELECT 
      COUNT(*) as totalAutomations,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as publishedCount,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draftCount
    FROM automations
    WHERE business_id = ? AND status != 'archived'
  `, [numBusinessId]);

  const [sessionStats] = await executeQuery(`
    SELECT 
      COUNT(*) as totalConversations
    FROM automation_sessions
    WHERE business_id = ?
  `, [numBusinessId]);

  const [callbackStats] = await executeQuery(`
    SELECT 
      COUNT(*) as totalCallbacks
    FROM automation_callbacks
    WHERE business_id = ?
  `, [numBusinessId]);

  const parsedList = rows.map(r => {
    let def = r.draft_definition;
    if (typeof def === 'string') {
      try { def = JSON.parse(def); } catch (_) { def = {}; }
    }
    return {
      ...r,
      hashId: encodeHashId(r.id),
      draft_definition: def,
      triggers: def?.triggers || { keywords: [] }
    };
  });

  return {
    automations: parsedList,
    pagination: { total: statsRow?.totalAutomations || 0, limit: Number(limit), offset: Number(offset) },
    stats: {
      totalAutomations: statsRow?.totalAutomations || 0,
      publishedCount: Number(statsRow?.publishedCount || 0),
      draftCount: Number(statsRow?.draftCount || 0),
      totalConversations: Number(sessionStats?.totalConversations || 0),
      totalCallbacks: Number(callbackStats?.totalCallbacks || 0)
    }
  };
}

/**
 * Get single automation by ID
 */
export async function getAutomationById(businessId, rawId) {
  await ensureAutomationTables();
  const numBusinessId = Number(businessId);
  const autoId = parseId(rawId);

  if (!autoId) {
    const err = new Error('Invalid automation identifier');
    err.statusCode = 400;
    throw err;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const auto = (store.automations || []).find(a => Number(a.id) === autoId && Number(a.business_id) === numBusinessId);
    if (!auto) {
      const err = new Error('Automation not found');
      err.statusCode = 404;
      throw err;
    }
    return {
      ...auto,
      hashId: encodeHashId(auto.id)
    };
  }

  const rows = await executeQuery(
    `SELECT 
      a.*,
      COALESCE((SELECT COUNT(*) FROM automation_sessions s WHERE s.automation_id = a.id), 0) as total_conversations,
      COALESCE((SELECT COUNT(*) FROM automation_callbacks c WHERE c.automation_id = a.id), 0) as total_callbacks
     FROM automations a 
     WHERE a.id = ? AND a.business_id = ? LIMIT 1`,
    [autoId, numBusinessId]
  );

  if (!rows || rows.length === 0) {
    const err = new Error('Automation not found');
    err.statusCode = 404;
    throw err;
  }

  const auto = rows[0];
  let def = auto.draft_definition;
  if (typeof def === 'string') {
    try { def = JSON.parse(def); } catch (_) { def = {}; }
  }

  return {
    ...auto,
    hashId: encodeHashId(auto.id),
    draft_definition: def
  };
}

/**
 * Create a new automation from template or scratch
 */
export async function createAutomation(businessId, userId, data = {}) {
  await ensureAutomationTables();
  const numBusinessId = Number(businessId);
  const { name, purpose = '', templateId = 'blank', whatsappAccountId = null } = data;

  const cleanName = String(name || '').trim();
  if (!cleanName) {
    const err = new Error('Automation name is required');
    err.statusCode = 400;
    throw err;
  }

  const template = getTemplateById(templateId);
  const initialDef = JSON.parse(JSON.stringify(template.initialDefinition));

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.automations) store.automations = [];

    const newId = Date.now();
    const newAuto = {
      id: newId,
      business_id: numBusinessId,
      whatsapp_account_id: whatsappAccountId ? Number(whatsappAccountId) : null,
      name: cleanName,
      purpose: purpose ? String(purpose).trim() : '',
      template_type: templateId,
      status: 'draft',
      current_version_id: null,
      draft_definition: initialDef,
      total_conversations: 0,
      total_callbacks: 0,
      created_by: userId || null,
      created_at: new Date(),
      updated_at: new Date()
    };
    store.automations.unshift(newAuto);
    saveMemoryStore();
    return {
      ...newAuto,
      hashId: encodeHashId(newAuto.id)
    };
  }

  const insertRes = await executeQuery(
    `INSERT INTO automations 
      (business_id, whatsapp_account_id, name, purpose, template_type, status, draft_definition, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, NOW(), NOW())`,
    [
      numBusinessId,
      whatsappAccountId ? Number(whatsappAccountId) : null,
      cleanName,
      purpose ? String(purpose).trim() : '',
      templateId,
      JSON.stringify(initialDef),
      userId || null
    ]
  );

  const createdId = insertRes.insertId;
  return getAutomationById(numBusinessId, createdId);
}

/**
 * Update draft configuration of an automation
 */
export async function updateAutomation(businessId, rawId, data = {}) {
  const numBusinessId = Number(businessId);
  const autoId = parseId(rawId);

  if (!autoId) {
    const err = new Error('Invalid automation identifier');
    err.statusCode = 400;
    throw err;
  }

  const existing = await getAutomationById(numBusinessId, autoId);
  const { name, purpose, definition, whatsappAccountId } = data;

  const updatedName = name !== undefined ? String(name).trim() : existing.name;
  const updatedPurpose = purpose !== undefined ? String(purpose).trim() : existing.purpose;
  const updatedDef = definition !== undefined ? definition : existing.draft_definition;
  const updatedAccountId = whatsappAccountId !== undefined ? (whatsappAccountId ? Number(whatsappAccountId) : null) : existing.whatsapp_account_id;

  if (!updatedName) {
    const err = new Error('Automation name cannot be empty');
    err.statusCode = 400;
    throw err;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const auto = store.automations.find(a => Number(a.id) === autoId && Number(a.business_id) === numBusinessId);
    auto.name = updatedName;
    auto.purpose = updatedPurpose;
    auto.draft_definition = updatedDef;
    auto.whatsapp_account_id = updatedAccountId;
    auto.updated_at = new Date();
    saveMemoryStore();
    return { ...auto, hashId: encodeHashId(auto.id) };
  }

  await executeQuery(
    `UPDATE automations 
     SET name = ?, purpose = ?, draft_definition = ?, whatsapp_account_id = ?, updated_at = NOW()
     WHERE id = ? AND business_id = ?`,
    [updatedName, updatedPurpose, JSON.stringify(updatedDef), updatedAccountId, autoId, numBusinessId]
  );

  return getAutomationById(numBusinessId, autoId);
}

/**
 * Publish automation with versioning & trigger indexing
 */
export async function publishAutomation(businessId, rawId, userId) {
  const numBusinessId = Number(businessId);
  const autoId = parseId(rawId);

  if (!autoId) {
    const err = new Error('Invalid automation identifier');
    err.statusCode = 400;
    throw err;
  }

  const auto = await getAutomationById(numBusinessId, autoId);
  const validation = validateAutomationDefinition(auto.draft_definition);

  if (!validation.isValid) {
    const err = new Error(validation.errors.join('. '));
    err.statusCode = 400;
    err.errors = validation.errors;
    err.warnings = validation.warnings;
    throw err;
  }

  const triggersDef = auto.draft_definition?.triggers || {};
  const keywords = validation.cleanKeywords || [];
  const buttonId = triggersDef.buttonId || null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.automation_versions) store.automation_versions = [];
    if (!store.automation_triggers) store.automation_triggers = [];

    // 1. Calculate new version number
    const existingVersions = store.automation_versions.filter(v => Number(v.automation_id) === autoId);
    const newVersionNumber = existingVersions.length + 1;
    const versionId = Date.now();

    store.automation_versions.push({
      id: versionId,
      automation_id: autoId,
      business_id: numBusinessId,
      version_number: newVersionNumber,
      definition: JSON.parse(JSON.stringify(auto.draft_definition)),
      published_by: userId || null,
      published_at: new Date()
    });

    // 2. Clear old triggers and re-index
    store.automation_triggers = store.automation_triggers.filter(t => Number(t.automation_id) !== autoId);

    keywords.forEach(kw => {
      store.automation_triggers.push({
        id: Date.now() + Math.random(),
        automation_id: autoId,
        business_id: numBusinessId,
        whatsapp_account_id: auto.whatsapp_account_id,
        trigger_type: 'KEYWORD',
        keyword: kw.toLowerCase(),
        interactive_button_id: null,
        is_active: 1,
        created_at: new Date()
      });
    });

    if (buttonId) {
      store.automation_triggers.push({
        id: Date.now() + Math.random(),
        automation_id: autoId,
        business_id: numBusinessId,
        whatsapp_account_id: auto.whatsapp_account_id,
        trigger_type: 'BUTTON_CLICK',
        keyword: null,
        interactive_button_id: Number(buttonId),
        is_active: 1,
        created_at: new Date()
      });
    }

    // 3. Mark published
    const targetAuto = store.automations.find(a => Number(a.id) === autoId);
    targetAuto.status = 'published';
    targetAuto.current_version_id = versionId;
    targetAuto.updated_at = new Date();
    saveMemoryStore();

    return {
      success: true,
      message: `Automation "${targetAuto.name}" published successfully (v${newVersionNumber})`,
      automation: { ...targetAuto, hashId: encodeHashId(targetAuto.id) }
    };
  }

  // MySQL Transactional Publish
  const [versionRows] = await executeQuery(
    'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM automation_versions WHERE automation_id = ?',
    [autoId]
  );
  const nextVersion = versionRows?.next_version || 1;

  const versionInsert = await executeQuery(
    `INSERT INTO automation_versions (automation_id, business_id, version_number, definition, published_by, published_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [autoId, numBusinessId, nextVersion, JSON.stringify(auto.draft_definition), userId || null]
  );
  const versionId = versionInsert.insertId;

  // Clear existing triggers for this automation
  await executeQuery('DELETE FROM automation_triggers WHERE automation_id = ?', [autoId]);

  // Insert active keyword triggers
  for (const kw of keywords) {
    await executeQuery(
      `INSERT INTO automation_triggers (automation_id, business_id, whatsapp_account_id, trigger_type, keyword, is_active, created_at)
       VALUES (?, ?, ?, 'KEYWORD', ?, 1, NOW())`,
      [autoId, numBusinessId, auto.whatsapp_account_id, kw.toLowerCase()]
    );
  }

  // Insert button trigger if configured
  if (buttonId) {
    await executeQuery(
      `INSERT INTO automation_triggers (automation_id, business_id, whatsapp_account_id, trigger_type, interactive_button_id, is_active, created_at)
       VALUES (?, ?, ?, 'BUTTON_CLICK', ?, 1, NOW())`,
      [autoId, numBusinessId, auto.whatsapp_account_id, Number(buttonId)]
    );
  }

  // Update automation status
  await executeQuery(
    `UPDATE automations 
     SET status = 'published', current_version_id = ?, updated_at = NOW()
     WHERE id = ? AND business_id = ?`,
    [versionId, autoId, numBusinessId]
  );

  return {
    success: true,
    message: `Automation "${auto.name}" published successfully (v${nextVersion})`,
    automation: await getAutomationById(numBusinessId, autoId)
  };
}

/**
 * Pause / Unpublish automation
 */
export async function pauseAutomation(businessId, rawId) {
  const numBusinessId = Number(businessId);
  const autoId = parseId(rawId);

  if (!autoId) {
    const err = new Error('Invalid automation identifier');
    err.statusCode = 400;
    throw err;
  }

  const auto = await getAutomationById(numBusinessId, autoId);
  const newStatus = auto.status === 'published' ? 'paused' : 'published';

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const target = store.automations.find(a => Number(a.id) === autoId && Number(a.business_id) === numBusinessId);
    target.status = newStatus;
    target.updated_at = new Date();

    // Toggle trigger active state
    (store.automation_triggers || []).forEach(t => {
      if (Number(t.automation_id) === autoId) {
        t.is_active = newStatus === 'published' ? 1 : 0;
      }
    });
    saveMemoryStore();
    return { success: true, status: newStatus, automation: { ...target, hashId: encodeHashId(target.id) } };
  }

  await executeQuery(
    'UPDATE automations SET status = ?, updated_at = NOW() WHERE id = ? AND business_id = ?',
    [newStatus, autoId, numBusinessId]
  );

  await executeQuery(
    'UPDATE automation_triggers SET is_active = ? WHERE automation_id = ?',
    [newStatus === 'published' ? 1 : 0, autoId]
  );

  return {
    success: true,
    status: newStatus,
    automation: await getAutomationById(numBusinessId, autoId)
  };
}

/**
 * Clone / Duplicate automation as a new draft
 */
export async function duplicateAutomation(businessId, rawId, userId) {
  const numBusinessId = Number(businessId);
  const autoId = parseId(rawId);

  const original = await getAutomationById(numBusinessId, autoId);
  const newName = `Copy of ${original.name}`.substring(0, 100);

  return createAutomation(numBusinessId, userId, {
    name: newName,
    purpose: original.purpose,
    templateId: original.template_type || 'blank',
    whatsappAccountId: original.whatsapp_account_id,
    definition: original.draft_definition
  });
}

/**
 * Delete / Archive automation
 */
export async function deleteAutomation(businessId, rawId) {
  const numBusinessId = Number(businessId);
  const autoId = parseId(rawId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const idx = (store.automations || []).findIndex(a => Number(a.id) === autoId && Number(a.business_id) === numBusinessId);
    if (idx === -1) {
      const err = new Error('Automation not found');
      err.statusCode = 404;
      throw err;
    }
    store.automations.splice(idx, 1);
    store.automation_triggers = (store.automation_triggers || []).filter(t => Number(t.automation_id) !== autoId);
    saveMemoryStore();
    return { success: true, message: 'Automation deleted successfully' };
  }

  await executeQuery('DELETE FROM automation_triggers WHERE automation_id = ?', [autoId]);
  await executeQuery('DELETE FROM automations WHERE id = ? AND business_id = ?', [autoId, numBusinessId]);

  return { success: true, message: 'Automation deleted successfully' };
}

/**
 * Get Detailed Results & Analytics for an Automation
 */
export async function getAutomationResults(businessId, rawId, filters = {}) {
  const numBusinessId = Number(businessId);
  const autoId = parseId(rawId);
  const { search = '', status = 'ALL', limit = 50, offset = 0 } = filters;

  const auto = await getAutomationById(numBusinessId, autoId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const sessions = (store.automation_sessions || []).filter(s => Number(s.automation_id) === autoId);
    const callbacks = (store.automation_callbacks || []).filter(c => Number(c.automation_id) === autoId);

    const totalConversations = sessions.length;
    const activeConversations = sessions.filter(s => s.status === 'active').length;
    const completedConversations = sessions.filter(s => s.status === 'completed').length;
    const handedOverCount = sessions.filter(s => s.status === 'handed_over').length;
    const callbackCount = callbacks.length;

    const completionRate = totalConversations > 0 ? Math.round((completedConversations / totalConversations) * 100) : 0;
    const dropOffRate = totalConversations > 0 ? Math.round(((totalConversations - completedConversations) / totalConversations) * 100) : 0;

    return {
      metrics: {
        totalConversations,
        activeConversations,
        completedConversations,
        handedOverCount,
        callbackRequests: callbackCount,
        completionRate,
        dropOffRate
      },
      conversations: sessions.slice(0, 50).map(s => ({
        ...s,
        contactName: s.customer_phone,
        callbackStatus: callbacks.some(c => c.customer_phone === s.customer_phone) ? 'Requested' : 'None'
      }))
    };
  }

  // MySQL Analytics Calculation
  const [counts] = await executeQuery(`
    SELECT 
      COUNT(*) as totalConversations,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeConversations,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedConversations,
      SUM(CASE WHEN status = 'handed_over' THEN 1 ELSE 0 END) as handedOverCount
    FROM automation_sessions
    WHERE automation_id = ? AND business_id = ?
  `, [autoId, numBusinessId]);

  const [callbackCountRow] = await executeQuery(`
    SELECT COUNT(*) as callbackRequests
    FROM automation_callbacks
    WHERE automation_id = ? AND business_id = ?
  `, [autoId, numBusinessId]);

  const total = Number(counts?.totalConversations || 0);
  const completed = Number(counts?.completedConversations || 0);
  const active = Number(counts?.activeConversations || 0);
  const handovers = Number(counts?.handedOverCount || 0);
  const callbacks = Number(callbackCountRow?.callbackRequests || 0);

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const dropOffRate = total > 0 ? Math.round(((total - completed) / total) * 100) : 0;

  // Detailed conversation history list
  let sessionSql = `
    SELECT 
      s.*,
      COALESCE(CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')), s.customer_phone) as contact_name,
      c.email,
      c.city,
      cb.status as callback_status,
      cb.created_at as callback_requested_at,
      u.name as assigned_agent_name
    FROM automation_sessions s
    LEFT JOIN contacts c ON s.contact_id = c.id
    LEFT JOIN automation_callbacks cb ON cb.session_id = s.id
    LEFT JOIN whatsapp_conversations wc ON wc.id = s.conversation_id
    LEFT JOIN users u ON u.id = wc.assigned_user_id
    WHERE s.automation_id = ? AND s.business_id = ?
  `;
  const sessionParams = [autoId, numBusinessId];

  if (search && search.trim()) {
    sessionSql += ' AND (s.customer_phone LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)';
    const wild = `%${search.trim()}%`;
    sessionParams.push(wild, wild, wild);
  }

  if (status && status !== 'ALL') {
    sessionSql += ' AND s.status = ?';
    sessionParams.push(status.toLowerCase());
  }

  sessionSql += ' ORDER BY s.updated_at DESC LIMIT ? OFFSET ?';
  sessionParams.push(Number(limit), Number(offset));

  const conversationRows = await executeQuery(sessionSql, sessionParams);

  return {
    metrics: {
      totalConversations: total,
      activeConversations: active,
      completedConversations: completed,
      handedOverCount: handovers,
      callbackRequests: callbacks,
      completionRate,
      dropOffRate
    },
    conversations: conversationRows
  };
}
