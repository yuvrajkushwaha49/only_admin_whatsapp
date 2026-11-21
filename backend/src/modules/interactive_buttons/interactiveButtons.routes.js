import express from 'express';
import { requireTenant, requireRole } from '../../middleware/tenant.js';
import * as controller from './interactiveButtons.controller.js';

const router = express.Router();

// Strict Access Control: Super Admin (handled implicitly in requireRole), Owner, and Admin only
router.use(requireTenant);
router.use(requireRole(['owner', 'admin']));

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
