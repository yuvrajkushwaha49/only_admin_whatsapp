import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';
import { normalizePhone } from '../../utils/phone.js';
import ExcelJS from 'exceljs';

export async function listContacts(businessId, { page = 1, limit = 20, search = '', tag = '', status = '', optedIn = '' }, user = null) {
  const offset = (Number(page) - 1) * Number(limit);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    let contacts = store.contacts.filter(c => c.business_id === Number(businessId));

    // Role-based scoping: Agents only see assigned / allotted contacts
    if (user?.role === 'agent') {
      const agentConvCustomerPhones = new Set(
        (store.whatsapp_conversations || [])
          .filter(wc => wc.business_id === Number(businessId) && wc.assigned_user_id === user.id)
          .map(wc => wc.customer_phone)
      );
      const agentConvContactIds = new Set(
        (store.whatsapp_conversations || [])
          .filter(wc => wc.business_id === Number(businessId) && wc.assigned_user_id === user.id && wc.contact_id)
          .map(wc => wc.contact_id)
      );
      contacts = contacts.filter(c => 
        c.assigned_user_id === user.id || 
        agentConvContactIds.has(c.id) || 
        agentConvCustomerPhones.has(c.phone)
      );
    }

    if (search) {
      const q = search.toLowerCase();
      contacts = contacts.filter(c => (c.name && c.name.toLowerCase().includes(q)) || c.phone.includes(q) || (c.email && c.email.toLowerCase().includes(q)));
    }
    if (status) {
      contacts = contacts.filter(c => c.status === status);
    }
    if (optedIn !== '') {
      const boolVal = optedIn === 'true' || optedIn === '1' ? 1 : 0;
      contacts = contacts.filter(c => Number(c.is_opted_in) === boolVal);
    }

    const total = contacts.length;
    const paginated = contacts.slice(offset, offset + Number(limit)).map(c => {
      // Find associated tags
      const contactTagIds = store.contact_tags.filter(ct => ct.contact_id === c.id).map(ct => ct.tag_id);
      const tags = store.tags.filter(t => contactTagIds.includes(t.id));
      return { ...c, tags };
    });

    let allTenant = store.contacts.filter(c => c.business_id === Number(businessId));
    if (user?.role === 'agent') {
      const agentConvCustomerPhones = new Set(
        (store.whatsapp_conversations || [])
          .filter(wc => wc.business_id === Number(businessId) && wc.assigned_user_id === user.id)
          .map(wc => wc.customer_phone)
      );
      const agentConvContactIds = new Set(
        (store.whatsapp_conversations || [])
          .filter(wc => wc.business_id === Number(businessId) && wc.assigned_user_id === user.id && wc.contact_id)
          .map(wc => wc.contact_id)
      );
      allTenant = allTenant.filter(c => 
        c.assigned_user_id === user.id || 
        agentConvContactIds.has(c.id) || 
        agentConvCustomerPhones.has(c.phone)
      );
    }
    const stats = {
      total: allTenant.length,
      optedIn: allTenant.filter(c => Boolean(c.is_opted_in)).length,
      unsubscribed: allTenant.filter(c => !Boolean(c.is_opted_in)).length,
      suppressed: allTenant.filter(c => !Boolean(c.is_opted_in) || c.status !== 'active').length
    };

    return { contacts: paginated, stats, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
  }

  // Real MySQL execution with strict tenant scoping
  let whereClauses = ['c.business_id = ?'];
  let params = [businessId];

  if (user?.role === 'agent') {
    whereClauses.push(`(
      c.assigned_user_id = ? OR EXISTS (
        SELECT 1 FROM whatsapp_conversations wc 
        WHERE wc.business_id = c.business_id 
          AND (wc.contact_id = c.id OR wc.customer_phone = c.phone) 
          AND wc.assigned_user_id = ?
      )
    )`);
    params.push(user.id, user.id);
  }

  if (search) {
    whereClauses.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (status) {
    whereClauses.push('c.status = ?');
    params.push(status);
  }

  if (optedIn !== '') {
    whereClauses.push('c.is_opted_in = ?');
    params.push(optedIn === 'true' || optedIn === '1' ? 1 : 0);
  }

  if (tag) {
    whereClauses.push('EXISTS (SELECT 1 FROM contact_tags ct JOIN tags t ON ct.tag_id = t.id WHERE ct.contact_id = c.id AND t.name = ?)');
    params.push(tag);
  }

  const whereSql = whereClauses.join(' AND ');

  const countResult = await executeQuery(`SELECT COUNT(*) as total FROM contacts c WHERE ${whereSql}`, params);
  const total = countResult[0]?.total || 0;

  const dataSql = `
    SELECT c.*, 
      COALESCE(
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
         FROM contact_tags ct
         JOIN tags t ON ct.tag_id = t.id
         WHERE ct.contact_id = c.id),
        JSON_ARRAY()
      ) as tags
    FROM contacts c
    WHERE ${whereSql}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(Number(limit), offset);

  const contacts = await executeQuery(dataSql, params);

  let statsWhere = 'business_id = ?';
  const statsParams = [businessId];
  if (user?.role === 'agent') {
    statsWhere += ` AND (
      assigned_user_id = ? OR EXISTS (
        SELECT 1 FROM whatsapp_conversations wc 
        WHERE wc.business_id = contacts.business_id 
          AND (wc.contact_id = contacts.id OR wc.customer_phone = contacts.phone) 
          AND wc.assigned_user_id = ?
      )
    )`;
    statsParams.push(user.id, user.id);
  }

  const statsRows = await executeQuery(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN is_opted_in = 1 THEN 1 END) as optedIn,
      COUNT(CASE WHEN is_opted_in = 0 THEN 1 END) as unsubscribed,
      COUNT(CASE WHEN is_opted_in = 0 OR status != 'active' THEN 1 END) as suppressed
    FROM contacts
    WHERE ${statsWhere}
  `, statsParams);
  const stats = statsRows[0] ? {
    total: Number(statsRows[0].total || 0),
    optedIn: Number(statsRows[0].optedIn || 0),
    unsubscribed: Number(statsRows[0].unsubscribed || 0),
    suppressed: Number(statsRows[0].suppressed || 0)
  } : { total, optedIn: 0, unsubscribed: 0, suppressed: 0 };

  return {
    contacts: contacts.map(c => ({
      ...c,
      tags: typeof c.tags === 'string' ? JSON.parse(c.tags) : (c.tags || [])
    })),
    stats,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  };
}

export async function createContact(businessId, { phone, name, email, countryCode = '91', tags = [], customFields = {}, consentProof = 'Manual creation by staff' }, user = null) {
  const norm = normalizePhone(phone, countryCode);
  if (!norm.isValid) {
    const error = new Error(`Invalid phone number format: ${norm.error}`);
    error.statusCode = 400;
    throw error;
  }

  const cleanPhone = norm.phone;

  // Check duplicate inside tenant
  const existing = await executeQuery('SELECT id, status, is_opted_in FROM contacts WHERE business_id = ? AND phone = ? LIMIT 1', [businessId, cleanPhone]);
  if (existing.length > 0) {
    const error = new Error(`Contact with phone ${cleanPhone} already exists in this workspace`);
    error.statusCode = 409;
    error.code = 'CONTACT_EXISTS';
    throw error;
  }

  const assignedUserId = user?.role === 'agent' ? user.id : null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const newId = store.contacts.length + 1;
    const newContact = {
      id: newId,
      business_id: Number(businessId),
      phone: cleanPhone,
      country_code: countryCode,
      name: name || null,
      email: email || null,
      is_opted_in: 1,
      status: 'active',
      assigned_user_id: assignedUserId,
      custom_fields: customFields,
      created_at: new Date()
    };
    store.contacts.push(newContact);

    // Record consent
    store.contact_consents.push({
      id: store.contact_consents.length + 1,
      business_id: Number(businessId),
      contact_id: newId,
      consent_status: 'opted_in',
      consent_source: 'manual_entry',
      consent_category: 'promotional',
      proof_notes: consentProof,
      created_at: new Date()
    });

    return newContact;
  }

  const result = await executeQuery(
    `INSERT INTO contacts (business_id, phone, country_code, name, email, is_opted_in, status, assigned_user_id, custom_fields)
     VALUES (?, ?, ?, ?, ?, TRUE, 'active', ?, ?)`,
    [businessId, cleanPhone, countryCode, name || null, email || null, assignedUserId, JSON.stringify(customFields)]
  );
  const contactId = result.insertId;

  // Add auditable consent record
  await executeQuery(
    `INSERT INTO contact_consents (business_id, contact_id, consent_status, consent_source, consent_category, proof_notes)
     VALUES (?, ?, 'opted_in', 'manual_entry', 'promotional', ?)`,
    [businessId, contactId, consentProof]
  );

  return { id: contactId, phone: cleanPhone, name, email };
}

export async function updateConsent(businessId, contactId, { optedIn, reason = 'User request' }, user = null) {
  const contacts = await executeQuery('SELECT id, phone, is_opted_in, assigned_user_id FROM contacts WHERE business_id = ? AND id = ? LIMIT 1', [businessId, contactId]);
  if (contacts.length === 0) {
    const error = new Error('Contact not found');
    error.statusCode = 404;
    throw error;
  }

  if (user?.role === 'agent') {
    const cRow = contacts[0];
    const isAssigned = cRow.assigned_user_id === user.id || (await executeQuery(
      `SELECT 1 FROM whatsapp_conversations 
       WHERE business_id = ? AND assigned_user_id = ? AND (contact_id = ? OR customer_phone = ?) LIMIT 1`,
      [businessId, user.id, contactId, cRow.phone]
    )).length > 0;
    if (!isAssigned) {
      const error = new Error('Access denied: You can only update contacts assigned to you.');
      error.statusCode = 403;
      throw error;
    }
  }

  const newStatus = optedIn ? 'active' : 'unsubscribed';

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const contact = store.contacts.find(c => c.id === Number(contactId) && c.business_id === Number(businessId));
    if (!contact) {
      const error = new Error('Contact not found');
      error.statusCode = 404;
      throw error;
    }
    if (user?.role === 'agent') {
      const isAssigned = contact.assigned_user_id === user.id || 
        (store.whatsapp_conversations || []).some(wc => 
          wc.business_id === Number(businessId) && 
          wc.assigned_user_id === user.id && 
          (wc.contact_id === contact.id || wc.customer_phone === contact.phone)
        );
      if (!isAssigned) {
        const error = new Error('Access denied: You can only update contacts assigned to you.');
        error.statusCode = 403;
        throw error;
      }
    }
    if (contact) {
      contact.is_opted_in = optedIn ? 1 : 0;
      contact.status = newStatus;
    }
    store.contact_consents.push({
      id: store.contact_consents.length + 1,
      business_id: Number(businessId),
      contact_id: Number(contactId),
      consent_status: optedIn ? 'opted_in' : 'opted_out',
      consent_source: 'dashboard_override',
      proof_notes: reason,
      withdrawn_at: optedIn ? null : new Date(),
      created_at: new Date()
    });
    return { contactId, is_opted_in: contact.is_opted_in, status: newStatus };
  }

  await executeQuery(
    'UPDATE contacts SET is_opted_in = ?, status = ? WHERE business_id = ? AND id = ?',
    [optedIn ? 1 : 0, newStatus, businessId, contactId]
  );

  await executeQuery(
    `INSERT INTO contact_consents (business_id, contact_id, consent_status, consent_source, consent_category, proof_notes, withdrawn_at)
     VALUES (?, ?, ?, 'dashboard_override', 'promotional', ?, ?)`,
    [businessId, contactId, optedIn ? 'opted_in' : 'opted_out', reason, optedIn ? null : new Date()]
  );

  return { contactId, is_opted_in: optedIn, status: newStatus };
}

export async function deleteContact(businessId, contactId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    store.contacts = store.contacts.filter(c => !(c.id === Number(contactId) && c.business_id === Number(businessId)));
    return { success: true };
  }

  await executeQuery('DELETE FROM contacts WHERE business_id = ? AND id = ?', [businessId, contactId]);
  return { success: true };
}

export async function getContactDetails(businessId, contactId, user = null) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const contact = store.contacts?.find(c => c.id === Number(contactId) && c.business_id === Number(businessId));
    if (!contact) {
      const error = new Error('Contact not found');
      error.statusCode = 404;
      throw error;
    }

    if (user?.role === 'agent') {
      const isAssigned = contact.assigned_user_id === user.id || 
        (store.whatsapp_conversations || []).some(wc => 
          wc.business_id === Number(businessId) && 
          wc.assigned_user_id === user.id && 
          (wc.contact_id === contact.id || wc.customer_phone === contact.phone)
        );
      if (!isAssigned) {
        const error = new Error('Access denied: You can only view contacts assigned to you.');
        error.statusCode = 403;
        throw error;
      }
    }
    const contactTagIds = store.contact_tags?.filter(ct => ct.contact_id === contact.id).map(ct => ct.tag_id) || [];
    const tags = store.tags?.filter(t => contactTagIds.includes(t.id)) || [];
    const consents = store.contact_consents?.filter(cc => cc.contact_id === contact.id) || [];
    const campaignHistory = (store.campaign_recipients || [])
      .filter(cr => cr.contact_id === contact.id || cr.phone === contact.phone)
      .map(cr => {
        const camp = store.campaigns?.find(c => c.id === cr.campaign_id);
        return { ...cr, campaign_name: camp?.name || 'Campaign' };
      });
    const conversation = store.whatsapp_conversations?.find(c => c.customer_phone === contact.phone);

    return {
      contact: {
        ...contact,
        tags
      },
      consents,
      campaignHistory,
      conversationId: conversation?.id || null
    };
  }

  const contacts = await executeQuery(
    `SELECT c.*, 
      COALESCE(
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
         FROM contact_tags ct
         JOIN tags t ON ct.tag_id = t.id
         WHERE ct.contact_id = c.id),
        JSON_ARRAY()
      ) as tags
     FROM contacts c
     WHERE c.business_id = ? AND c.id = ? LIMIT 1`,
    [businessId, contactId]
  );

  if (contacts.length === 0) {
    const error = new Error('Contact not found');
    error.statusCode = 404;
    throw error;
  }

  const rawContact = contacts[0];

  if (user?.role === 'agent') {
    const isAssigned = rawContact.assigned_user_id === user.id || (await executeQuery(
      `SELECT 1 FROM whatsapp_conversations 
       WHERE business_id = ? AND assigned_user_id = ? AND (contact_id = ? OR customer_phone = ?) LIMIT 1`,
      [businessId, user.id, contactId, rawContact.phone]
    )).length > 0;

    if (!isAssigned) {
      const error = new Error('Access denied: You can only view contacts assigned to you.');
      error.statusCode = 403;
      throw error;
    }
  }

  const tags = typeof rawContact.tags === 'string' ? JSON.parse(rawContact.tags) : (rawContact.tags || []);

  const consents = await executeQuery(
    `SELECT * FROM contact_consents 
     WHERE business_id = ? AND contact_id = ? 
     ORDER BY created_at DESC LIMIT 20`,
    [businessId, contactId]
  );

  const campaignHistory = await executeQuery(
    `SELECT cr.id, cr.campaign_id, cr.phone, cr.status, cr.sent_at, cr.delivered_at, cr.read_at, cr.error_message, cr.skip_reason, c.name as campaign_name, c.created_at as campaign_created_at
     FROM campaign_recipients cr
     LEFT JOIN campaigns c ON cr.campaign_id = c.id
     WHERE cr.business_id = ? AND (cr.contact_id = ? OR cr.phone = ?)
     ORDER BY cr.id DESC LIMIT 50`,
    [businessId, contactId, rawContact.phone]
  );

  const convRows = await executeQuery(
    `SELECT id FROM whatsapp_conversations 
     WHERE business_id = ? AND customer_phone = ? 
     ORDER BY last_message_at DESC LIMIT 1`,
    [businessId, rawContact.phone]
  );

  return {
    contact: {
      ...rawContact,
      tags
    },
    consents,
    campaignHistory,
    conversationId: convRows[0]?.id || null
  };
}

export async function updateContact(businessId, contactId, { name, email, phone, status, tags = [], customFields = {} }, user = null) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const contact = store.contacts?.find(c => c.id === Number(contactId) && c.business_id === Number(businessId));
    if (!contact) {
      const error = new Error('Contact not found');
      error.statusCode = 404;
      throw error;
    }
    if (user?.role === 'agent') {
      const isAssigned = contact.assigned_user_id === user.id || 
        (store.whatsapp_conversations || []).some(wc => 
          wc.business_id === Number(businessId) && 
          wc.assigned_user_id === user.id && 
          (wc.contact_id === contact.id || wc.customer_phone === contact.phone)
        );
      if (!isAssigned) {
        const error = new Error('Access denied: You can only update contacts assigned to you.');
        error.statusCode = 403;
        throw error;
      }
    }
    if (name !== undefined) contact.name = name;
    if (email !== undefined) contact.email = email;
    if (status !== undefined) contact.status = status;
    return contact;
  }

  if (user?.role === 'agent') {
    const check = await executeQuery('SELECT id, phone, assigned_user_id FROM contacts WHERE business_id = ? AND id = ? LIMIT 1', [businessId, contactId]);
    if (!check.length) {
      const error = new Error('Contact not found');
      error.statusCode = 404;
      throw error;
    }
    const isAssigned = check[0].assigned_user_id === user.id || (await executeQuery(
      `SELECT 1 FROM whatsapp_conversations 
       WHERE business_id = ? AND assigned_user_id = ? AND (contact_id = ? OR customer_phone = ?) LIMIT 1`,
      [businessId, user.id, contactId, check[0].phone]
    )).length > 0;
    if (!isAssigned) {
      const error = new Error('Access denied: You can only update contacts assigned to you.');
      error.statusCode = 403;
      throw error;
    }
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (email !== undefined) {
    updates.push('email = ?');
    params.push(email || null);
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    params.push(phone);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }

  if (updates.length > 0) {
    params.push(businessId, contactId);
    await executeQuery(
      `UPDATE contacts SET ${updates.join(', ')}, updated_at = NOW() WHERE business_id = ? AND id = ?`,
      params
    );
  }

  // Handle tags if provided
  if (Array.isArray(tags)) {
    await executeQuery('DELETE FROM contact_tags WHERE contact_id = ?', [contactId]);
    for (const tagName of tags) {
      let tagRows = await executeQuery('SELECT id FROM tags WHERE business_id = ? AND name = ?', [businessId, tagName]);
      let tagId;
      if (tagRows.length > 0) {
        tagId = tagRows[0].id;
      } else {
        const createTagRes = await executeQuery('INSERT INTO tags (business_id, name, color) VALUES (?, ?, ?)', [businessId, tagName, '#10b981']);
        tagId = createTagRes.insertId;
      }
      await executeQuery('INSERT IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)', [contactId, tagId]);
    }
  }

  return getContactDetails(businessId, contactId, user);
}

export async function listTags(businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.tags.filter(t => t.business_id === Number(businessId));
  }
  return executeQuery('SELECT * FROM tags WHERE business_id = ? ORDER BY name ASC', [businessId]);
}

/**
 * Resolve contact IDs for an array of phone numbers
 */
export async function resolveContactsByPhones(businessId, phones = []) {
  if (!Array.isArray(phones) || phones.length === 0) {
    return { contactIds: [], count: 0 };
  }

  const cleanPhones = Array.from(new Set(phones.map(p => String(p).trim()).filter(Boolean)));
  if (cleanPhones.length === 0) {
    return { contactIds: [], count: 0 };
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const matched = (store.contacts || []).filter(c => 
      c.business_id === Number(businessId) && 
      cleanPhones.includes(c.phone) &&
      (c.status === 'active' || !c.status)
    );
    return {
      contactIds: matched.map(c => c.id),
      count: matched.length
    };
  }

  const contactIds = [];
  const chunkSize = 500;
  for (let i = 0; i < cleanPhones.length; i += chunkSize) {
    const chunk = cleanPhones.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await executeQuery(
      `SELECT id, phone FROM contacts WHERE business_id = ? AND phone IN (${placeholders}) AND (status = 'active' OR status IS NULL)`,
      [Number(businessId), ...chunk]
    );
    rows.forEach(r => contactIds.push(r.id));
  }

  return {
    contactIds,
    count: contactIds.length
  };
}

export async function exportContacts(businessId, { format = 'csv', groupId, tagId, status }, user = null) {
  const numBizId = Number(businessId);
  const whereClauses = ['c.business_id = ?'];
  const params = [numBizId];

  if (groupId && groupId !== 'all' && groupId !== '') {
    whereClauses.push('EXISTS (SELECT 1 FROM contact_group_members cgm WHERE cgm.contact_id = c.id AND cgm.group_id = ?)');
    params.push(Number(groupId));
  }

  if (tagId && tagId !== 'all' && tagId !== '') {
    whereClauses.push('EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.id AND ct.tag_id = ?)');
    params.push(Number(tagId));
  }

  if (status && status !== 'all' && status !== '') {
    whereClauses.push('c.status = ?');
    params.push(status);
  }

  // Agent role restriction
  if (user?.role === 'agent') {
    whereClauses.push(`(
      c.assigned_user_id = ? OR 
      EXISTS (SELECT 1 FROM whatsapp_conversations wc WHERE wc.business_id = ? AND wc.assigned_user_id = ? AND (wc.contact_id = c.id OR wc.customer_phone = c.phone))
    )`);
    params.push(user.id, numBizId, user.id);
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT 
      c.id,
      c.name,
      c.phone,
      c.email,
      c.status,
      c.is_opted_in,
      c.created_at,
      (
        SELECT GROUP_CONCAT(t.name SEPARATOR ', ')
        FROM contact_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE ct.contact_id = c.id
      ) AS tags,
      (
        SELECT GROUP_CONCAT(g.name SEPARATOR ', ')
        FROM contact_group_members cgm
        JOIN contact_groups g ON cgm.group_id = g.id
        WHERE cgm.contact_id = c.id
      ) AS \`groups\`
    FROM contacts c
    WHERE ${whereSql}
    ORDER BY c.created_at DESC
  `;

  let rows = [];
  if (isUsingFallback()) {
    const store = getMemoryStore();
    rows = (store.contacts || []).filter(c => c.business_id === numBizId);
    if (groupId && groupId !== 'all') {
      const gMembers = (store.contact_group_members || []).filter(m => m.group_id === Number(groupId)).map(m => m.contact_id);
      rows = rows.filter(c => gMembers.includes(c.id));
    }
    if (tagId && tagId !== 'all') {
      const tMembers = (store.contact_tags || []).filter(ct => ct.tag_id === Number(tagId)).map(ct => ct.contact_id);
      rows = rows.filter(c => tMembers.includes(c.id));
    }
  } else {
    rows = await executeQuery(sql, params);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Aiveexa WhatsApp Platform';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Contacts');
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Phone Number', key: 'phone', width: 20 },
    { header: 'Email Address', key: 'email', width: 28 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'WhatsApp Opted In', key: 'is_opted_in', width: 18 },
    { header: 'Contact Groups', key: 'groups', width: 26 },
    { header: 'Tags', key: 'tags', width: 26 },
    { header: 'Created Date', key: 'created_at', width: 20 }
  ];

  // Header styling: purple background, white bold text
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7C3AED' }
  };
  worksheet.getRow(1).height = 24;
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  rows.forEach(c => {
    worksheet.addRow({
      id: c.id,
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      status: c.status || 'active',
      is_opted_in: c.is_opted_in ? 'Yes' : 'No',
      groups: c.groups || '',
      tags: c.tags || '',
      created_at: c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : ''
    });
  });

  const isExcel = format.toLowerCase() === 'excel' || format.toLowerCase() === 'xlsx';
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `contacts_export_${timestamp}.${isExcel ? 'xlsx' : 'csv'}`;
  const contentType = isExcel
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv; charset=utf-8';

  const buffer = isExcel ? await workbook.xlsx.writeBuffer() : await workbook.csv.writeBuffer();

  return {
    buffer,
    filename,
    contentType,
    count: rows.length
  };
}

export async function getExportCount(businessId, { groupId, tagId, status }, user = null) {
  const numBizId = Number(businessId);
  const whereClauses = ['c.business_id = ?'];
  const params = [numBizId];

  if (groupId && groupId !== 'all' && groupId !== '') {
    whereClauses.push('EXISTS (SELECT 1 FROM contact_group_members cgm WHERE cgm.contact_id = c.id AND cgm.group_id = ?)');
    params.push(Number(groupId));
  }
  if (tagId && tagId !== 'all' && tagId !== '') {
    whereClauses.push('EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.id AND ct.tag_id = ?)');
    params.push(Number(tagId));
  }
  if (status && status !== 'all' && status !== '') {
    whereClauses.push('c.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.join(' AND ');
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return (store.contacts || []).filter(c => c.business_id === numBizId).length;
  }
  const result = await executeQuery(`SELECT COUNT(*) as count FROM contacts c WHERE ${whereSql}`, params);
  return Number(result[0]?.count || 0);
}

export default {
  listContacts,
  getContactDetails,
  updateContact,
  createContact,
  updateConsent,
  deleteContact,
  listTags,
  resolveContactsByPhones,
  exportContacts,
  getExportCount
};
