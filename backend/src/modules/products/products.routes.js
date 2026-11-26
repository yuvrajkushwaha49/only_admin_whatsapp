import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';
import * as controller from './products.controller.js';

const router = express.Router();

// Enforce authentication & tenant isolation
router.use(authenticate, requireTenant);

// Categories
router.get('/categories', requireRole(['owner', 'admin', 'marketer', 'agent']), controller.listCategories);
router.post('/categories', requireRole(['owner', 'admin', 'marketer']), controller.createCategory);

// Products CRUD
router.get('/', requireRole(['owner', 'admin', 'marketer', 'agent']), controller.listProducts);
router.post('/', requireRole(['owner', 'admin', 'marketer']), controller.createProduct);
router.get('/:id', requireRole(['owner', 'admin', 'marketer', 'agent']), controller.getProduct);
router.put('/:id', requireRole(['owner', 'admin', 'marketer']), controller.updateProduct);
router.delete('/:id', requireRole(['owner', 'admin']), controller.deleteProduct);

export default router;
