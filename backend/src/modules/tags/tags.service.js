import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';

export async function listTags(businessId) {
  const numBizId = Number(businessId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.tags) store.tags = [];
    if (!store.contact_tags) store.contact_tags = [];
    return store.tags
      .filter(t => t.business_id === numBizId)
      .map(t => {
        const count = store.contact_tags.filter(ct => ct.tag_id === t.id).length;
        return { ...t, contact_count: count };
      })
      .sort((a, b) => b.id - a.id);
  }

  const rows = await executeQuery(
    `SELECT t.id, t.business_id, t.name, t.color, t.created_at,
            COUNT(ct.id) AS contact_count
     FROM tags t
     LEFT JOIN contact_tags ct ON t.id = ct.tag_id
     WHERE t.business_id = ?
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
    [numBizId]
  );

  return rows.map(r => ({
    ...r,
    contact_count: Number(r.contact_count || 0)
  }));
}

export async function getTagStats(businessId) {
  const numBizId = Number(businessId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const bizTags = (store.tags || []).filter(t => t.business_id === numBizId);
    const bizContacts = (store.contacts || []).filter(c => c.business_id === numBizId);
    const taggedContactIds = new Set((store.contact_tags || []).map(ct => ct.contact_id));
    return {
      totalTags: bizTags.length,
      taggedContacts: taggedContactIds.size,
      totalContacts: bizContacts.length,
      untaggedContacts: Math.max(0, bizContacts.length - taggedContactIds.size)
    };
  }

  const [tagsResult] = await executeQuery(
    `SELECT COUNT(*) AS total_tags FROM tags WHERE business_id = ?`,
    [numBizId]
  );
  const [taggedResult] = await executeQuery(
    `SELECT COUNT(DISTINCT contact_id) AS tagged_contacts FROM contact_tags WHERE business_id = ?`,
    [numBizId]
  );
  const [contactsResult] = await executeQuery(
    `SELECT COUNT(*) AS total_contacts FROM contacts WHERE business_id = ?`,
    [numBizId]
  );

  const totalTags = Number(tagsResult?.total_tags || 0);
  const taggedContacts = Number(taggedResult?.tagged_contacts || 0);
  const totalContacts = Number(contactsResult?.total_contacts || 0);

  return {
    totalTags,
    taggedContacts,
    totalContacts,
    untaggedContacts: Math.max(0, totalContacts - taggedContacts)
  };
}

export async function getTag(businessId, tagId, { search = '', page = 1, limit = 50 } = {}) {
  const numBizId = Number(businessId);
  const numTagId = Number(tagId);

  let tag = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    tag = (store.tags || []).find(t => t.id === numTagId && t.business_id === numBizId);
  } else {
    const rows = await executeQuery(
      `SELECT t.*, COUNT(ct.id) AS contact_count
       FROM tags t
       LEFT JOIN contact_tags ct ON t.id = ct.tag_id
       WHERE t.id = ? AND t.business_id = ?
       GROUP BY t.id LIMIT 1`,
      [numTagId, numBizId]
    );
    tag = rows[0] || null;
  }

  if (!tag) {
    const err = new Error('Tag not found');
    err.statusCode = 404;
    throw err;
  }

  let contacts = [];
  let totalContacts = 0;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const contactIds = (store.contact_tags || [])
      .filter(ct => ct.tag_id === numTagId && ct.business_id === numBizId)
      .map(ct => ct.contact_id);

    contacts = (store.contacts || []).filter(c => contactIds.includes(c.id));
    if (search) {
      const q = search.toLowerCase();
      contacts = contacts.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    totalContacts = contacts.length;
  } else {
    let whereClause = 'ct.tag_id = ? AND ct.business_id = ?';
    const params = [numTagId, numBizId];

    if (search && search.trim()) {
      whereClause += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const countRows = await executeQuery(
      `SELECT COUNT(*) AS total
       FROM contact_tags ct
       JOIN contacts c ON ct.contact_id = c.id
       WHERE ${whereClause}`,
      params
    );
    totalContacts = Number(countRows[0]?.total || 0);

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit), Number(offset));

    contacts = await executeQuery(
      `SELECT c.id, c.name, c.phone, c.email, c.status, c.is_opted_in, ct.created_at AS tagged_at
       FROM contact_tags ct
       JOIN contacts c ON ct.contact_id = c.id
       WHERE ${whereClause}
       ORDER BY ct.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );
  }

  return {
    tag: {
      ...tag,
      contact_count: Number(tag.contact_count || totalContacts)
    },
    contacts,
    totalContacts,
    page: Number(page),
    limit: Number(limit)
  };
}

export async function createTag(businessId, { name, color = '#7c3aed' }) {
  const numBizId = Number(businessId);
  const cleanName = (name || '').trim();

  if (!cleanName) {
    const err = new Error('Tag name is required');
    err.statusCode = 400;
    throw err;
  }

  const cleanColor = (color || '#7c3aed').trim();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.tags) store.tags = [];
    const exists = store.tags.some(t => t.business_id === numBizId && t.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      const err = new Error(`Tag with name "${cleanName}" already exists`);
      err.statusCode = 409;
      throw err;
    }
    const newTag = {
      id: Date.now(),
      business_id: numBizId,
      name: cleanName,
      color: cleanColor,
      created_at: new Date()
    };
    store.tags.push(newTag);
    return newTag;
  }

  // Check unique per business
  const existing = await executeQuery(
    `SELECT id FROM tags WHERE business_id = ? AND name = ? LIMIT 1`,
    [numBizId, cleanName]
  );
  if (existing.length > 0) {
    const err = new Error(`Tag with name "${cleanName}" already exists`);
    err.statusCode = 409;
    throw err;
  }

  const result = await executeQuery(
    `INSERT INTO tags (business_id, name, color) VALUES (?, ?, ?)`,
    [numBizId, cleanName, cleanColor]
  );

  return {
    id: result.insertId,
    business_id: numBizId,
    name: cleanName,
    color: cleanColor,
    contact_count: 0
  };
}

export async function updateTag(businessId, tagId, { name, color }) {
  const numBizId = Number(businessId);
  const numTagId = Number(tagId);
  const cleanName = (name || '').trim();

  if (!cleanName) {
    const err = new Error('Tag name is required');
    err.statusCode = 400;
    throw err;
  }

  const cleanColor = (color || '#7c3aed').trim();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const tag = (store.tags || []).find(t => t.id === numTagId && t.business_id === numBizId);
    if (!tag) {
      const err = new Error('Tag not found');
      err.statusCode = 404;
      throw err;
    }
    tag.name = cleanName;
    tag.color = cleanColor;
    return tag;
  }

  // Check duplicate name on other tags
  const existing = await executeQuery(
    `SELECT id FROM tags WHERE business_id = ? AND name = ? AND id != ? LIMIT 1`,
    [numBizId, cleanName, numTagId]
  );
  if (existing.length > 0) {
    const err = new Error(`Another tag with name "${cleanName}" already exists`);
    err.statusCode = 409;
    throw err;
  }

  await executeQuery(
    `UPDATE tags SET name = ?, color = ? WHERE id = ? AND business_id = ?`,
    [cleanName, cleanColor, numTagId, numBizId]
  );

  return {
    id: numTagId,
    business_id: numBizId,
    name: cleanName,
    color: cleanColor
  };
}

export async function deleteTag(businessId, tagId) {
  const numBizId = Number(businessId);
  const numTagId = Number(tagId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    store.tags = (store.tags || []).filter(t => !(t.id === numTagId && t.business_id === numBizId));
    store.contact_tags = (store.contact_tags || []).filter(ct => ct.tag_id !== numTagId);
    return { success: true };
  }

  await executeQuery(
    `DELETE FROM tags WHERE id = ? AND business_id = ?`,
    [numTagId, numBizId]
  );

  return { success: true };
}

export async function addContactsToTag(businessId, tagId, contactIds = []) {
  const numBizId = Number(businessId);
  const numTagId = Number(tagId);

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return { added: 0 };
  }

  const validContactIds = contactIds.map(Number).filter(id => id > 0);
  if (validContactIds.length === 0) return { added: 0 };

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.contact_tags) store.contact_tags = [];
    let count = 0;
    validContactIds.forEach(cId => {
      const exists = store.contact_tags.some(ct => ct.tag_id === numTagId && ct.contact_id === cId);
      if (!exists) {
        store.contact_tags.push({
          id: Date.now() + Math.random(),
          business_id: numBizId,
          tag_id: numTagId,
          contact_id: cId,
          created_at: new Date()
        });
        count++;
      }
    });
    return { added: count };
  }

  const values = validContactIds.map(cId => `(${numBizId}, ${cId}, ${numTagId})`).join(',');
  await executeQuery(
    `INSERT IGNORE INTO contact_tags (business_id, contact_id, tag_id) VALUES ${values}`
  );

  return { added: validContactIds.length };
}

export async function removeContactFromTag(businessId, tagId, contactId) {
  const numBizId = Number(businessId);
  const numTagId = Number(tagId);
  const numContactId = Number(contactId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    store.contact_tags = (store.contact_tags || []).filter(
      ct => !(ct.tag_id === numTagId && ct.contact_id === numContactId)
    );
    return { success: true };
  }

  await executeQuery(
    `DELETE FROM contact_tags WHERE tag_id = ? AND contact_id = ? AND business_id = ?`,
    [numTagId, numContactId, numBizId]
  );

  return { success: true };
}

export default {
  listTags,
  getTagStats,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  addContactsToTag,
  removeContactFromTag
};
