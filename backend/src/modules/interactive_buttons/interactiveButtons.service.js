import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import logger from '../../utils/logger.js';

export async function getButtons(businessId, filters = {}) {
  const { search = '', type = 'ALL', category = 'ALL', status = 'ALL' } = filters;
  const numBusinessId = Number(businessId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    let buttons = (store.interactive_buttons || []).filter(b => Number(b.business_id) === numBusinessId);

    if (search) {
      const q = search.toLowerCase();
      buttons = buttons.filter(b => 
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.button_text && b.button_text.toLowerCase().includes(q)) ||
        (b.value && b.value.toLowerCase().includes(q))
      );
    }
    if (type && type !== 'ALL') {
      buttons = buttons.filter(b => b.button_type === type);
    }
    if (category && category !== 'ALL') {
      buttons = buttons.filter(b => b.category?.toLowerCase() === category.toLowerCase());
    }
    if (status && status !== 'ALL') {
      const isActive = status === 'active' || status === '1' ? 1 : 0;
      buttons = buttons.filter(b => Number(b.is_active) === isActive);
    }

    const total = buttons.length;
    const urlCount = (store.interactive_buttons || []).filter(b => Number(b.business_id) === numBusinessId && b.button_type === 'URL').length;
    const phoneCount = (store.interactive_buttons || []).filter(b => Number(b.business_id) === numBusinessId && b.button_type === 'PHONE_NUMBER').length;
    const quickReplyCount = (store.interactive_buttons || []).filter(b => Number(b.business_id) === numBusinessId && b.button_type === 'QUICK_REPLY').length;
    const copyCodeCount = (store.interactive_buttons || []).filter(b => Number(b.business_id) === numBusinessId && b.button_type === 'COPY_CODE').length;

    return {
      buttons,
      stats: {
        total: (store.interactive_buttons || []).filter(b => Number(b.business_id) === numBusinessId).length,
        urlCount,
        phoneCount,
        quickReplyCount,
        copyCodeCount
      }
    };
  }

  // MySQL Implementation
  let query = 'SELECT * FROM interactive_buttons WHERE business_id = ?';
  const params = [numBusinessId];

  if (search && search.trim()) {
    query += ' AND (title LIKE ? OR button_text LIKE ? OR value LIKE ?)';
    const wild = `%${search.trim()}%`;
    params.push(wild, wild, wild);
  }
  if (type && type !== 'ALL') {
    query += ' AND button_type = ?';
    params.push(type);
  }
  if (category && category !== 'ALL') {
    query += ' AND category = ?';
    params.push(category.toUpperCase());
  }
  if (status && status !== 'ALL') {
    query += ' AND is_active = ?';
    params.push(status === 'active' || status === '1' ? 1 : 0);
  }

  query += ' ORDER BY created_at DESC';

  const buttons = await executeQuery(query, params);

  // Compute aggregate counts for this business
  const statsRows = await executeQuery(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN button_type = 'URL' THEN 1 ELSE 0 END) as urlCount,
      SUM(CASE WHEN button_type = 'PHONE_NUMBER' THEN 1 ELSE 0 END) as phoneCount,
      SUM(CASE WHEN button_type = 'QUICK_REPLY' THEN 1 ELSE 0 END) as quickReplyCount,
      SUM(CASE WHEN button_type = 'COPY_CODE' THEN 1 ELSE 0 END) as copyCodeCount
    FROM interactive_buttons 
    WHERE business_id = ?
  `, [numBusinessId]);

  const stats = statsRows[0] || { total: 0, urlCount: 0, phoneCount: 0, quickReplyCount: 0, copyCodeCount: 0 };

  return {
    buttons,
    stats: {
      total: Number(stats.total || 0),
      urlCount: Number(stats.urlCount || 0),
      phoneCount: Number(stats.phoneCount || 0),
      quickReplyCount: Number(stats.quickReplyCount || 0),
      copyCodeCount: Number(stats.copyCodeCount || 0)
    }
  };
}

export async function getButtonById(businessId, buttonId) {
  const numBusinessId = Number(businessId);
  const numButtonId = Number(buttonId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    return (store.interactive_buttons || []).find(b => Number(b.id) === numButtonId && Number(b.business_id) === numBusinessId) || null;
  }

  const rows = await executeQuery(
    'SELECT * FROM interactive_buttons WHERE id = ? AND business_id = ? LIMIT 1',
    [numButtonId, numBusinessId]
  );
  return rows[0] || null;
}

export async function createButton(businessId, userId, data) {
  const numBusinessId = Number(businessId);
  const {
    title,
    button_type = 'URL',
    button_text,
    value,
    url_type = 'STATIC',
    category = 'MARKETING',
    icon = 'bi-link-45deg',
    is_active = 1
  } = data;

  if (!title || !title.trim()) {
    throw new Error('Preset title is required');
  }
  if (!button_text || !button_text.trim()) {
    throw new Error('Button display text is required');
  }
  if (button_text.length > 25) {
    throw new Error('Button display text must be 25 characters or fewer (Meta Cloud API limit)');
  }
  if (!value || !value.trim()) {
    throw new Error('Target value (URL, phone number, or code) is required');
  }

  const validTypes = ['URL', 'PHONE_NUMBER', 'QUICK_REPLY', 'COPY_CODE'];
  if (!validTypes.includes(button_type)) {
    throw new Error(`Invalid button type "${button_type}". Must be one of: ${validTypes.join(', ')}`);
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.interactive_buttons) store.interactive_buttons = [];
    const newBtn = {
      id: Date.now(),
      business_id: numBusinessId,
      title: title.trim(),
      button_type,
      button_text: button_text.trim(),
      value: value.trim(),
      url_type,
      category: (category || 'MARKETING').toUpperCase(),
      icon: icon || 'bi-link-45deg',
      click_count: 0,
      is_active: is_active ? 1 : 0,
      created_by: userId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.interactive_buttons.unshift(newBtn);
    saveMemoryStore();
    return newBtn;
  }

  const res = await executeQuery(`
    INSERT INTO interactive_buttons (
      business_id, title, button_type, button_text, value, url_type, category, icon, is_active, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    numBusinessId,
    title.trim(),
    button_type,
    button_text.trim(),
    value.trim(),
    url_type,
    (category || 'MARKETING').toUpperCase(),
    icon || 'bi-link-45deg',
    is_active ? 1 : 0,
    userId || null
  ]);

  const inserted = await executeQuery('SELECT * FROM interactive_buttons WHERE id = ? LIMIT 1', [res.insertId]);
  return inserted[0];
}

export async function updateButton(businessId, buttonId, data) {
  const numBusinessId = Number(businessId);
  const numButtonId = Number(buttonId);

  const existing = await getButtonById(numBusinessId, numButtonId);
  if (!existing) {
    throw new Error('Interactive button not found');
  }

  const title = data.title !== undefined ? data.title.trim() : existing.title;
  const button_type = data.button_type !== undefined ? data.button_type : existing.button_type;
  const button_text = data.button_text !== undefined ? data.button_text.trim() : existing.button_text;
  const value = data.value !== undefined ? data.value.trim() : existing.value;
  const url_type = data.url_type !== undefined ? data.url_type : existing.url_type;
  const category = data.category !== undefined ? data.category.toUpperCase() : existing.category;
  const icon = data.icon !== undefined ? data.icon : existing.icon;
  const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;

  if (button_text.length > 25) {
    throw new Error('Button display text must be 25 characters or fewer');
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const idx = (store.interactive_buttons || []).findIndex(b => Number(b.id) === numButtonId && Number(b.business_id) === numBusinessId);
    if (idx !== -1) {
      store.interactive_buttons[idx] = {
        ...store.interactive_buttons[idx],
        title,
        button_type,
        button_text,
        value,
        url_type,
        category,
        icon,
        is_active,
        updated_at: new Date().toISOString()
      };
      saveMemoryStore();
      return store.interactive_buttons[idx];
    }
  }

  await executeQuery(`
    UPDATE interactive_buttons SET
      title = ?,
      button_type = ?,
      button_text = ?,
      value = ?,
      url_type = ?,
      category = ?,
      icon = ?,
      is_active = ?,
      updated_at = NOW()
    WHERE id = ? AND business_id = ?
  `, [
    title,
    button_type,
    button_text,
    value,
    url_type,
    category,
    icon,
    is_active,
    numButtonId,
    numBusinessId
  ]);

  return getButtonById(numBusinessId, numButtonId);
}

export async function deleteButton(businessId, buttonId) {
  const numBusinessId = Number(businessId);
  const numButtonId = Number(buttonId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (store.interactive_buttons) {
      store.interactive_buttons = store.interactive_buttons.filter(b => !(Number(b.id) === numButtonId && Number(b.business_id) === numBusinessId));
      saveMemoryStore();
    }
    return { success: true };
  }

  await executeQuery('DELETE FROM interactive_buttons WHERE id = ? AND business_id = ?', [numButtonId, numBusinessId]);
  return { success: true };
}
