import * as tagsService from './tags.service.js';

export async function list(req, res, next) {
  try {
    const data = await tagsService.listTags(req.businessId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function stats(req, res, next) {
  try {
    const data = await tagsService.getTagStats(req.businessId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function details(req, res, next) {
  try {
    const { id } = req.params;
    const { search, page, limit } = req.query;
    const data = await tagsService.getTag(req.businessId, id, { search, page, limit });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = await tagsService.createTag(req.businessId, req.body);
    res.status(201).json({ success: true, message: 'Tag created successfully', data });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const data = await tagsService.updateTag(req.businessId, id, req.body);
    res.json({ success: true, message: 'Tag updated successfully', data });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await tagsService.deleteTag(req.businessId, id);
    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function addContacts(req, res, next) {
  try {
    const { id } = req.params;
    const { contactIds } = req.body;
    const data = await tagsService.addContactsToTag(req.businessId, id, contactIds);
    res.json({ success: true, message: 'Contacts assigned to tag', data });
  } catch (error) {
    next(error);
  }
}

export async function removeContact(req, res, next) {
  try {
    const { id, contactId } = req.params;
    await tagsService.removeContactFromTag(req.businessId, id, contactId);
    res.json({ success: true, message: 'Contact removed from tag' });
  } catch (error) {
    next(error);
  }
}

export default {
  list,
  stats,
  details,
  create,
  update,
  remove,
  addContacts,
  removeContact
};
