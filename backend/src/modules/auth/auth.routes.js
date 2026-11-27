import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  verifyOtpSchema, 
  resetPasswordWithOtpSchema 
} from './auth.schema.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.get('/setup-status', authController.setupStatus);
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.patch('/workspace', authenticate, requireTenant, requireRole(['owner', 'admin']), authController.updateWorkspace);
router.post('/verify-password', authenticate, authController.verifyPassword);

// Password Reset via Email OTP
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/reset-password', validate(resetPasswordWithOtpSchema), authController.resetPassword);

export default router;
