import * as contactsService from './contacts.service.js';

export async function list(req, res, next) {
  try {
    const result = await contactsService.listContacts(req.businessId, req.query, req.user);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function details(req, res, next) {
  try {
    const result = await contactsService.getContactDetails(req.businessId, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const result = await contactsService.updateContact(req.businessId, req.params.id, req.body, req.user);
    res.json({ success: true, message: 'Contact updated successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const result = await contactsService.createContact(req.businessId, req.body, req.user);
    res.status(201).json({ success: true, message: 'Contact created successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateConsent(req, res, next) {
  try {
    const result = await contactsService.updateConsent(req.businessId, req.params.id, req.body, req.user);
    res.json({ success: true, message: 'Consent updated successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    if (req.user?.role === 'marketer' || req.user?.role === 'agent') {
      return res.status(403).json({ success: false, message: 'Forbidden: only Owner and SuperAdmin can delete contacts' });
    }
    await contactsService.deleteContact(req.businessId, req.params.id);
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function tags(req, res, next) {
  try {
    const result = await contactsService.listTags(req.businessId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function resolveByPhones(req, res, next) {
  try {
    const { phones } = req.body;
    const result = await contactsService.resolveContactsByPhones(req.businessId, phones);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function exportContactsFile(req, res, next) {
  try {
    const { format = 'csv', groupId, tagId, status } = req.query;
    const { buffer, contentType, filename, count } = await contactsService.exportContacts(
      req.businessId,
      { format, groupId, tagId, status },
      req.user
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Count', count);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function exportCount(req, res, next) {
  try {
    const { groupId, tagId, status } = req.query;
    const count = await contactsService.getExportCount(
      req.businessId,
      { groupId, tagId, status },
      req.user
    );
    res.json({ success: true, count });
  } catch (error) {
    next(error);
  }
}

export default {
  list,
  details,
  update,
  create,
  updateConsent,
  remove,
  tags,
  resolveByPhones,
  exportContactsFile,
  exportCount
};
