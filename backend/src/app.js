import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import authRouter from './modules/auth/auth.routes.js';
import contactsRouter from './modules/contacts/contacts.routes.js';
import contactGroupsRouter from './modules/contact_groups/contactGroups.routes.js';
import tagsRouter from './modules/tags/tags.routes.js';
import importsRouter from './modules/imports/imports.routes.js';
import whatsappRouter from './modules/whatsapp/whatsapp.routes.js';
import webhooksRouter from './modules/webhooks/webhooks.routes.js';
import campaignsRouter from './modules/campaigns/campaigns.routes.js';
import billingRouter from './modules/billing/billing.routes.js';
import analyticsRouter from './modules/analytics/analytics.routes.js';
import usersRouter from './modules/users/users.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
import aiRouter from './modules/ai/ai.routes.js';
import metaRouter from './modules/whatsapp/metaSetup.routes.js';
import logsRouter from './modules/logs/logs.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';
import interactiveButtonsRouter from './modules/interactive_buttons/interactiveButtons.routes.js';
import automationsRouter from './modules/automations/automations.routes.js';
import productsRouter from './modules/products/products.routes.js';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { isUsingFallback } from './database/db.js';

dotenv.config();

// Allowed CORS origins helper
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'https://whatsapp.bhaktisong.fun',
  'https://aiveexa.com',
  'https://www.aiveexa.com',
  'http://aiveexa.com',
  'http://www.aiveexa.com',
  'https://whatsappdrt.cloud',
  'https://www.whatsappdrt.cloud',
  'http://whatsappdrt.cloud',
  'http://www.whatsappdrt.cloud',
  'https://dxxs3.com',
  'https://www.dxxs3.com',
  'http://dxxs3.com',
  'http://www.dxxs3.com'
].filter(Boolean);

export const isCorsOriginAllowed = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.replace(/\/+$/, '');
  if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) return true;
  if (process.env.ADDITIONAL_CORS_ORIGINS) {
    const extras = process.env.ADDITIONAL_CORS_ORIGINS.split(',').map(s => s.trim().replace(/\/+$/, ''));
    if (extras.includes(cleanOrigin)) return true;
  }
  return false;
};

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isCorsOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-hub-signature-256']
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Capture raw body for Meta webhook signature verification & support large CSV/Excel uploads (up to 100MB)
app.use(express.json({
  limit: '100mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve static uploaded media files
const uploadsDirs = [
  path.resolve(process.cwd(), 'uploads'),
  path.resolve(process.cwd(), 'backend', 'uploads'),
  path.resolve('/var/www/campaignflow/uploads'),
  path.resolve('/var/www/campaignflow/backend/uploads')
];

uploadsDirs.forEach(dir => {
  try {
    if (fs.existsSync(dir)) {
      app.use('/uploads', express.static(dir));
      app.use('/api/uploads', express.static(dir));
    }
  } catch (_) { }
});
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/api/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CampaignFlow API',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    databaseMode: isUsingFallback() ? 'development_mock_adapter' : 'mysql_connected'
  });
});

// Mount Modules
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/contact-groups', contactGroupsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/meta', metaRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);
app.use('/api/activity-logs', logsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/interactive-buttons', interactiveButtonsRouter);
app.use('/api/whatsapp/interactive-buttons', interactiveButtonsRouter);
app.use('/api/automations', automationsRouter);
app.use('/api/products', productsRouter);

// 404 & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
