import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';
import { sendPasswordResetOtpEmail } from '../../services/emailService.js';
import { SINGLE_COMPANY_MODE, DEFAULT_BUSINESS_ID } from '../../middleware/tenant.js';

export async function getSetupStatus() {
  let hasOwner = false;
  let businessName = null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const owners = (store.users || []).filter(u => u.role === 'owner');
    hasOwner = owners.length > 0;
    const primaryBiz = (store.businesses || []).find(b => Number(b.id) === DEFAULT_BUSINESS_ID) || store.businesses?.[0];
    businessName = primaryBiz?.name || null;
  } else {
    const ownerRows = await executeQuery("SELECT id FROM users WHERE role = 'owner' LIMIT 1");
    hasOwner = ownerRows.length > 0;
    const bizRows = await executeQuery('SELECT name FROM businesses ORDER BY id ASC LIMIT 1');
    businessName = bizRows?.[0]?.name || null;
  }

  return {
    singleCompanyMode: SINGLE_COMPANY_MODE,
    registrationOpen: SINGLE_COMPANY_MODE ? !hasOwner : true,
    businessName
  };
}

export async function register({ businessName, name, email, password, timezone = 'UTC' }) {
  // In Single-Company Mode, block public registration once an owner/workspace exists
  if (SINGLE_COMPANY_MODE) {
    const status = await getSetupStatus();
    if (!status.registrationOpen) {
      const error = new Error('Public registration is disabled. This workspace is configured for a single business owner. Please ask the owner to invite you as a team member.');
      error.statusCode = 403;
      error.code = 'REGISTRATION_DISABLED';
      throw error;
    }
  }

  // Check if email already exists
  const existing = await executeQuery('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) {
    const error = new Error('A user with this email address already exists');
    error.statusCode = 409;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  const passwordHash = await bcrypt.hash(password, 10);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const businessId = store.businesses.length + 1;
    const business = { id: businessId, name: businessName, slug, timezone, status: 'active', created_at: new Date() };
    store.businesses.push(business);

    const userId = store.users.length + 1;
    const user = { id: userId, business_id: businessId, name, email, password_hash: passwordHash, role: 'owner', is_email_verified: 1, status: 'active', created_at: new Date() };
    store.users.push(user);

    // Free tier subscription
    store.subscriptions.push({ id: store.subscriptions.length + 1, business_id: businessId, plan_id: 1, status: 'active', current_period_start: new Date() });

    const token = signAccessToken({ userId: user.id, businessId: user.business_id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, business, token, refreshToken };
  }

  // Real MySQL execution
  const businessResult = await executeQuery(
    'INSERT INTO businesses (name, slug, timezone, status) VALUES (?, ?, ?, "active")',
    [businessName, slug, timezone]
  );
  const businessId = businessResult.insertId;

  const userResult = await executeQuery(
    'INSERT INTO users (business_id, name, email, password_hash, role, is_email_verified, status) VALUES (?, ?, ?, ?, "owner", TRUE, "active")',
    [businessId, name, email, passwordHash]
  );
  const userId = userResult.insertId;

  // Assign default workspace subscription safely (ensure plan id 1 exists on fresh DB)
  try {
    await executeQuery(
      `INSERT IGNORE INTO subscription_plans (id, name, slug, monthly_price, max_contacts, max_campaigns_per_month, max_messages_per_month, max_team_members, features)
       VALUES (1, 'Single Workspace', 'single-workspace', 0.00, 1000000, 99999, 1000000, 100, '{"analytics": "advanced", "ai_assistant": true, "api_access": true}')`
    );
    await executeQuery(
      'INSERT INTO subscriptions (business_id, plan_id, status, current_period_start) VALUES (?, 1, "active", NOW())',
      [businessId]
    );
  } catch (_) {}

  const token = signAccessToken({ userId, businessId, role: 'owner' });
  const refreshToken = signRefreshToken({ userId });

  return {
    user: { id: userId, name, email, role: 'owner' },
    business: { id: businessId, name: businessName, slug, timezone },
    token,
    refreshToken
  };
}

export async function login({ email, password }) {
  const users = await executeQuery('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  if (!users || users.length === 0) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const user = users[0];
  let isMatch = await bcrypt.compare(password, user.password_hash);

  // In development mock mode, permit common variations (Password123, password, admin)
  if (!isMatch && isUsingFallback()) {
    const pTrim = password.trim();
    const pLower = pTrim.toLowerCase();
    if (pTrim === 'Password123!' || pTrim === 'Password123' || pLower === 'password123!' || pLower === 'password123' || pLower === 'password' || pLower === 'admin') {
      isMatch = true;
    }
  }

  if (!isMatch) {
    const error = new Error('Invalid email or password. Default demo password is: Password123!');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  if (user.status === 'suspended') {
    const error = new Error('Your account is currently suspended. Please contact support.');
    error.statusCode = 403;
    error.code = 'ACCOUNT_SUSPENDED';
    throw error;
  }

  let business = null;
  if (user.business_id) {
    const businesses = await executeQuery('SELECT id, name, slug, timezone, status FROM businesses WHERE id = ? LIMIT 1', [user.business_id]);
    business = businesses[0] || null;
  }

  const token = signAccessToken({ userId: user.id, businessId: user.business_id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      business_id: user.business_id
    },
    business,
    token,
    refreshToken
  };
}

export async function getCurrentUser(userId) {
  const users = await executeQuery(
    'SELECT id, business_id, name, email, role, is_email_verified, status, created_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!users || users.length === 0) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const user = users[0];
  let business = null;
  let subscription = null;

  if (user.business_id) {
    const businesses = await executeQuery('SELECT * FROM businesses WHERE id = ? LIMIT 1', [user.business_id]);
    business = businesses[0] || null;

    const subs = await executeQuery(`
      SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.max_contacts, p.max_campaigns_per_month, p.max_messages_per_month, p.features
      FROM subscriptions s
      JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.business_id = ? LIMIT 1
    `, [user.business_id]);
    subscription = subs[0] || null;
  }

  return { user, business, subscription };
}

export async function verifyUserPassword(userId, password) {
  if (!password) {
    const error = new Error('Password is required');
    error.statusCode = 400;
    throw error;
  }

  const users = await executeQuery('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!users || users.length === 0) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const user = users[0];
  let isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch && isUsingFallback()) {
    const pTrim = password.trim();
    const pLower = pTrim.toLowerCase();
    if (pTrim === 'Password123!' || pTrim === 'Password123' || pLower === 'password123!' || pLower === 'password123' || pLower === 'password' || pLower === 'admin') {
      isMatch = true;
    }
  }

  if (!isMatch) {
    const error = new Error('Incorrect password. Please enter your valid account password.');
    error.statusCode = 401;
    error.code = 'INVALID_PASSWORD';
    throw error;
  }

  return { verified: true };
}

export async function requestPasswordResetOtp({ email }) {
  const cleanEmail = email.trim().toLowerCase();

  let user = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    user = store.users.find(u => u.email.toLowerCase() === cleanEmail);
  } else {
    const users = await executeQuery('SELECT id, name, email, business_id FROM users WHERE LOWER(email) = ? LIMIT 1', [cleanEmail]);
    user = users[0] || null;
  }

  if (!user) {
    const error = new Error('No account found with this email address.');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresInMinutes = 10;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.password_resets) store.password_resets = [];
    store.password_resets.push({
      id: store.password_resets.length + 1,
      email: cleanEmail,
      otp,
      reset_token: null,
      attempts: 0,
      is_verified: 0,
      expires_at: expiresAt,
      created_at: new Date()
    });
  } else {
    await executeQuery(
      'INSERT INTO password_resets (email, otp, attempts, is_verified, expires_at) VALUES (?, ?, 0, 0, ?)',
      [cleanEmail, otp, expiresAt]
    );
  }

  const emailRes = await sendPasswordResetOtpEmail({
    to: user.email,
    name: user.name,
    otp,
    expiresInMinutes
  });

  return {
    email: user.email,
    expiresInMinutes,
    ...(emailRes.simulated || process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {})
  };
}

export async function verifyPasswordResetOtp({ email, otp }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  let resetRecord = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.password_resets) store.password_resets = [];
    const active = store.password_resets
      .filter(r => r.email.toLowerCase() === cleanEmail && !r.is_verified && new Date(r.expires_at) > new Date())
      .sort((a, b) => b.id - a.id);
    resetRecord = active[0] || null;
  } else {
    const rows = await executeQuery(
      'SELECT * FROM password_resets WHERE LOWER(email) = ? AND is_verified = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [cleanEmail]
    );
    resetRecord = rows[0] || null;
  }

  if (!resetRecord) {
    const error = new Error('Verification code has expired or is invalid. Please request a new code.');
    error.statusCode = 400;
    error.code = 'OTP_EXPIRED';
    throw error;
  }

  if (resetRecord.attempts >= 5) {
    const error = new Error('Too many invalid attempts. Please request a new verification code.');
    error.statusCode = 429;
    error.code = 'TOO_MANY_ATTEMPTS';
    throw error;
  }

  if (resetRecord.otp !== cleanOtp) {
    if (isUsingFallback()) {
      resetRecord.attempts = (resetRecord.attempts || 0) + 1;
    } else {
      await executeQuery('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [resetRecord.id]);
    }
    const currentAttempts = (resetRecord.attempts || 0) + 1;
    const remaining = Math.max(0, 5 - currentAttempts);
    const error = new Error(`Invalid verification code. ${remaining > 0 ? remaining + ' attempts remaining.' : 'Please request a new code.'}`);
    error.statusCode = 400;
    error.code = 'INVALID_OTP';
    throw error;
  }

  const resetToken = crypto.randomUUID();

  if (isUsingFallback()) {
    resetRecord.is_verified = 1;
    resetRecord.reset_token = resetToken;
  } else {
    await executeQuery(
      'UPDATE password_resets SET is_verified = 1, reset_token = ? WHERE id = ?',
      [resetToken, resetRecord.id]
    );
  }

  return {
    verified: true,
    resetToken
  };
}

export async function resetPasswordWithToken({ email, resetToken, newPassword }) {
  const cleanEmail = email.trim().toLowerCase();

  let resetRecord = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.password_resets) store.password_resets = [];
    resetRecord = store.password_resets.find(
      r => r.email.toLowerCase() === cleanEmail && r.reset_token === resetToken && r.is_verified && new Date(r.expires_at) > new Date()
    );
  } else {
    const rows = await executeQuery(
      'SELECT * FROM password_resets WHERE LOWER(email) = ? AND reset_token = ? AND is_verified = 1 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [cleanEmail, resetToken]
    );
    resetRecord = rows[0] || null;
  }

  if (!resetRecord) {
    const error = new Error('Reset session has expired or is invalid. Please request a new verification code.');
    error.statusCode = 400;
    error.code = 'INVALID_RESET_SESSION';
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const user = store.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (user) {
      user.password_hash = passwordHash;
      user.updated_at = new Date();
    }
    resetRecord.reset_token = null;
    resetRecord.expires_at = new Date();
  } else {
    await executeQuery('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE LOWER(email) = ?', [passwordHash, cleanEmail]);
    await executeQuery('UPDATE password_resets SET expires_at = NOW(), reset_token = NULL WHERE id = ?', [resetRecord.id]);
  }

  return { success: true, message: 'Password has been reset successfully' };
}

export async function updateWorkspaceProfile(businessId, { name, timezone }) {
  const numBusinessId = Number(businessId);
  const cleanName = name ? String(name).trim() : null;
  const cleanTimezone = timezone ? String(timezone).trim() : null;

  if (!cleanName || cleanName.length < 2) {
    const error = new Error('Workspace name must be at least 2 characters.');
    error.statusCode = 400;
    throw error;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const biz = (store.businesses || []).find(b => Number(b.id) === numBusinessId);
    if (!biz) {
      const error = new Error('Workspace not found');
      error.statusCode = 404;
      throw error;
    }
    biz.name = cleanName;
    if (cleanTimezone) biz.timezone = cleanTimezone;
    biz.updated_at = new Date();
    saveMemoryStore();
    return biz;
  }

  await executeQuery(
    'UPDATE businesses SET name = ?, timezone = COALESCE(?, timezone), updated_at = NOW() WHERE id = ?',
    [cleanName, cleanTimezone, numBusinessId]
  );
  const rows = await executeQuery('SELECT id, name, slug, timezone, status FROM businesses WHERE id = ? LIMIT 1', [numBusinessId]);
  return rows[0];
}

export default {
  getSetupStatus,
  register,
  login,
  getCurrentUser,
  verifyUserPassword,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
  updateWorkspaceProfile
};
