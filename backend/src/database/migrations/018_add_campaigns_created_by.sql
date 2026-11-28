-- Add created_by column to campaigns table for audit logs and scheduled broadcast ownership tracking

ALTER TABLE campaigns ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER template_id;
