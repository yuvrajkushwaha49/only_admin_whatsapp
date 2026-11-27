/**
 * Multi-Tenant and RBAC Authorization Middleware
 * Configured for Single-Company / Single-Owner + Team mode by default.
 */

export const SINGLE_COMPANY_MODE = process.env.SINGLE_COMPANY_MODE !== 'false';
export const DEFAULT_BUSINESS_ID = parseInt(process.env.DEFAULT_BUSINESS_ID || '1', 10);

export function requireTenant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required.', code: 'UNAUTHORIZED' }
    });
  }

  // Single-Company Mode: lock all authenticated users to the single company workspace
  if (SINGLE_COMPANY_MODE) {
    req.businessId = req.user.business_id ? Number(req.user.business_id) : DEFAULT_BUSINESS_ID;
    return next();
  }

  // Multi-Tenant Mode: only superadmin may override tenant via x-tenant-id header
  const targetBusinessHeader = req.headers['x-tenant-id'];
  if (targetBusinessHeader && req.user.role === 'superadmin') {
    req.businessId = Number(targetBusinessHeader);
    return next();
  }

  if (req.user.role === 'superadmin' && !req.businessId) {
    req.businessId = DEFAULT_BUSINESS_ID;
    return next();
  }

  if (!req.businessId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Valid business workspace context is required.', code: 'TENANT_REQUIRED' }
    });
  }

  next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied. Super Administrator privileges required.', code: 'FORBIDDEN_SUPERADMIN' }
    });
  }
  next();
}

/**
 * Allow either SuperAdmin or the Single-Company Owner (when SINGLE_COMPANY_MODE is active)
 */
export function requirePlatformOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required.', code: 'UNAUTHORIZED' }
    });
  }
  if (req.user.role === 'superadmin' || (SINGLE_COMPANY_MODE && req.user.role === 'owner')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: { message: 'Access denied. Workspace Owner privileges required.', code: 'FORBIDDEN_OWNER' }
  });
}

/**
 * Role-Based Access Control matrix
 * Roles: owner, admin, marketer, agent, superadmin
 */
const ROLE_HIERARCHY = {
  superadmin: ['superadmin', 'owner', 'admin', 'marketer', 'agent'],
  owner: ['owner', 'admin', 'marketer', 'agent'],
  admin: ['admin', 'marketer', 'agent'],
  marketer: ['marketer', 'agent'],
  agent: ['agent']
};

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required.', code: 'UNAUTHORIZED' }
      });
    }

    if (req.user.role === 'superadmin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Permission denied. Your role (${req.user.role}) does not have permission to perform this action.`,
          code: 'FORBIDDEN_ROLE',
          requiredRoles: allowedRoles
        }
      });
    }

    next();
  };
}

export default {
  requireTenant,
  requireSuperAdmin,
  requireRole
};
