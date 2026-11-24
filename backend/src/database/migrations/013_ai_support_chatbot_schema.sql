-- ==============================================================================
-- Migration 013: AI Support Chatbot Schema
-- Multi-tenant isolation for AI Support Assistant conversations, messages,
-- documentation knowledge base indexing, feedback, usage logs & admin settings.
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  conversation_title VARCHAR(255) NOT NULL DEFAULT 'New Support Conversation',
  status ENUM('active', 'archived', 'closed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_conv_tenant_user (tenant_id, user_id),
  INDEX idx_ai_conv_status (status),
  FOREIGN KEY (tenant_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. AI Messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_type ENUM('user', 'assistant', 'system') NOT NULL,
  message_content MEDIUMTEXT NOT NULL,
  message_status ENUM('sent', 'received', 'failed', 'blocked') NOT NULL DEFAULT 'sent',
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  model_name VARCHAR(128) NULL,
  sources_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_msg_conv (conversation_id),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. AI Knowledge Documents
CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_name VARCHAR(255) NOT NULL,
  document_path VARCHAR(512) NOT NULL UNIQUE,
  category VARCHAR(64) NOT NULL,
  version VARCHAR(32) NOT NULL DEFAULT '1.0',
  status ENUM('indexed', 'pending', 'error') NOT NULL DEFAULT 'indexed',
  indexed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_kdoc_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. AI Knowledge Chunks
CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  chunk_content TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  search_metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_kchunk_doc (document_id),
  FULLTEXT INDEX idx_ai_kchunk_fulltext (chunk_content),
  FOREIGN KEY (document_id) REFERENCES ai_knowledge_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. AI Feedback
CREATE TABLE IF NOT EXISTS ai_feedback (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  message_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  feedback_type ENUM('helpful', 'not_helpful') NOT NULL,
  feedback_comment TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_fb_conv (conversation_id),
  INDEX idx_ai_fb_msg (message_id),
  INDEX idx_ai_fb_tenant (tenant_id),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. AI Settings
CREATE TABLE IF NOT EXISTS ai_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(128) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. AI Usage Logs
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  conversation_id BIGINT UNSIGNED NULL,
  model_name VARCHAR(128) NULL,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  estimated_cost DECIMAL(10, 6) DEFAULT 0.000000,
  response_time_ms INT DEFAULT 0,
  request_status ENUM('success', 'failed', 'blocked') NOT NULL DEFAULT 'success',
  error_code VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_usage_tenant (tenant_id),
  INDEX idx_ai_usage_date (created_at),
  FOREIGN KEY (tenant_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial default settings
INSERT INTO ai_settings (setting_key, setting_value) VALUES
  ('ai_chat_enabled', 'true'),
  ('ai_temperature', '0.3'),
  ('ai_max_tokens', '1000'),
  ('gemini_model', 'gemini-1.5-flash'),
  ('ai_request_timeout', '30000'),
  ('rate_limit_per_minute', '20')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

SET FOREIGN_KEY_CHECKS = 1;
