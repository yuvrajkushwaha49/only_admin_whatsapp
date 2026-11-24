# Permissions & Tenant Data Isolation

## Strict Tenant Security Architecture
- **Tenant Isolation:** Every client business data record (contacts, conversations, campaigns, templates, logs) is partitioned by `business_id`.
- **Backend Enforced Authorization:** Authorization is verified on the backend from verified JWT session tokens. The backend never trusts client-supplied tenant IDs from the frontend.
- **Super Admin Impersonation:** Super Admins can securely view client workspaces using controlled session impersonation with full audit logging.
