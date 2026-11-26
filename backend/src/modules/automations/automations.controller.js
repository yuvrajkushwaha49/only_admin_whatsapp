import * as automationsService from './automations.service.js';
import { PREDEFINED_TEMPLATES } from './automations.templates.js';
import { validateAutomationDefinition } from './automations.validator.js';

export async function listAutomations(req, res, next) {
  try {
    const result = await automationsService.getAutomations(req.businessId, req.query);
    res.json({ success: true, data: result.automations, pagination: result.pagination, stats: result.stats });
  } catch (err) {
    next(err);
  }
}

export async function getTemplates(req, res, next) {
  try {
    res.json({
      success: true,
      data: Object.values(PREDEFINED_TEMPLATES).map(t => ({
        id: t.id,
        name: t.name,
        badge: t.badge,
        description: t.description,
        icon: t.icon
      }))
    });
  } catch (err) {
    next(err);
  }
}

export async function getAutomation(req, res, next) {
  try {
    const result = await automationsService.getAutomationById(req.businessId, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createAutomation(req, res, next) {
  try {
    const result = await automationsService.createAutomation(req.businessId, req.user?.id, req.body);
    res.status(201).json({ success: true, message: 'Automation created successfully', data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateAutomation(req, res, next) {
  try {
    const result = await automationsService.updateAutomation(req.businessId, req.params.id, req.body);
    res.json({ success: true, message: 'Automation updated successfully', data: result });
  } catch (err) {
    next(err);
  }
}

export async function deleteAutomation(req, res, next) {
  try {
    const result = await automationsService.deleteAutomation(req.businessId, req.params.id);
    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
}

export async function duplicateAutomation(req, res, next) {
  try {
    const result = await automationsService.duplicateAutomation(req.businessId, req.params.id, req.user?.id);
    res.status(201).json({ success: true, message: 'Automation duplicated as draft', data: result });
  } catch (err) {
    next(err);
  }
}

export async function publishAutomation(req, res, next) {
  try {
    const result = await automationsService.publishAutomation(req.businessId, req.params.id, req.user?.id);
    res.json({ success: true, message: result.message, data: result.automation });
  } catch (err) {
    next(err);
  }
}

export async function pauseAutomation(req, res, next) {
  try {
    const result = await automationsService.pauseAutomation(req.businessId, req.params.id);
    res.json({ success: true, message: `Automation is now ${result.status}`, data: result.automation });
  } catch (err) {
    next(err);
  }
}

export async function getResults(req, res, next) {
  try {
    const result = await automationsService.getAutomationResults(req.businessId, req.params.id, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function validateDefinition(req, res, next) {
  try {
    const definition = req.body?.definition || req.body;
    const result = validateAutomationDefinition(definition);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
