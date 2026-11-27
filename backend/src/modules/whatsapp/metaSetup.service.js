import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import { encryptToken, decryptToken } from '../../utils/crypto.js';
import { MetaCloudApiClient } from './metaClient.js';
import * as whatsappService from './whatsapp.service.js';
import * as platformMetaService from '../admin/platformMeta.service.js';
import { SINGLE_COMPANY_MODE } from '../../middleware/tenant.js';
import logger from '../../utils/logger.js';
import axios from 'axios';
import crypto from 'crypto';

const META_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Get tenant Meta Setup status, active mode, and prerequisite checklist
 */
export async function getSetupStatus(businessId) {
  const numBusinessId = Number(businessId);
  let integration = null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.tenant_meta_integrations) store.tenant_meta_integrations = [];
    integration = store.tenant_meta_integrations.find(i => i.business_id === numBusinessId);

    if (!integration) {
      integration = {
        id: store.tenant_meta_integrations.length + 1,
        business_id: numBusinessId,
        integration_mode: 'platform_managed',
        setup_step: 1,
        configuration_status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };
      store.tenant_meta_integrations.push(integration);
      saveMemoryStore();
    }
  } else {
    const rows = await executeQuery(
      'SELECT * FROM tenant_meta_integrations WHERE business_id = ? LIMIT 1',
      [numBusinessId]
    );

    if (rows.length > 0) {
      integration = rows[0];
    } else {
      await executeQuery(
        `INSERT INTO tenant_meta_integrations 
         (business_id, integration_mode, setup_step, configuration_status, created_at, updated_at) 
         VALUES (?, 'platform_managed', 1, 'pending', NOW(), NOW())`,
        [numBusinessId]
      );
      const newRows = await executeQuery(
        'SELECT * FROM tenant_meta_integrations WHERE business_id = ? LIMIT 1',
        [numBusinessId]
      );
      integration = newRows[0];
    }
  }

  // Fetch connected accounts for this tenant
  const accounts = await whatsappService.listAccounts(numBusinessId);
  const primaryAccount = accounts.find(a => a.is_primary) || accounts[0] || null;

  const prerequisites = [
    {
      id: 'facebook_account',
      title: 'Active Facebook Account',
      description: 'Personal Facebook login with admin or business control permissions.',
      whyRequired: 'Meta requires authentication to verify your identity and associate business assets.',
      howToCheck: 'Log into facebook.com and ensure your account has full administrative access to your Business Portfolio.',
      docsUrl: 'https://www.facebook.com/business/help/118320698319587'
    },
    {
      id: 'meta_business_portfolio',
      title: 'Meta Business Portfolio (Business Manager)',
      description: 'The commercial organizational account holding your assets and WhatsApp channels.',
      whyRequired: 'Official WhatsApp Business Accounts must be governed by an active Meta Business Portfolio.',
      howToCheck: 'Navigate to business.facebook.com and verify your portfolio name and Business ID.',
      docsUrl: 'https://business.facebook.com/'
    },
    {
      id: 'waba',
      title: 'WhatsApp Business Account (WABA)',
      description: 'The dedicated container for phone numbers, messaging tier limits, and templates.',
      whyRequired: 'Official Cloud API broadcasting requires an active WABA under your portfolio.',
      howToCheck: 'In Meta Business Manager, open Accounts > WhatsApp Accounts to view your WABAs.',
      docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started'
    },
    {
      id: 'phone_number',
      title: 'Dedicated WhatsApp Phone Number',
      description: 'A valid commercial or mobile number able to receive SMS or voice OTP codes.',
      whyRequired: 'The number must NOT be currently active on consumer WhatsApp or WhatsApp Business mobile apps.',
      howToCheck: 'Delete any existing mobile WhatsApp account associated with the number before connecting.',
      docsUrl: 'https://developers.facebook.com/docs/whatsapp/phone-numbers'
    }
  ];

  let platformConfig = null;
  try {
    platformConfig = await platformMetaService.getPlatformMetaConfig();
  } catch (_) {}

  const platformAppId = platformConfig?.metaAppId || process.env.META_APP_ID || '1504824461464867';
  const platformConfigId = platformConfig?.embeddedSignupConfigId || process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '1162753462966713';
  const platformApiVersion = platformConfig?.graphApiVersion || META_API_VERSION;

  const isClientWithCredentials = integration.integration_mode === 'client_owned' &&
    Boolean(integration.meta_app_id && integration.meta_app_id !== '1165054629187576' && integration.encrypted_meta_app_secret);

  const effectiveMode = isClientWithCredentials ? 'client_owned' : 'platform_managed';

  return {
    integrationMode: effectiveMode,
    setupStep: integration.setup_step || 1,
    configurationStatus: integration.configuration_status || 'pending',
    hasConnectedAccount: accounts.length > 0,
    accountsCount: accounts.length,
    primaryAccount,
    platformApp: {
      appId: platformAppId,
      version: platformApiVersion,
      hasConfigId: Boolean(platformConfigId && platformConfigId !== 'your_embedded_signup_config_id'),
      configId: platformConfigId
    },
    clientApp: {
      appId: integration.meta_app_id && integration.meta_app_id !== '1165054629187576' ? integration.meta_app_id : null,
      hasSecret: Boolean(integration.encrypted_meta_app_secret),
      configId: integration.embedded_signup_config_id || null
    },
    prerequisites
  };
}

/**
 * Save tenant's selected integration mode (Mode A: platform_managed, Mode B: client_owned)
 */
export async function saveSetupMode(businessId, mode, step = 2) {
  const numBusinessId = Number(businessId);
  if (!['platform_managed', 'client_owned'].includes(mode)) {
    const err = new Error('Invalid integration mode. Must be "platform_managed" or "client_owned".');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.tenant_meta_integrations) store.tenant_meta_integrations = [];
    let item = store.tenant_meta_integrations.find(i => i.business_id === numBusinessId);

    if (item) {
      item.integration_mode = mode;
      item.setup_step = step;
      item.updated_at = now;
    } else {
      item = {
        id: store.tenant_meta_integrations.length + 1,
        business_id: numBusinessId,
        integration_mode: mode,
        setup_step: step,
        configuration_status: 'pending',
        created_at: now,
        updated_at: now
      };
      store.tenant_meta_integrations.push(item);
    }
    saveMemoryStore();
    return { success: true, mode, step };
  }

  await executeQuery(
    `INSERT INTO tenant_meta_integrations 
      (business_id, integration_mode, setup_step, updated_at) 
     VALUES (?, ?, ?, NOW()) 
     ON DUPLICATE KEY UPDATE 
      integration_mode = VALUES(integration_mode), 
      setup_step = VALUES(setup_step), 
      updated_at = NOW()`,
    [numBusinessId, mode, step]
  );

  return { success: true, mode, step };
}

/**
 * Save and encrypt client-owned advanced Meta App credentials
 */
export async function saveAdvancedConfig(businessId, { appId, appSecret, configId }) {
  const numBusinessId = Number(businessId);

  if (!appId || !/^\d{10,24}$/.test(String(appId).trim())) {
    const err = new Error('A valid numeric Meta App ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const cleanAppId = String(appId).trim();
  const cleanConfigId = configId ? String(configId).trim() : null;
  const encryptedSecret = appSecret ? encryptToken(String(appSecret).trim()) : null;
  const now = new Date();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.tenant_meta_integrations) store.tenant_meta_integrations = [];
    let item = store.tenant_meta_integrations.find(i => i.business_id === numBusinessId);

    if (item) {
      item.integration_mode = 'client_owned';
      item.meta_app_id = cleanAppId;
      if (encryptedSecret) item.encrypted_meta_app_secret = encryptedSecret;
      if (cleanConfigId) item.embedded_signup_config_id = cleanConfigId;
      item.configuration_status = 'configured';
      item.last_validation_at = now;
      item.updated_at = now;
    } else {
      item = {
        id: store.tenant_meta_integrations.length + 1,
        business_id: numBusinessId,
        integration_mode: 'client_owned',
        meta_app_id: cleanAppId,
        encrypted_meta_app_secret: encryptedSecret,
        embedded_signup_config_id: cleanConfigId,
        configuration_status: 'configured',
        setup_step: 5,
        last_validation_at: now,
        created_at: now,
        updated_at: now
      };
      store.tenant_meta_integrations.push(item);
    }
    saveMemoryStore();
  } else {
    await executeQuery(
      `INSERT INTO tenant_meta_integrations 
        (business_id, integration_mode, meta_app_id, encrypted_meta_app_secret, embedded_signup_config_id, configuration_status, last_validation_at, updated_at) 
       VALUES (?, 'client_owned', ?, ?, ?, 'configured', NOW(), NOW()) 
       ON DUPLICATE KEY UPDATE 
        integration_mode = 'client_owned', 
        meta_app_id = VALUES(meta_app_id), 
        encrypted_meta_app_secret = COALESCE(VALUES(encrypted_meta_app_secret), encrypted_meta_app_secret), 
        embedded_signup_config_id = VALUES(embedded_signup_config_id), 
        configuration_status = 'configured', 
        last_validation_at = NOW(), 
        updated_at = NOW()`,
      [numBusinessId, cleanAppId, encryptedSecret, cleanConfigId]
    );
  }

  return {
    success: true,
    message: 'Client-owned Meta App credentials stored and encrypted at rest.',
    appId: cleanAppId,
    hasSecret: Boolean(encryptedSecret)
  };
}

/**
 * Validate integration configuration against Meta API
 */
export async function validateSetup(businessId) {
  const status = await getSetupStatus(businessId);
  const isClientOwned = status.integrationMode === 'client_owned';

  if (!isClientOwned) {
    // Validate platform managed app
    const platformConfig = await platformMetaService.getPlatformMetaConfig();
    const platformAppId = platformConfig?.metaAppId || process.env.META_APP_ID || '1504824461464867';
    return {
      success: true,
      mode: 'platform_managed',
      isValid: Boolean(platformAppId && platformAppId !== 'your_meta_app_id'),
      appId: platformAppId,
      message: 'Platform Meta App verified and ready for client Embedded Signup.'
    };
  }

  // Validate client owned app
  let clientApp = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    clientApp = (store.tenant_meta_integrations || []).find(i => i.business_id === Number(businessId));
  } else {
    const rows = await executeQuery('SELECT * FROM tenant_meta_integrations WHERE business_id = ? LIMIT 1', [businessId]);
    clientApp = rows[0] || null;
  }

  if (!clientApp || !clientApp.meta_app_id) {
    const err = new Error('No client Meta App ID configured.');
    err.statusCode = 400;
    throw err;
  }

  const rawSecret = clientApp.encrypted_meta_app_secret ? decryptToken(clientApp.encrypted_meta_app_secret) : null;
  if (!rawSecret) {
    const err = new Error('Client Meta App Secret is missing. Please provide your App Secret.');
    err.statusCode = 400;
    throw err;
  }

  try {
    const response = await axios.get(`${META_BASE_URL}/${clientApp.meta_app_id}`, {
      params: {
        access_token: `${clientApp.meta_app_id}|${rawSecret}`,
        fields: 'id,name,link'
      }
    });

    return {
      success: true,
      mode: 'client_owned',
      isValid: true,
      appId: clientApp.meta_app_id,
      appName: response.data?.name || 'Verified Client App',
      message: 'Client Meta Developer App successfully verified with Meta Graph API.'
    };
  } catch (error) {
    logger.warn(`[MetaSetup] Client app validation failed: ${error.message}`);
    return {
      success: false,
      mode: 'client_owned',
      isValid: false,
      appId: clientApp.meta_app_id,
      message: error.response?.data?.error?.message || 'Meta App ID or Secret validation failed against Meta API.'
    };
  }
}

/**
 * Check Platform Readiness for Client Onboarding
 */
export async function checkClientReadiness(businessId) {
  const platformReadiness = await platformMetaService.checkClientPlatformReadiness();
  const numBusinessId = Number(businessId);

  let allowedList = [];
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const biz = (store.businesses || []).find(b => b.id === numBusinessId);
    if (biz?.allowed_phone_numbers) {
      try { allowedList = JSON.parse(biz.allowed_phone_numbers); } catch (_) { allowedList = String(biz.allowed_phone_numbers).split(',').map(s => s.trim()).filter(Boolean); }
    }
  } else {
    try {
      const bizRows = await executeQuery('SELECT allowed_phone_numbers FROM businesses WHERE id = ?', [numBusinessId]);
      const rawAllowed = bizRows?.[0]?.allowed_phone_numbers;
      if (rawAllowed) {
        try { allowedList = typeof rawAllowed === 'string' ? JSON.parse(rawAllowed) : rawAllowed; } catch (_) { allowedList = String(rawAllowed).split(',').map(s => s.trim()).filter(Boolean); }
      }
    } catch (_) {}
  }

  const hasAllocatedNumbers = SINGLE_COMPANY_MODE ? true : (Array.isArray(allowedList) && allowedList.length > 0);
  const appId = platformReadiness.appId || platformReadiness.metaAppId || platformReadiness.platformApp?.appId;
  const configId = platformReadiness.configId || platformReadiness.embeddedSignupConfigId || platformReadiness.platformApp?.configId;

  return {
    ...platformReadiness,
    appId,
    metaAppId: appId,
    platformAppId: appId,
    configId,
    embeddedSignupConfigId: configId,
    hasAllocatedNumbers,
    allowedPhoneNumbers: allowedList,
    allocationWarning: !hasAllocatedNumbers
      ? 'No WhatsApp numbers have been allocated to this business by the Super Admin in the Number Allocation & Approval Matrix. Please allocate an approved phone number first before connecting.'
      : null
  };
}

/**
 * Record Onboarding Session for CSRF & State Verification
 */
export async function recordOnboardingSession(businessId, state, redirectOrigin, expiresAt) {
  const numBusinessId = Number(businessId);
  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.meta_onboarding_sessions) store.meta_onboarding_sessions = [];
    store.meta_onboarding_sessions.push({
      id: store.meta_onboarding_sessions.length + 1,
      tenant_id: numBusinessId,
      state_hash: state,
      session_status: 'initiated',
      redirect_origin: redirectOrigin,
      created_at: new Date(),
      expires_at: expiresAt
    });
    saveMemoryStore();
  } else {
    try {
      await executeQuery(
        `INSERT INTO meta_onboarding_sessions 
         (tenant_id, state_hash, session_status, redirect_origin, expires_at, created_at)
         VALUES (?, ?, 'initiated', ?, ?, NOW())`,
        [numBusinessId, state, redirectOrigin || null, expiresAt]
      );
    } catch (e) {
      logger.warn('[MetaSetup] Session record notice:', e.message);
    }
  }
}

/**
 * Get Onboarding Session Details
 */
export async function getOnboardingSession(businessId, state) {
  if (!state) return null;
  const numBusinessId = Number(businessId);
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.meta_onboarding_sessions?.find(
      s => s.state_hash === state && s.tenant_id === numBusinessId && s.session_status === 'initiated'
    ) || null;
  } else {
    try {
      const rows = await executeQuery(
        `SELECT id, redirect_origin, expires_at FROM meta_onboarding_sessions 
         WHERE state_hash = ? AND tenant_id = ? AND session_status = 'initiated' LIMIT 1`,
        [state, numBusinessId]
      );
      return rows?.[0] || null;
    } catch (_) {
      return null;
    }
  }
}

/**
 * Validate Onboarding Session CSRF State
 */
export async function validateOnboardingSession(businessId, state) {
  const numBusinessId = Number(businessId);
  if (!state) return true;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const session = store.meta_onboarding_sessions?.find(
      s => s.state_hash === state && s.tenant_id === numBusinessId && s.session_status === 'initiated'
    );
    if (!session || new Date(session.expires_at) <= new Date()) {
      const err = new Error('Invalid or expired Meta onboarding session');
      err.statusCode = 400;
      throw err;
    }
    session.session_status = 'completed';
    session.completed_at = new Date();
    saveMemoryStore();
    return true;
  } else {
    const rows = await executeQuery(
      `SELECT id, expires_at FROM meta_onboarding_sessions 
       WHERE state_hash = ? AND tenant_id = ? AND session_status = 'initiated' LIMIT 1`,
      [state, numBusinessId]
    );
    if (!rows || rows.length === 0 || new Date(rows[0].expires_at) <= new Date()) {
      const err = new Error('Invalid or expired Meta onboarding session');
      err.statusCode = 400;
      throw err;
    }
    await executeQuery(
      `UPDATE meta_onboarding_sessions 
       SET session_status = 'completed', completed_at = NOW() 
       WHERE id = ?`,
      [rows[0].id]
    );
    return true;
  }
}

/**
 * Generate official Facebook OAuth URL / initiation parameters
 */
export async function initiateSignup(businessId, redirectOrigin = '') {
  const numBusinessId = Number(businessId);

  // Security gate: Ensure this business has at least one allocated number in multi-tenant mode
  const readiness = await checkClientReadiness(numBusinessId);
  if (!SINGLE_COMPANY_MODE && !readiness.hasAllocatedNumbers) {
    const err = new Error('No WhatsApp numbers have been allocated to your business by the Super Admin in the Number Allocation & Approval Matrix. Please allocate an approved phone number first before connecting.');
    err.statusCode = 403;
    throw err;
  }

  const platformConfig = await platformMetaService.getPlatformMetaConfig();
  const status = await getSetupStatus(numBusinessId);

  // Client-owned credentials apply ONLY IF client explicitly saved their own custom app + secret
  // AND platform is not forcing server env fallback
  const isCustomClientApp = status.integrationMode === 'client_owned' &&
    Boolean(status.clientApp?.appId && status.clientApp?.hasSecret && status.clientApp.appId !== '1165054629187576') &&
    !platformConfig?.useEnvFallback;

  const appId = isCustomClientApp && status.clientApp?.appId
    ? status.clientApp.appId
    : (platformConfig?.metaAppId || process.env.META_APP_ID || '1504824461464867');

  const configId = isCustomClientApp && status.clientApp?.configId
    ? status.clientApp.configId
    : (platformConfig?.embeddedSignupConfigId || process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '1162753462966713');

  const apiVersion = platformConfig?.graphApiVersion || META_API_VERSION;
  const redirectUri = `${redirectOrigin || process.env.FRONTEND_URL || 'http://localhost:5173'}/whatsapp/callback`;
  const scopes = 'whatsapp_business_management,whatsapp_business_messaging';

  const stateToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await recordOnboardingSession(numBusinessId, stateToken, redirectOrigin, expiresAt);

  const effectiveConfigId = configId || '';
  let oauthUrl = `https://www.facebook.com/${apiVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${stateToken}`;
  if (effectiveConfigId && effectiveConfigId !== 'your_embedded_signup_config_id') {
    oauthUrl += `&config_id=${encodeURIComponent(effectiveConfigId)}`;
  }

  const metaHostedUrl = effectiveConfigId
    ? `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${appId}&config_id=${encodeURIComponent(effectiveConfigId)}&extras=%7B%22sessionInfoVersion%22%3A%223%22%7D`
    : oauthUrl;

  return {
    success: true,
    mode: isCustomClientApp ? 'client_owned' : 'platform_managed',
    appId,
    configId: effectiveConfigId,
    hasConfigId: Boolean(effectiveConfigId && effectiveConfigId !== 'your_embedded_signup_config_id'),
    redirectUri,
    scopes,
    state: stateToken,
    oauthUrl,
    metaHostedUrl
  };
}
