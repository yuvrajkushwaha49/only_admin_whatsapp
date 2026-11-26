-- ========================================================================
-- Migration 014: WhatsApp Conversational Automation Module
-- Multi-Tenant, Versioned, Event-Driven Bot Execution Engine
-- ========================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Automations Definition Table
CREATE TABLE IF NOT EXISTS automations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id BIGINT UNSIGNED NOT NULL,
  whatsapp_account_id BIGINT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  purpose VARCHAR(500) NULL,
  template_type VARCHAR(50) DEFAULT 'blank',
  status ENUM('draft', 'published', 'paused', 'archived') DEFAULT 'draft',
  current_version_id BIGINT UNSIGNED NULL,
  draft_definition JSON NULL,
  total_conversations INT UNSIGNED DEFAULT 0,
  total_callbacks INT UNSIGNED DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_auto_business_status (business_id, status),
  INDEX idx_auto_account (whatsapp_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure automations.id is BIGINT UNSIGNED if created by an earlier schema
ALTER TABLE automations MODIFY COLUMN id BIGINT UNSIGNED AUTO_INCREMENT;

-- 2. Automation Versions (Immutable Published Snapshots)
CREATE TABLE IF NOT EXISTS automation_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  automation_id BIGINT UNSIGNED NOT NULL,
  business_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL DEFAULT 1,
  definition JSON NOT NULL,
  published_by BIGINT UNSIGNED NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_version_lookup (automation_id, version_number),
  INDEX idx_version_auto (automation_id),
  INDEX idx_version_business (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Automation Triggers (Indexed for Fast O(1) Match Routing)
CREATE TABLE IF NOT EXISTS automation_triggers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  automation_id BIGINT UNSIGNED NOT NULL,
  business_id BIGINT UNSIGNED NOT NULL,
  whatsapp_account_id BIGINT UNSIGNED NULL,
  trigger_type ENUM('KEYWORD', 'BUTTON_CLICK') NOT NULL,
  keyword VARCHAR(100) NULL,
  interactive_button_id BIGINT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trig_lookup (business_id, is_active, trigger_type, keyword),
  INDEX idx_trig_button (business_id, interactive_button_id),
  INDEX idx_trig_auto (automation_id),
  INDEX idx_trig_business (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Automation Active Sessions
CREATE TABLE IF NOT EXISTS automation_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id BIGINT UNSIGNED NOT NULL,
  automation_id BIGINT UNSIGNED NOT NULL,
  version_id BIGINT UNSIGNED NOT NULL,
  whatsapp_account_id BIGINT UNSIGNED NULL,
  conversation_id BIGINT UNSIGNED NOT NULL,
  contact_id BIGINT UNSIGNED NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  current_step_id VARCHAR(64) NOT NULL,
  status ENUM('active', 'completed', 'handed_over', 'expired', 'stopped') DEFAULT 'active',
  unexpected_reply_count INT UNSIGNED DEFAULT 0,
  context_data JSON NULL,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sess_active (business_id, customer_phone, status),
  INDEX idx_sess_conversation (conversation_id, status),
  INDEX idx_sess_business (business_id),
  INDEX idx_sess_auto (automation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Automation Session Event Log
CREATE TABLE IF NOT EXISTS automation_session_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  business_id BIGINT UNSIGNED NOT NULL,
  step_id VARCHAR(64) NULL,
  event_type ENUM('STEP_ENTER', 'MESSAGE_SENT', 'USER_REPLY', 'UNEXPECTED_REPLY', 'CALLBACK_REQUESTED', 'HANDOVER', 'COMPLETED') NOT NULL,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_session (session_id),
  INDEX idx_event_business (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Automation Callback Requests (Leads Queue)
CREATE TABLE IF NOT EXISTS automation_callbacks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id BIGINT UNSIGNED NOT NULL,
  automation_id BIGINT UNSIGNED NOT NULL,
  session_id BIGINT UNSIGNED NULL,
  whatsapp_account_id BIGINT UNSIGNED NULL,
  conversation_id BIGINT UNSIGNED NOT NULL,
  contact_id BIGINT UNSIGNED NOT NULL,
  customer_name VARCHAR(150) NULL,
  customer_phone VARCHAR(32) NOT NULL,
  status ENUM('pending', 'contacted', 'resolved', 'cancelled') DEFAULT 'pending',
  assigned_to BIGINT UNSIGNED NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cb_business_status (business_id, status),
  INDEX idx_cb_contact (contact_id),
  INDEX idx_cb_business (business_id),
  INDEX idx_cb_auto (automation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
