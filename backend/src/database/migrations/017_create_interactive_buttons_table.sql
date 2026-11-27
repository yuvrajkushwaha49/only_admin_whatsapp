-- Ensure interactive_buttons table exists for the Interactive Buttons library & Templates page

CREATE TABLE IF NOT EXISTS interactive_buttons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  component_type VARCHAR(50) DEFAULT 'Feedback',
  delivery_type VARCHAR(50) DEFAULT 'buttons',
  message_text TEXT NULL,
  buttons_data JSON NULL,
  follow_up_enabled TINYINT(1) DEFAULT 0,
  follow_up_text TEXT NULL,
  button_type VARCHAR(50) DEFAULT 'QUICK_REPLY',
  button_text VARCHAR(100) NULL,
  value TEXT NULL,
  url_type ENUM('STATIC', 'DYNAMIC') DEFAULT 'STATIC',
  category VARCHAR(50) DEFAULT 'MARKETING',
  icon VARCHAR(50) DEFAULT 'bi-grid',
  click_count INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_btn_business (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
