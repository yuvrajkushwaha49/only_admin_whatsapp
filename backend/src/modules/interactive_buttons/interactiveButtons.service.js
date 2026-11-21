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
        (b.value && b.value.toLowerCase().includes(q)) ||
        (b.message_text && b.message_text.toLowerCase().includes(q))
      );
    }
    if (type && type !== 'ALL') {
      buttons = buttons.filter(b => b.button_type === type || b.component_type === type);
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
    const quickReplyCount = (store.interactive_buttons || []).filter(b => Number(b.business_id) === numBusinessId && (b.button_type === 'QUICK_REPLY' || b.component_type === 'Feedback')).length;
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
    query += ' AND (title LIKE ? OR button_text LIKE ? OR value LIKE ? OR message_text LIKE ?)';
    const wild = `%${search.trim()}%`;
    params.push(wild, wild, wild, wild);
  }
  if (type && type !== 'ALL') {
    query += ' AND (button_type = ? OR component_type = ?)';
    params.push(type, type);
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

  const rows = await executeQuery(query, params);

  // Parse buttons_data JSON if string
  const buttons = rows.map(r => {
    let parsedData = r.buttons_data;
    if (typeof parsedData === 'string') {
      try { parsedData = JSON.parse(parsedData); } catch (_) {}
    }
    return {
      ...r,
      buttons_data: parsedData || (r.button_text ? [{ id: r.value || 'btn_1', label: r.button_text, when_chosen: 'Record feedback', auto_reply: '' }] : [])
    };
  });

  // Compute aggregate counts for this business
  const statsRows = await executeQuery(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN button_type = 'URL' THEN 1 ELSE 0 END) as urlCount,
      SUM(CASE WHEN button_type = 'PHONE_NUMBER' THEN 1 ELSE 0 END) as phoneCount,
      SUM(CASE WHEN button_type = 'QUICK_REPLY' OR component_type = 'Feedback' THEN 1 ELSE 0 END) as quickReplyCount,
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
  if (!rows[0]) return null;

  const r = rows[0];
  let parsedData = r.buttons_data;
  if (typeof parsedData === 'string') {
    try { parsedData = JSON.parse(parsedData); } catch (_) {}
  }

  return {
    ...r,
    buttons_data: parsedData || (r.button_text ? [{ id: r.value || 'btn_1', label: r.button_text, when_chosen: 'Record feedback', auto_reply: '' }] : [])
  };
}

export async function createButton(businessId, userId, data) {
  const numBusinessId = Number(businessId);
  const {
    name,
    title = name,
    component_type = 'Feedback',
    delivery_type = 'buttons',
    message_text = '',
    buttons_data = [],
    follow_up_enabled = 0,
    follow_up_text = '',
    button_type = 'QUICK_REPLY',
    button_text = '',
    value = '',
    url_type = 'STATIC',
    category = 'MARKETING',
    icon = 'bi-grid',
    is_active = 1
  } = data;

  const finalTitle = (title || name || '').trim();
  if (!finalTitle) {
    throw new Error('Name is required');
  }

  // Derive primary button_text & value if buttons_data provided
  const primaryBtnText = button_text || buttons_data?.[0]?.label || 'Button';
  const primaryValue = value || buttons_data?.[0]?.id || 'btn_1';

  if (primaryBtnText.length > 25) {
    throw new Error('Button display text must be 25 characters or fewer');
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.interactive_buttons) store.interactive_buttons = [];
    const newBtn = {
      id: Date.now(),
      business_id: numBusinessId,
      title: finalTitle,
      component_type,
      delivery_type,
      message_text,
      buttons_data,
      follow_up_enabled: follow_up_enabled ? 1 : 0,
      follow_up_text,
      button_type,
      button_text: primaryBtnText,
      value: primaryValue,
      url_type,
      category: (category || 'MARKETING').toUpperCase(),
      icon: icon || 'bi-grid',
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
      business_id, title, component_type, delivery_type, message_text, buttons_data,
      follow_up_enabled, follow_up_text, button_type, button_text, value, url_type, category, icon, is_active, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    numBusinessId,
    finalTitle,
    component_type,
    delivery_type,
    message_text,
    JSON.stringify(buttons_data),
    follow_up_enabled ? 1 : 0,
    follow_up_text,
    button_type,
    primaryBtnText,
    primaryValue,
    url_type,
    (category || 'MARKETING').toUpperCase(),
    icon || 'bi-grid',
    is_active ? 1 : 0,
    userId || null
  ]);

  return getButtonById(numBusinessId, res.insertId);
}

export async function updateButton(businessId, buttonId, data) {
  const numBusinessId = Number(businessId);
  const numButtonId = Number(buttonId);

  const existing = await getButtonById(numBusinessId, numButtonId);
  if (!existing) {
    throw new Error('Interactive button preset not found');
  }

  const finalTitle = data.title !== undefined ? data.title.trim() : (data.name !== undefined ? data.name.trim() : existing.title);
  const component_type = data.component_type !== undefined ? data.component_type : existing.component_type;
  const delivery_type = data.delivery_type !== undefined ? data.delivery_type : existing.delivery_type;
  const message_text = data.message_text !== undefined ? data.message_text : existing.message_text;
  const buttons_data = data.buttons_data !== undefined ? data.buttons_data : existing.buttons_data;
  const follow_up_enabled = data.follow_up_enabled !== undefined ? (data.follow_up_enabled ? 1 : 0) : existing.follow_up_enabled;
  const follow_up_text = data.follow_up_text !== undefined ? data.follow_up_text : existing.follow_up_text;
  const button_type = data.button_type !== undefined ? data.button_type : existing.button_type;
  const button_text = data.button_text !== undefined ? data.button_text : (buttons_data?.[0]?.label || existing.button_text);
  const value = data.value !== undefined ? data.value : (buttons_data?.[0]?.id || existing.value);
  const url_type = data.url_type !== undefined ? data.url_type : existing.url_type;
  const category = data.category !== undefined ? data.category.toUpperCase() : existing.category;
  const icon = data.icon !== undefined ? data.icon : existing.icon;
  const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const idx = (store.interactive_buttons || []).findIndex(b => Number(b.id) === numButtonId && Number(b.business_id) === numBusinessId);
    if (idx !== -1) {
      store.interactive_buttons[idx] = {
        ...store.interactive_buttons[idx],
        title: finalTitle,
        component_type,
        delivery_type,
        message_text,
        buttons_data,
        follow_up_enabled,
        follow_up_text,
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
      component_type = ?,
      delivery_type = ?,
      message_text = ?,
      buttons_data = ?,
      follow_up_enabled = ?,
      follow_up_text = ?,
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
    finalTitle,
    component_type,
    delivery_type,
    message_text,
    JSON.stringify(buttons_data),
    follow_up_enabled,
    follow_up_text,
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
