# Webhook Diagnostics and Verification

## Webhook Architecture
Meta pushes incoming messages, message delivery status callbacks (`sent`, `delivered`, `read`, `failed`), and account quality changes to our secure webhook endpoint (`/api/webhooks/meta`).

## Troubleshooting Webhook Issues
1. **Verification Token Mismatch:** When configuring Meta Webhooks in Developer Console, the Verify Token must match `META_WEBHOOK_VERIFY_TOKEN` configured in our platform settings.
2. **SSL / HTTPS Requirement:** Meta requires a valid, trusted SSL/TLS certificate. Self-signed certificates are rejected by Meta webhook delivery.
3. **HTTP 200 Response:** Our webhook server must return an immediate HTTP 200 OK response upon receiving an event to prevent Meta from retrying or temporarily disabling the webhook subscription.
