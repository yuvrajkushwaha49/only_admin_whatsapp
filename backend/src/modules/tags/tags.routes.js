import { Router } from 'express';
import * as tagsController from './tags.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/', tagsController.list);
router.get('/stats', tagsController.stats);
router.post('/', requireRole(['owner', 'admin', 'marketer']), tagsController.create);
router.get('/:id', tagsController.details);
router.put('/:id', requireRole(['owner', 'admin', 'marketer']), tagsController.update);
router.delete('/:id', requireRole(['owner', 'admin']), tagsController.remove);

// Tag contacts actions
router.post('/:id/contacts', requireRole(['owner', 'admin', 'marketer']), tagsController.addContacts);
router.delete('/:id/contacts/:contactId', requireRole(['owner', 'admin', 'marketer']), tagsController.removeContact);

export default router;
