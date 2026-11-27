-- ==============================================================================
-- Migration 016: Ensure missing runtime-added columns exist in core schema
-- Prevents 500 errors on fresh MySQL installations when querying admin_status,
-- allowed_phone_numbers, or contacts.assigned_user_id.
-- ==============================================================================

ALTER TABLE whatsapp_accounts ADD COLUMN admin_status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE businesses ADD COLUMN allowed_phone_numbers TEXT NULL;
ALTER TABLE contacts ADD COLUMN assigned_user_id BIGINT UNSIGNED NULL;
