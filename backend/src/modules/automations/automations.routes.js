import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';
import * as controller from './automations.controller.js';

const router = express.Router();

// Strict Tenant Isolation & Role-Based Access Control
router.use(authenticate, requireTenant);

// Template catalog & validator
router.get('/templates', controller.getTemplates);
router.post('/validate', controller.validateDefinition);

// Automation CRUD & Lifecycle actions
router.get('/', requireRole(['owner', 'admin', 'marketer', 'agent']), controller.listAutomations);
router.post('/', requireRole(['owner', 'admin', 'marketer']), controller.createAutomation);
router.get('/:id', requireRole(['owner', 'admin', 'marketer', 'agent']), controller.getAutomation);
router.put('/:id', requireRole(['owner', 'admin', 'marketer']), controller.updateAutomation);
router.delete('/:id', requireRole(['owner', 'admin']), controller.deleteAutomation);

router.post('/:id/duplicate', requireRole(['owner', 'admin', 'marketer']), controller.duplicateAutomation);
router.post('/:id/publish', requireRole(['owner', 'admin', 'marketer']), controller.publishAutomation);
router.post('/:id/pause', requireRole(['owner', 'admin', 'marketer']), controller.pauseAutomation);
router.get('/:id/results', requireRole(['owner', 'admin', 'marketer', 'agent']), controller.getResults);

export default router;
